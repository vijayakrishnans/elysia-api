import { afterEach, describe, expect, it } from "vitest";
import app from "@/index";
import { SITE_NAME } from "@/identity";
import { env } from "./stubs/cloudflare-workers";

// The Elysia app (apps/api/src/index.ts) on Node: the module wrangler bundles,
// its routes compiled by Elysia's Cloudflare adapter, called with web-standard
// Requests — the template's page, Elysia's own 404, and the port's /health.
const get = (route: string, init?: RequestInit) => app.handle(new Request(`http://localhost${route}`, init));
const escaped = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

describe("the Elysia app (apps/api/src/index.ts)", () => {
  it("answers / with the template's page, named by the site's name", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/html/);
    const html = await res.text();
    // The name is text in the page: escaped, so a name with `&` or `<` in it
    // (an owner's, after the rename) stays text.
    const name = escaped(SITE_NAME);
    expect(html).toContain(`<title>${name}</title>`);
    expect(html).toContain(`<h1>Welcome to ${name}</h1>`);
    expect(html).toContain('<img src="https://elysiajs.com/assets/elysia.svg" alt="Elysia logo" class="logo" />');
    expect(html).toContain("<p>An ergonomic framework for humans</p>");
    expect(html).toContain('href="https://elysiajs.com/integrations/cloudflare-worker"');
    expect(html).toContain('href="https://developers.cloudflare.com/workers/"');
    expect(html).not.toMatch(/vercel/i);
  });

  it("answers HEAD / without a body", async () => {
    const res = await get("/", { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });

  it("answers an unknown path with Elysia's own 404", async () => {
    const res = await get("/nope");
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("NOT_FOUND");
  });

  it("answers a method the route does not take with a 404", async () => {
    const res = await get("/", { method: "POST" });
    expect(res.status).toBe(404);
  });
});

describe("GET /health — what the deploy's smoke and the bootstrap's probe read", () => {
  afterEach(() => {
    delete env.ENVIRONMENT;
  });

  it("names the site and the environment the Worker runs as", async () => {
    // On the Worker, wrangler's `env.stage.vars.ENVIRONMENT`, read through
    // `cloudflare:workers` (the e2e tier reads that one under workerd).
    env.ENVIRONMENT = "stage";
    const res = await get("/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(await res.json()).toEqual({ status: "ok", name: SITE_NAME, environment: "stage" });
  });

  it("still answers when no ENVIRONMENT is set", async () => {
    const res = await get("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", environment: "unknown" });
  });
});

describe("the site's identity (apps/api/src/identity.ts)", () => {
  it("names the site", () => {
    expect(SITE_NAME.trim()).not.toBe("");
  });
});
