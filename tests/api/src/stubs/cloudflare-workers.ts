// What `import { env } from "cloudflare:workers"` gives the app on the Worker:
// its bindings. On Node the tests set the vars they need on this object.
export const env: Record<string, string | undefined> = {};
