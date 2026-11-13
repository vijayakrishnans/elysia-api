import { env } from "cloudflare:workers";
import { Elysia } from "elysia";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { SITE_NAME } from "./identity";

// Vercel's Elysia example (vercel/vercel examples/elysia, Apache-2.0; see
// ../LICENSE.md), modified for Cloudflare Workers. On Vercel it runs on Bun;
// here Elysia's own Cloudflare adapter serves it on workerd, and `.compile()`
// builds its handlers once, at module scope (a Worker may generate code at
// startup, not per request). Wrangler bundles this file as the Worker's entry
// and the default export is what the runtime calls. Changed from upstream: the
// adapter and `.compile()`; the page's title and heading read the site's name;
// its logo is Elysia's own and its links are Cloudflare's and Elysia's
// Cloudflare page; and a /health route.

// The site's name goes into HTML: escape it, so a name with `&` or `<` in it
// stays text.
const siteName = SITE_NAME.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const app = new Elysia({ adapter: CloudflareAdapter })
  .get("/", () => {
    return new Response(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${siteName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: linear-gradient(135deg, #000 0%, #111 100%);
          color: #fff;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          text-align: center;
          max-width: 600px;
          padding: 2rem;
        }
        .logo {
          width: 120px;
          height: 120px;
          border-radius: 12px;
          margin: 0 auto 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 1.5rem;
        }
        h1 {
          font-size: 3rem;
          font-weight: 700;
          margin-bottom: 1rem;
          color: white;
        }
        p {
          font-size: 1.125rem;
          color: #888;
          margin-bottom: 2rem;
          line-height: 1.6;
        }
        .features {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          margin-top: 2rem;
        }
        .feature {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 1rem;
          backdrop-filter: blur(10px);
        }
        .feature h3 {
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        .feature a {
          font-size: 1rem;
          color: white;
          margin: 0;
          text-decoration: none;
        }
        .feature a:hover {
          text-decoration: underline;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <img src="https://elysiajs.com/assets/elysia.svg" alt="Elysia logo" class="logo" />
        <h1>Welcome to ${siteName}</h1>
        <p>An ergonomic framework for humans</p>
        <div class="features">
          <div class="feature">
            <a href="https://developers.cloudflare.com/workers/" target="_blank" rel="noreferrer">Cloudflare Workers docs</a>
          </div>
          <div class="feature">
            <a href="https://elysiajs.com/integrations/cloudflare-worker" target="_blank" rel="noreferrer">Elysia docs</a>
          </div>
        </div>
      </div>
    </body>
    </html>
    `, {
      headers: {
        'Content-Type': 'text/html'
      }
    });
  })
  // The deploy's contract (the port's; the template has only `/`): the site's
  // name and the environment whose config the Worker runs — wrangler's
  // `env.<name>.vars.ENVIRONMENT`, read from the Worker's bindings at request
  // time — so a 200 here is this site, deployed to that environment.
  .get("/health", () => ({
    status: "ok",
    name: SITE_NAME,
    environment: (env as { ENVIRONMENT?: string }).ENVIRONMENT ?? "unknown",
  }))
  .compile();

export default app;
