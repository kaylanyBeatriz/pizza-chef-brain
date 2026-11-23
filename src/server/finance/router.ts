// Rotas da API (/api/...), as mesmas que a API Laravel atendia em backend/routes/api.php.
import * as categories from "./categories";
import { withSql, type Sql } from "./db";
import { HttpError, json, readInput, type Input } from "./http";
import { summary } from "./summary";
import * as transactions from "./transactions";

type Ctx = { sql: Sql; id: string; input: Input };
type Route = { method: string; pattern: RegExp; handler: (ctx: Ctx) => Promise<Response> };

const routes: Route[] = [];
function route(method: string, path: string, handler: Route["handler"]) {
  routes.push({ method, pattern: new RegExp(`^${path.replace("{id}", "([^/]+)")}$`), handler });
}

route("GET", "/finance/summary", ({ sql, input }) => summary(sql, input));
route("GET", "/finance/categories", ({ sql, input }) => categories.index(sql, input));
route("POST", "/finance/categories", ({ sql, input }) => categories.store(sql, input));
route("PUT", "/finance/categories/{id}", ({ sql, id, input }) => categories.update(sql, id, input));
route("DELETE", "/finance/categories/{id}", ({ sql, id }) => categories.destroy(sql, id));
route("GET", "/finance/transactions", ({ sql, input }) => transactions.index(sql, input));
route("POST", "/finance/transactions", ({ sql, input }) => transactions.store(sql, input));
route("GET", "/finance/transactions/{id}", ({ sql, id }) => transactions.show(sql, id));
route("PUT", "/finance/transactions/{id}", ({ sql, id, input }) =>
  transactions.update(sql, id, input),
);
route("DELETE", "/finance/transactions/{id}", ({ sql, id }) => transactions.destroy(sql, id));
route("PATCH", "/finance/transactions/{id}/pay", ({ sql, id, input }) =>
  transactions.pay(sql, id, input),
);
route("PATCH", "/finance/transactions/{id}/unpay", ({ sql, id }) => transactions.unpay(sql, id));

export async function handleApi(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/^\/api/, "").replace(/\/$/, "") || "/";
  if (path === "/health") return json({ status: "ok" });

  const matches = routes
    .map((r) => ({ r, m: r.pattern.exec(path) }))
    .filter((x): x is { r: Route; m: RegExpExecArray } => x.m !== null);
  if (matches.length === 0) return json({ message: "Rota não encontrada." }, 404);

  const match = matches.find((x) => x.r.method === request.method);
  if (!match) return json({ message: "Método não permitido para esta rota." }, 405);

  try {
    const input = await readInput(request);
    const id = decodeURIComponent(match.m[1] ?? "");
    return await withSql((sql) => match.r.handler({ sql, id, input }));
  } catch (error) {
    if (error instanceof HttpError) return error.toResponse();
    console.error("Erro na API:", error);
    return json({ message: "Erro interno no servidor." }, 500);
  }
}
