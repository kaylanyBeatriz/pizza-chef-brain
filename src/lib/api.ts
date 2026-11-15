import { supabase } from "@/integrations/supabase/client";

const API_URL = resolveApiUrl((import.meta.env.VITE_API_URL ?? "http://localhost:8000/api").replace(/\/$/, ""));

// Aberto pelo celular na rede local (ex.: http://192.168.1.5:8080), "localhost" seria o próprio celular:
// troca pelo endereço do computador que serve a página.
function resolveApiUrl(url: string): string {
  if (typeof window === "undefined") return url;
  const pageHost = window.location.hostname;
  if (pageHost === "localhost" || pageHost === "127.0.0.1") return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") return url;
    parsed.hostname = pageHost;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    // "Failed to fetch": a API não respondeu (fora do ar, endereço errado ou bloqueio de CORS).
    throw new ApiError(`Não foi possível conectar à API (${API_URL}). Verifique se o backend está rodando.`, 0);
  }
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const validationMessage = body?.errors
      ? Object.values(body.errors).flat().join(" ")
      : null;
    throw new ApiError(validationMessage || body?.message || "Erro ao acessar a API.", response.status);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (path: string) => request<void>(path, { method: "DELETE" }),
};

export type ApiCollection<T> = { data: T[] };
export type ApiResource<T> = { data: T };
export type CurrentUser = { id: string; name: string; email: string; role: "admin" | "gerente" | "operador" };
