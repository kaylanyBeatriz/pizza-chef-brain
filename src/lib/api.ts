import { supabase } from "@/integrations/supabase/client";

// A API roda no mesmo endereço do site (src/routes/api/$.ts), então o caminho é relativo:
// funciona igual no computador, no celular e no Cloudflare. VITE_API_URL só para apontar outra API.
const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    // "Failed to fetch": a API não respondeu (fora do ar, endereço errado ou bloqueio de CORS).
    throw new ApiError(
      "Não foi possível conectar ao servidor. Verifique sua internet e tente de novo.",
      0,
    );
  }
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const validationMessage = body?.errors ? Object.values(body.errors).flat().join(" ") : null;
    throw new ApiError(
      validationMessage || body?.message || "Erro ao acessar a API.",
      response.status,
    );
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (path: string) => request<void>(path, { method: "DELETE" }),
};

export type ApiCollection<T> = { data: T[] };
export type ApiResource<T> = { data: T };
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "gerente" | "operador";
};
