import { defineConfig } from "vitest/config";
import * as path from "node:path";

// The app module that ships (apps/api/src/index.ts) is the module tested: the
// same Elysia app, compiled by the same Cloudflare adapter, called through
// `app.handle(new Request(...))` on Node. Only `cloudflare:workers` — the
// Worker's bindings, which exist only inside workerd — is stood in for, by a
// module whose `env` the tests set. The e2e tier serves the real Worker under
// workerd.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../../apps/api/src"),
      "cloudflare:workers": path.resolve(__dirname, "src/stubs/cloudflare-workers.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
