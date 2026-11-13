# elysia-api

An [Elysia](https://elysiajs.com/) server on one **Cloudflare Worker**.
Elysia's Cloudflare adapter serves the app's routes (`apps/api/src/index.ts`)
on workerd, compiled once when the Worker starts, and wrangler bundles the
module as the Worker. Every merge to `main` deploys it to stage, then prod.

Built from Vercel's Elysia on Vercel template (vercel/vercel, Apache-2.0 —
the licence is `apps/api/LICENSE.md`).

## Live deployment

<!-- 02-docs:begin -->
Not recorded yet. The bootstrap's last phase writes the live URLs, the
workspace and the secrets the app uses into
[ai/context/deployment.md](ai/context/deployment.md); how the app deploys
and how to operate it is in
[ai/context/operations.md](ai/context/operations.md).
<!-- 02-docs:end -->

## Routes

| Route | Answers |
|---|---|
| `GET /` | the welcome page, titled with the site's name (`SITE_NAME`) |
| `GET /health` | `{"status":"ok","name":"<SITE_NAME>","environment":"<env>"}` — what the deploy's smoke and an operator's probe read |
| anything else | Elysia's `404` (`NOT_FOUND`, plain text); a body that fails a route's `t` schema gets a `422` |

## What is here

| Surface | Where |
|---|---|
| The app and its routes (Elysia, compiled by its Cloudflare adapter) | `apps/api/src/index.ts` |
| The site's name (the welcome page's title and heading, and `/health`) | `apps/api/src/identity.ts` |
| Worker config (name, compatibility date, `src/index.ts` as the entry, per-environment vars) | `apps/api/wrangler.jsonc` |
| Deploy contract | `apps/api/component.yaml` (`cloudflare-worker-turbo`) |
| Tests | `tests/api` (vitest: imports the same app module and calls every route with `app.handle(new Request(...))` on Node) |

## Getting started

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build            # wrangler's dry run → apps/api/dist (the Worker's one bundle)
```

Run the Worker under workerd and call it:

```bash
pnpm --filter @app/api dev                 # wrangler dev, http://localhost:8787
curl http://localhost:8787/                # the welcome page
curl http://localhost:8787/health          # {"status":"ok",…,"environment":"local"}
```

Add a route by chaining it onto the app in `apps/api/src/index.ts`, before
`.compile()`: `.get("/hello", () => "hi")` answers `/hello`,
`.get("/users/:id", ({ params }) => params.id)` answers `/users/42`, and
`.post("/echo", ({ body }) => body, { body: t.Object({ name: t.String() }) })`
validates its body (a `422` when it does not match). Split routes into
plugins (`new Elysia({ prefix: "/users" })`, `.use(...)`) as the app grows.
Keep `/health`: the deploy's smoke reads it.

On the Worker, the bindings and vars are `env` from `cloudflare:workers`
(as `/health` reads `ENVIRONMENT`). Elysia's static plugin and `Elysia.file`
read the filesystem and do not run on Workers: serve files from Workers Static
Assets instead (an `assets` directory in `wrangler.jsonc`).

## How it deploys

Merges to `main` converge through [Orun](https://github.com/sourceplane/orun):
`.github/workflows/ci.yml` plans the changed components and runs each lane
against the workspace in `intent.yaml`. The app deploys to `stage`, then to
`prod` once stage has converged on the same commit; `dev` only verifies. The
Worker is `elysia-api-api-<env>` on your account's workers.dev subdomain, and
every deploy is smoke-tested over HTTP: `/health` must answer `"status":"ok"`
for that environment. A pull request runs the same pipeline's verify lanes:
the Worker bundled, type-checked and dry-deployed for each environment, with
nothing deployed. They do not lint or run the tests, so run `pnpm typecheck`,
`pnpm lint` and `pnpm test` before you push. (A push to `main` builds,
deploys and smoke-tests.)

The pipeline holds one credential, GitHub's own `GITHUB_TOKEN`. The
Cloudflare token and account id are brokered per run from the workspace's
Cloudflare connection; nothing provider-shaped is stored in the repository
or in GitHub.

**Deploy by hand.** Orunbase's **Deploy** button on a component, or **Run
workflow** on the CI workflow in GitHub's Actions tab (on `main`), runs
`ci.yml` for the environment and components you pick, and each one deploys
exactly as a merge would deploy it. Leave the component blank to redeploy
every component in that environment, with nothing changed: after rotating a
secret, say. A component with nothing to run in that environment (a test
suite in `prod`) is left out with a notice.

## Adding a binding or a secret

The Worker binds nothing of its own today, so `wrangler.jsonc` is committed
as it deploys. To give it a KV namespace, a D1 database or an R2 bucket, add the
resource under `infra/` as its own component and have `apps/api/component.yaml`
depend on it; `tooling/wire/` renders a wrangler template from the ids that
component publishes. A runtime secret (an API key for a service the app
calls) is an Orun secret: `orun secrets set <KEY> --org <ws> --env <env>`,
declared in the component's `optionalSecretEnv` and named in its
`runtimeSecrets`, then pushed to the Worker after each deploy. Until it is
set, the route that needs it should say so rather than fail. On the Worker
a secret is in `env` from `cloudflare:workers`, beside the vars.

## Custom domain

The app answers on workers.dev from its first deploy. To serve it on your own
domain, add the domain to the Cloudflare account the app deploys into and
attach it to the Worker (dashboard → Workers & Pages → `elysia-api-api-prod` →
Settings → Domains & Routes → Add → Custom domain); do the same for stage
with a subdomain if you want one. The workers.dev URL keeps answering, and the
deploy's smoke keeps reading it — unless the environment sets `DEPLOYED_URL`
in `intent.yaml`, which the smoke reads instead:

```yaml
environments:
  prod:
    env:
      DEPLOYED_URL: https://elysia-api.example.com
```

The repository names the domain in one place, `BASE_DOMAIN` in `intent.yaml`
(one line per environment), which the app was born with as the reserved
placeholder `elysia-api.example.com` — the example above carries it too.
Replace it with your domain in the same change that attaches it.
