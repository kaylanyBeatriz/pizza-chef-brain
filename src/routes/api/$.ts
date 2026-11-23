import { createFileRoute } from "@tanstack/react-router";
import { handleApi } from "@/server/finance/router";

// Todas as chamadas /api/* do site são atendidas aqui, no mesmo Worker que serve as telas.
export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      ANY: ({ request }) => handleApi(request),
    },
  },
});
