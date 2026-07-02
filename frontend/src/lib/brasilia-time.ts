const TIME_ZONE = "America/Sao_Paulo";

function asDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDateBrasilia(value: string | Date | null | undefined): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(asDate(value));
}

export function formatTimeBrasilia(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(asDate(value));
}

export function isTodayBrasilia(value: string | Date | null | undefined): boolean {
  if (!value) return false;
  const target = formatDateBrasilia(value);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return target === today;
}
