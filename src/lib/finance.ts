export type TransactionType = "income" | "expense";
export type TransactionStatus = "paid" | "pending" | "overdue";

export type Transaction = {
  id: string;
  type: TransactionType;
  description: string;
  category: string;
  amount: number;
  payment_method: string | null;
  counterparty: string | null;
  due_date: string;
  paid_at: string | null;
  status: TransactionStatus;
  notes: string | null;
};

export type FinanceSummary = {
  from: string;
  to: string;
  income: number;
  expense: number;
  balance: number;
  receivable: { total: number; count: number; overdue: number };
  payable: { total: number; count: number; overdue: number };
  daily: Array<{ dia: string; entradas: number; saidas: number }>;
  byCategory: Array<{ type: TransactionType; category: string; total: number; count: number }>;
};

export const EXPENSE_CATEGORIES = [
  "Aluguel", "Luz", "Água", "Gás", "Impostos",
  "Marketing", "Manutenção", "Entregas", "Outras despesas",
];

export const PAYMENT_METHODS: Array<{ value: string; label: string }> = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "debito", label: "Cartão de débito" },
  { value: "credito", label: "Cartão de crédito" },
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferência" },
  { value: "outro", label: "Outro" },
];

export const STATUS_LABEL: Record<TransactionStatus, string> = {
  paid: "Pago",
  pending: "Pendente",
  overdue: "Atrasado",
};

export const STATUS_CLASS: Record<TransactionStatus, string> = {
  paid: "bg-success text-success-foreground",
  pending: "bg-warning text-warning-foreground",
  overdue: "bg-destructive text-destructive-foreground",
};

export const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function toDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Soma meses a uma data ISO (YYYY-MM-DD) mantendo o dia, limitado ao último dia do mês de destino. */
export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  return toDateInput(target);
}

export function monthRange(ref = new Date()) {
  return {
    from: toDateInput(new Date(ref.getFullYear(), ref.getMonth(), 1)),
    to: toDateInput(new Date(ref.getFullYear(), ref.getMonth() + 1, 0)),
  };
}

export function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  // BOM + ";" para abrir corretamente no Excel em pt-BR.
  const csv = "﻿" + rows.map((r) => r.map(escape).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
