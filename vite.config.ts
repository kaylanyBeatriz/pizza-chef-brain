// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Segredos locais da API (DATABASE_URL) para o `npm run dev`. No Cloudflare eles vêm de
// `wrangler secret put`. O arquivo .dev.vars é ignorado pelo git (modelo em .dev.vars.example).
try {
  process.loadEnvFile(".dev.vars");
} catch {
  // Sem .dev.vars: a API responde com erro até a DATABASE_URL ser configurada.
}

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Fora do Lovable o build não gera a versão para o Cloudflare Workers sem isto
  // (mesmas opções que o Lovable usa no sandbox). Deploy: `npm run build` e `npx wrangler deploy`.
  nitro: {
    preset: "cloudflare-module",
    output: { dir: "dist", serverDir: "dist/server", publicDir: "dist/client" },
    cloudflare: { nodeCompat: true, deployConfig: true },
  },
});
