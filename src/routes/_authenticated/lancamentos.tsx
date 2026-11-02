import { createFileRoute } from "@tanstack/react-router";
import { LancamentosView } from "@/components/finance/LancamentosView";

export const Route = createFileRoute("/_authenticated/lancamentos")({
  component: LancamentosView,
});
