import { useQuery } from "@tanstack/react-query";
import { api, type ApiCollection } from "@/lib/api";
import { EXPENSE_CATEGORIES } from "@/lib/finance";

export type Category = { id: string; type: "expense" | "income"; name: string; usage: number };

/** Categorias de despesa cadastradas. */
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      (await api.get<ApiCollection<Category>>("/finance/categories?type=expense")).data,
  });
}

/** Nomes das categorias; usa as padrão enquanto o cadastro não carrega. */
export function categoryNames(all: Category[] | undefined): string[] {
  const fromApi = (all ?? []).map((c) => c.name);
  return fromApi.length > 0 ? fromApi : EXPENSE_CATEGORIES;
}
