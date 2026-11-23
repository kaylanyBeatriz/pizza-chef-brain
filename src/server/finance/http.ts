// Respostas, erros e validação no mesmo formato da API Laravel anterior,
// para o site continuar funcionando sem mudanças.

export const TIME_ZONE = "America/Sao_Paulo";

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

/** Erro que vira resposta HTTP (ex.: 404, ou 422 de regra de negócio). */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: Record<string, string[]>,
  ) {
    super(message);
  }

  toResponse(): Response {
    return json(
      this.errors ? { message: this.message, errors: this.errors } : { message: this.message },
      this.status,
    );
  }
}

export const notFound = (what = "Registro") => new HttpError(404, `${what} não encontrado.`);

/** "Hoje" no fuso de São Paulo, como "YYYY-MM-DD". */
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Soma dias a uma data "YYYY-MM-DD" (sem fuso horário). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Arredonda para 2 casas como o round() do PHP (meio para longe do zero). */
export function round2(value: number): number {
  const rounded = Number(`${Math.round(Number(`${Math.abs(value)}e2`))}e-2`);
  return value < 0 ? -rounded : rounded;
}

export type Input = Record<string, unknown>;

/**
 * Lê query + corpo JSON, como o Laravel: textos sem espaços nas pontas e texto vazio vira null
 * (middlewares TrimStrings e ConvertEmptyStringsToNull).
 */
export async function readInput(request: Request): Promise<Input> {
  const input: Input = {};
  new URL(request.url).searchParams.forEach((value, key) => {
    input[key] = value;
  });

  if (request.method !== "GET" && request.method !== "HEAD") {
    const text = await request.text();
    if (text) {
      try {
        const body: unknown = JSON.parse(text);
        if (body && typeof body === "object" && !Array.isArray(body)) Object.assign(input, body);
      } catch {
        // Corpo inválido: segue como vazio e a validação aponta os campos faltando.
      }
    }
  }

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      input[key] = trimmed === "" ? null : trimmed;
    }
  }
  return input;
}

/** Junta os erros de validação e lança 422 no formato do Laravel. */
export class Validator {
  private readonly errors: Record<string, string[]> = {};

  constructor(private readonly input: Input) {}

  has(field: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.input, field);
  }

  value(field: string): unknown {
    return this.input[field];
  }

  fail(field: string, message: string) {
    (this.errors[field] ??= []).push(message);
  }

  ok(field: string): boolean {
    return !this.errors[field];
  }

  private present(field: string): boolean {
    const v = this.input[field];
    return v !== undefined && v !== null;
  }

  /** Campo obrigatório. Retorna false (e registra o erro) se faltar. */
  required(field: string, label: string): boolean {
    if (this.present(field)) return true;
    this.fail(field, `O campo ${label} é obrigatório.`);
    return false;
  }

  string(
    field: string,
    label: string,
    max: number,
    opts: { required?: boolean } = {},
  ): string | null {
    if (opts.required ? !this.required(field, label) : !this.present(field)) return null;
    const v = this.input[field];
    if (typeof v !== "string") {
      this.fail(field, `O campo ${label} deve ser um texto.`);
      return null;
    }
    if ([...v].length > max) {
      this.fail(field, `O campo ${label} não pode ter mais de ${max} caracteres.`);
      return null;
    }
    return v;
  }

  oneOf<T extends string>(
    field: string,
    label: string,
    options: readonly T[],
    opts: { required?: boolean } = {},
  ): T | null {
    if (opts.required ? !this.required(field, label) : !this.present(field)) return null;
    const v = this.input[field];
    if (typeof v !== "string" || !options.includes(v as T)) {
      this.fail(field, `O valor de ${label} é inválido.`);
      return null;
    }
    return v as T;
  }

  date(field: string, label: string, opts: { required?: boolean } = {}): string | null {
    if (opts.required ? !this.required(field, label) : !this.present(field)) return null;
    const v = this.input[field];
    if (typeof v !== "string" || !isValidDate(v)) {
      this.fail(field, `O campo ${label} deve ser uma data válida.`);
      return null;
    }
    return v;
  }

  /** Data que não pode ser anterior a `other` (regra after_or_equal do Laravel). */
  dateNotBefore(
    field: string,
    label: string,
    other: string | null,
    otherLabel: string,
  ): string | null {
    const v = this.date(field, label);
    if (v !== null && other !== null && v < other) {
      this.fail(field, `O campo ${label} deve ser uma data igual ou posterior a ${otherLabel}.`);
      return null;
    }
    return v;
  }

  integer(field: string, label: string, min: number, max: number): number | null {
    if (!this.present(field)) return null;
    const v = this.input[field];
    const n =
      typeof v === "number" ? v : typeof v === "string" && /^[+-]?\d+$/.test(v) ? Number(v) : NaN;
    if (!Number.isInteger(n)) {
      this.fail(field, `O campo ${label} deve ser um número inteiro.`);
      return null;
    }
    if (n < min || n > max) {
      this.fail(field, `O campo ${label} deve estar entre ${min} e ${max}.`);
      return null;
    }
    return n;
  }

  /** Valor numérico maior que zero e até `max` (regras numeric, gt:0 e max do Laravel). */
  amount(field: string, label: string, max: number): number | null {
    if (!this.required(field, label)) return null;
    const v = this.input[field];
    const numeric =
      (typeof v === "number" && Number.isFinite(v)) ||
      (typeof v === "string" && /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(v));
    if (!numeric) {
      this.fail(field, `O campo ${label} deve ser um número.`);
      return null;
    }
    const n = Number(v);
    if (n <= 0) {
      this.fail(field, `O campo ${label} deve ser maior que 0.`);
      return null;
    }
    if (n > max) {
      this.fail(field, `O campo ${label} não pode ser maior que ${max}.`);
      return null;
    }
    return n;
  }

  /** Lança 422 se algum campo falhou. */
  check() {
    const fields = Object.keys(this.errors);
    if (fields.length === 0) return;
    const total = fields.reduce((n, f) => n + this.errors[f].length, 0);
    const first = this.errors[fields[0]][0];
    const message = total > 1 ? `${first} (e mais ${total - 1} erro(s))` : first;
    throw new HttpError(422, message, this.errors);
  }
}
