import postgres from "postgres";

export type Sql = postgres.Sql;

/**
 * Conexão com o Postgres do Supabase.
 *
 * No Cloudflare Workers a conexão não pode ser reaproveitada entre requisições, então cada
 * requisição abre a sua e fecha no fim (ver `withSql`). Use a URL do pooler do Supabase
 * (porta 6543, modo transação): por isso `prepare: false`.
 *
 * DATABASE_URL vem do secret do Worker (`wrangler secret put DATABASE_URL`) e, no `npm run dev`,
 * do arquivo `.dev.vars` (carregado em vite.config.ts).
 */
export async function withSql<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada.");

  const sql = postgres(url, {
    prepare: false,
    max: 1,
    fetch_types: false,
    // Datas (`date`) chegam como texto "YYYY-MM-DD", sem conversão de fuso horário.
    types: {
      date: {
        to: 1082,
        from: [1082],
        serialize: (value: string) => value,
        parse: (value: string) => value,
      },
    },
  });

  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 2 });
  }
}
