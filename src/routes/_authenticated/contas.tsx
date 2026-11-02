import { createFileRoute } from "@tanstack/react-router";
import { ContasChecklist } from "@/components/finance/ContasChecklist";
import { PageHeader } from "@/components/finance/ui";

export const Route = createFileRoute("/_authenticated/contas")({
  component: ContasPage,
});

function ContasPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas a pagar"
        description="O que vence em cada mês. Marque o check conforme for pagando."
      />
      <ContasChecklist />
    </div>
  );
}
