// Lançamentos: porte de backend/app/Http/Controllers/Api/TransactionController.php.
import type { Sql } from "./db";
import { json, noContent, notFound, today, Validator, type Input } from "./http";

const TYPES = ["income", "expense"] as const;
const STATUSES = ["paid", "pending", "overdue"] as const;
const DATE_FIELDS = ["due_date", "paid_at"] as const;
const PAYMENT_METHODS = [
  "dinheiro",
  "pix",
  "debito",
  "credito",
  "boleto",
  "transferencia",
  "outro",
] as const;
const MAX_AMOUNT = 9999999999;

type Row = {
  id: string;
  type: string;
  description: string;
  category: string;
  amount: string;
  payment_method: string | null;
  counterparty: string | null;
  due_date: string;
  paid_at: string | null;
  notes: string | null;
};

const COLUMNS =
  "id, type, description, category, amount, payment_method, counterparty, due_date, paid_at, notes";

function status(row: Row, now: string): string {
  if (row.paid_at !== null) return "paid";
  return row.due_date < now ? "overdue" : "pending";
}

function resource(row: Row, now = today()) {
  return {
    id: String(row.id),
    type: row.type,
    description: row.description,
    category: row.category,
    amount: Number(row.amount),
    payment_method: row.payment_method,
    counterparty: row.counterparty,
    due_date: row.due_date,
    paid_at: row.paid_at,
    status: status(row, now),
    notes: row.notes,
  };
}

function parseId(id: string): string {
  if (!/^\d{1,18}$/.test(id)) throw notFound("Lançamento");
  return id;
}

async function find(sql: Sql, id: string): Promise<Row> {
  const [row] = await sql.unsafe<Row[]>(`select ${COLUMNS} from transactions where id = $1`, [
    parseId(id),
  ]);
  if (!row) throw notFound("Lançamento");
  return row;
}

export async function index(sql: Sql, input: Input): Promise<Response> {
  const v = new Validator(input);
  const type = v.oneOf("type", "tipo", TYPES);
  const statusFilter = v.oneOf("status", "situação", STATUSES);
  const category = v.string("category", "categoria", 80);
  const search = v.string("search", "busca", 255);
  const from = v.date("from", "data inicial");
  const to = v.dateNotBefore("to", "data final", from, "data inicial");
  const dateField = v.oneOf("date_field", "campo de data", DATE_FIELDS) ?? "due_date";
  const perPage = v.integer("per_page", "itens por página", 1, 500) ?? 200;
  const page = v.integer("page", "página", 1, Number.MAX_SAFE_INTEGER) ?? 1;
  v.check();

  const now = today();
  // Período aplicado ao vencimento (contas) ou à data do pagamento (lançamentos realizados).
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (clause: string, ...values: unknown[]) => {
    let sqlClause = clause;
    for (const value of values) {
      params.push(value);
      sqlClause = sqlClause.replace("?", `$${params.length}`);
    }
    where.push(sqlClause);
  };

  if (type) add("type = ?", type);
  if (category) add("category = ?", category);
  if (search) {
    const like = `%${search.toLowerCase()}%`;
    add("(lower(description) like ? or lower(counterparty) like ?)", like, like);
  }
  if (from) add(`${dateField} >= ?`, from);
  if (to) add(`${dateField} <= ?`, to);
  if (statusFilter === "paid") add("paid_at is not null");
  if (statusFilter === "pending") add("paid_at is null and due_date >= ?", now);
  if (statusFilter === "overdue") add("paid_at is null and due_date < ?", now);

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  const [{ total }] = await sql.unsafe<{ total: string }[]>(
    `select count(*) as total from transactions ${whereSql}`,
    params as never[],
  );
  const rows = await sql.unsafe<Row[]>(
    `select ${COLUMNS} from transactions ${whereSql}
     order by ${dateField} desc, id desc
     limit ${perPage} offset ${(page - 1) * perPage}`,
    params as never[],
  );

  const totalCount = Number(total);
  return json({
    data: rows.map((row) => resource(row, now)),
    meta: {
      current_page: page,
      per_page: perPage,
      total: totalCount,
      last_page: Math.max(1, Math.ceil(totalCount / perPage)),
    },
  });
}

/** Validação de cadastro/edição (TransactionRequest do Laravel). */
function validatePayload(input: Input) {
  const v = new Validator(input);
  const data = {
    type: v.oneOf("type", "tipo", TYPES, { required: true }),
    description: v.string("description", "descrição", 255, { required: true }),
    category: v.string("category", "categoria", 80, { required: true }),
    amount: v.amount("amount", "valor", MAX_AMOUNT),
    payment_method: v.oneOf("payment_method", "forma de pagamento", PAYMENT_METHODS),
    counterparty: v.string("counterparty", "fornecedor", 255),
    due_date: v.date("due_date", "vencimento", { required: true }),
    paid_at: v.date("paid_at", "data do pagamento"),
    notes: v.string("notes", "observações", 2000),
  };
  v.check(); // daqui em diante os campos obrigatórios estão preenchidos

  // Como no Laravel, campos opcionais ausentes do corpo não são alterados numa edição.
  const optional = ["payment_method", "counterparty", "paid_at", "notes"] as const;
  const present = optional.filter((field) => v.has(field));
  return {
    data: {
      ...data,
      type: data.type!,
      description: data.description!,
      category: data.category!,
      amount: data.amount!,
      due_date: data.due_date!,
    },
    present,
  };
}

/** Cria a categoria se ainda não existir (firstOrCreate do Laravel). */
async function ensureCategory(sql: Sql, type: string, name: string) {
  // "where not exists" evita consumir a sequência de ids quando a categoria já existe.
  await sql`
    insert into categories (type, name, created_at, updated_at)
    select ${type}, ${name}, now() at time zone 'America/Sao_Paulo', now() at time zone 'America/Sao_Paulo'
    where not exists (select 1 from categories where type = ${type} and name = ${name})
    on conflict (type, name) do nothing`;
}

export async function store(sql: Sql, input: Input): Promise<Response> {
  const { data } = validatePayload(input);
  const row = await sql.begin(async (tx) => {
    await ensureCategory(tx, data.type, data.category);
    const [created] = await tx.unsafe<Row[]>(
      `insert into transactions
         (type, description, category, amount, payment_method, counterparty, due_date, paid_at, notes, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() at time zone 'America/Sao_Paulo', now() at time zone 'America/Sao_Paulo')
       returning ${COLUMNS}`,
      [
        data.type,
        data.description,
        data.category,
        data.amount,
        data.payment_method,
        data.counterparty,
        data.due_date,
        data.paid_at,
        data.notes,
      ] as never[],
    );
    return created;
  });
  return json({ data: resource(row) }, 201);
}

export async function show(sql: Sql, id: string): Promise<Response> {
  return json({ data: resource(await find(sql, id)) });
}

export async function update(sql: Sql, id: string, input: Input): Promise<Response> {
  await find(sql, id);
  const { data, present } = validatePayload(input);

  const sets = ["type = $1", "description = $2", "category = $3", "amount = $4", "due_date = $5"];
  const params: unknown[] = [
    data.type,
    data.description,
    data.category,
    data.amount,
    data.due_date,
  ];
  for (const field of present) {
    params.push(data[field]);
    sets.push(`${field} = $${params.length}`);
  }
  params.push(id);

  const row = await sql.begin(async (tx) => {
    await ensureCategory(tx, data.type, data.category);
    const [updated] = await tx.unsafe<Row[]>(
      `update transactions set ${sets.join(", ")}, updated_at = now() at time zone 'America/Sao_Paulo'
       where id = $${params.length} returning ${COLUMNS}`,
      params as never[],
    );
    return updated;
  });
  return json({ data: resource(row) });
}

export async function destroy(sql: Sql, id: string): Promise<Response> {
  const result = await sql.unsafe("delete from transactions where id = $1", [parseId(id)]);
  if (result.count === 0) throw notFound("Lançamento");
  return noContent();
}

export async function pay(sql: Sql, id: string, input: Input): Promise<Response> {
  await find(sql, id);
  const v = new Validator(input);
  const paidAt = v.date("paid_at", "data do pagamento") ?? today();
  v.check();
  const [row] = await sql.unsafe<Row[]>(
    `update transactions set paid_at = $1, updated_at = now() at time zone 'America/Sao_Paulo'
     where id = $2 returning ${COLUMNS}`,
    [paidAt, id],
  );
  return json({ data: resource(row) });
}

export async function unpay(sql: Sql, id: string): Promise<Response> {
  await find(sql, id);
  const [row] = await sql.unsafe<Row[]>(
    `update transactions set paid_at = null, updated_at = now() at time zone 'America/Sao_Paulo'
     where id = $1 returning ${COLUMNS}`,
    [id],
  );
  return json({ data: resource(row) });
}
