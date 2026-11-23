// Categorias: porte de backend/app/Http/Controllers/Api/CategoryController.php.
import type { Sql } from "./db";
import { HttpError, json, noContent, notFound, Validator, type Input } from "./http";

const TYPES = ["income", "expense"] as const;

type Row = { id: string; type: string; name: string };

async function find(sql: Sql, id: string): Promise<Row> {
  if (!/^\d{1,18}$/.test(id)) throw notFound("Categoria");
  const [row] = await sql<Row[]>`select id, type, name from categories where id = ${id}`;
  if (!row) throw notFound("Categoria");
  return row;
}

/** Nome obrigatório, até 80 caracteres e único dentro do tipo. */
async function validateName(sql: Sql, v: Validator, type: string | null, ignoreId?: string) {
  const name = v.string("name", "nome", 80, { required: true });
  if (name !== null && type !== null) {
    const [taken] = await sql`
      select 1 from categories
      where name = ${name} and type = ${type} ${ignoreId ? sql`and id <> ${ignoreId}` : sql``}
      limit 1`;
    if (taken) v.fail("name", "Já existe uma categoria com esse nome.");
  }
  return name;
}

export async function index(sql: Sql, input: Input): Promise<Response> {
  const v = new Validator(input);
  const type = v.oneOf("type", "tipo", TYPES);
  v.check();

  const categories = await sql<Row[]>`
    select id, type, name from categories
    ${type ? sql`where type = ${type}` : sql``}
    order by type, name`;
  const usage = await sql<{ type: string; category: string; total: string }[]>`
    select type, category, count(*) as total from transactions group by type, category`;
  const counts = new Map(usage.map((u) => [`${u.type}|${u.category}`, Number(u.total)]));

  return json({
    data: categories.map((c) => ({
      id: String(c.id),
      type: c.type,
      name: c.name,
      usage: counts.get(`${c.type}|${c.name}`) ?? 0,
    })),
  });
}

export async function store(sql: Sql, input: Input): Promise<Response> {
  const v = new Validator(input);
  const type = v.oneOf("type", "tipo", TYPES, { required: true });
  const name = await validateName(sql, v, type);
  v.check();

  const [row] = await sql<Row[]>`
    insert into categories (type, name, created_at, updated_at)
    values (${type!}, ${name!}, now() at time zone 'America/Sao_Paulo', now() at time zone 'America/Sao_Paulo')
    returning id, type, name`;
  return json({ data: { id: String(row.id), type: row.type, name: row.name, usage: 0 } }, 201);
}

export async function update(sql: Sql, id: string, input: Input): Promise<Response> {
  const category = await find(sql, id);
  const v = new Validator(input);
  // O tipo não pode ser enviado numa edição, nem vazio (como no Laravel).
  if (v.has("type")) {
    v.fail("type", "O campo tipo não pode ser alterado.");
  }
  const name = await validateName(sql, v, category.type, category.id);
  v.check();

  // Renomear mantém os lançamentos já feitos ligados à categoria.
  await sql.begin(async (tx) => {
    await tx`
      update transactions set category = ${name!}, updated_at = now() at time zone 'America/Sao_Paulo'
      where type = ${category.type} and category = ${category.name}`;
    await tx`
      update categories set name = ${name!}, updated_at = now() at time zone 'America/Sao_Paulo'
      where id = ${category.id}`;
  });

  return json({ data: { id: String(category.id), type: category.type, name } });
}

export async function destroy(sql: Sql, id: string): Promise<Response> {
  const category = await find(sql, id);
  const [{ used }] = await sql<{ used: string }[]>`
    select count(*) as used from transactions
    where type = ${category.type} and category = ${category.name}`;

  if (Number(used) > 0) {
    throw new HttpError(
      422,
      `Categoria em uso por ${Number(used)} lançamento(s). Renomeie-a ou altere os lançamentos antes de excluir.`,
    );
  }

  await sql`delete from categories where id = ${category.id}`;
  return noContent();
}
