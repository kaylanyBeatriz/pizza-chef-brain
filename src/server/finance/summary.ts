// Resumo do dashboard/relatórios: porte de backend/app/Http/Controllers/Api/FinanceController.php.
import type { Sql } from "./db";
import { addDays, json, round2, today, Validator, type Input } from "./http";

type Totals = { total: string | null; count: string; overdue: string };

export async function summary(sql: Sql, input: Input): Promise<Response> {
  const v = new Validator(input);
  const fromInput = v.date("from", "data inicial");
  const toInput = v.dateNotBefore("to", "data final", fromInput, "data inicial");
  v.check();

  const now = today();
  const from = fromInput ?? `${now.slice(0, 8)}01`;
  const to = toInput ?? now;

  // Realizado: lançamentos pagos cuja data de pagamento cai no período.
  const [paid] = await sql<{ income: string | null; expense: string | null }[]>`
    select
      sum(amount) filter (where type = 'income') as income,
      sum(amount) filter (where type = 'expense') as expense
    from transactions
    where paid_at is not null and paid_at between ${from} and ${to}`;

  // Contas em aberto entram no período pelo vencimento.
  const open = (type: string) => sql<Totals[]>`
    select sum(amount) as total, count(*) as count, count(*) filter (where due_date < ${now}) as overdue
    from transactions
    where paid_at is null and due_date between ${from} and ${to} and type = ${type}`;
  const [[receivable], [payable]] = await Promise.all([open("income"), open("expense")]);

  const byDay = await sql<{ day: string; type: string; total: string }[]>`
    select paid_at as day, type, sum(amount) as total
    from transactions
    where paid_at is not null and paid_at between ${from} and ${to}
    group by paid_at, type`;
  const dayTotals = new Map(byDay.map((r) => [`${r.day}|${r.type}`, Number(r.total)]));

  const daily: { dia: string; entradas: number; saidas: number }[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    daily.push({
      dia: `${day.slice(8, 10)}/${day.slice(5, 7)}`,
      entradas: round2(dayTotals.get(`${day}|income`) ?? 0),
      saidas: round2(dayTotals.get(`${day}|expense`) ?? 0),
    });
  }

  const byCategory = await sql<{ type: string; category: string; total: string; count: string }[]>`
    select type, category, sum(amount) as total, count(*) as count
    from transactions
    where paid_at is not null and paid_at between ${from} and ${to}
    group by type, category
    order by sum(amount) desc`;

  const income = Number(paid.income ?? 0);
  const expense = Number(paid.expense ?? 0);
  const totals = (t: Totals) => ({
    total: round2(Number(t.total ?? 0)),
    count: Number(t.count),
    overdue: Number(t.overdue),
  });

  return json({
    from,
    to,
    income: round2(income),
    expense: round2(expense),
    balance: round2(income - expense),
    receivable: totals(receivable),
    payable: totals(payable),
    daily,
    byCategory: byCategory.map((r) => ({
      type: r.type,
      category: r.category,
      total: round2(Number(r.total)),
      count: Number(r.count),
    })),
  });
}
