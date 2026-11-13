# elysia-api — operating contract (for humans and agents)

This is the standing guide to how this app is deployed and operated.
Instance facts (live URLs, workspace, the secrets it uses) live in
[deployment.md](deployment.md), rendered from probed reality by the
bootstrap's `02-docs` phase; this file is the contract that stays true
between deployments. It is written to give an agent with repository read
access enough context to reason about and operate the app without any other
source.

## What this system is

An Elysia server on Cloudflare alone, expressed as an Orun component-native
desired-state repo.

- **`apps/api`** — the app: an Elysia server on Elysia's own Cloudflare
  adapter, compiled at module scope, in one Cloudflare Worker
  (`cloudflare-worker-turbo`): wrangler bundles `src/index.ts`, which the
  committed `wrangler.jsonc` names as `main`. The routes are chained on the
  app in `src/index.ts`: `GET /` answers the template's welcome page,
  `GET /health` answers `{"status":"ok","name":…,"environment":…}` (the
  environment read from the Worker's bindings, `env` from
  `cloudflare:workers`), anything else is Elysia's 404. It binds nothing of
  its own — no KV, D1, R2, assets or service binding — and holds no runtime
  secret.
- **`tests/api`** — vitest importing the same app module and calling every
  route with `app.handle(new Request(...))` on Node.
  A pull request's lanes do not run it (its `quick-check` lane on `dev`
  installs and checks the package; the Worker's lanes build, type-check and
  dry-deploy it): run `pnpm typecheck`, `pnpm lint` and `pnpm test` before
  you push.
- **`tooling/*`** — shared TypeScript and ESLint configuration, and the
  deploy-time wrangler renderer for workers that take wiring.

Environments: **`stage`** and **`prod`** are deployed; **`dev` is
verify-only by design** — lanes build, type-check and dry-run the deploy,
nothing deploys.

## Identity and tenancy

Every remote operation runs against ONE Orun workspace, declared in
`intent.yaml` under `execution.state.workspace` — committed, enforced, and
what CI uses. Do not remove it; headless credentials depend on it. If it
reads `ws_SET_ME`, the bootstrap had no workspace to write: set the real one
before anything else.

## How deployment works

1. Merge (or push) to `main`.
2. CI (`.github/workflows/ci.yml`) runs `orun plan --changed` — only
   components whose files changed are planned — then runs each planned lane
   with `orun run --remote-state`, authenticated by GitHub OIDC (the
   exchange resolves this repository's linked workspace server-side).
3. Each deploy lane installs the workspace, checks the Worker's structure
   (`package.json` and the committed `wrangler.jsonc`), builds and
   typechecks it, runs `wrangler deploy --env <env>` — the Worker is
   `elysia-api-api-<env>` — and smoke-tests it: `/health` on its workers.dev URL
   must answer `"status":"ok"` for that environment.
4. `prod` deploys after `stage` has converged on the same commit
   (`environments.prod.promotion` in intent.yaml).
5. **The convergence run is the deployment.** A green run means every
   planned lane applied. Failed lanes are retried with
   `gh run rerun --failed`, which resumes the same execution.

Caveats that matter:

- A push that touches no component files plans zero lanes — that run is
  green and deployed nothing. Never treat "latest run green" as "app
  converged"; probe `/health` instead.
- A change to `intent.yaml`'s `environments` maps to no component and
  redeploys nothing on its own. Land it with a change under `apps/api`.

## Secrets model

- **Brokered provider secrets**: `CLOUDFLARE_API_TOKEN` (Workers deploy
  scope) and `CLOUDFLARE_ACCOUNT_ID` — pointers minted per run from the
  workspace's Cloudflare connection. No long-lived values at rest; nothing
  to rotate by hand.
- Inspect by NAME only: `orun secrets list --org <ws> --project` and
  `--env stage|prod`. No tooling in this repository prints a secret value,
  and no document in `ai/context/` may contain one.
- The app needs no runtime secret. One it comes to need (a key for a service
  it calls) is set with `orun secrets set <KEY> --org <ws> --env <env>`,
  declared in `apps/api/component.yaml`'s `optionalSecretEnv` and named in
  its `runtimeSecrets` parameter, and pushed to the Worker after each deploy;
  until it is set, the route that needs it should answer that it is not
  configured rather than fail.

## Verifying the system

```bash
# the app on each environment (also recorded, probed, in deployment.md)
curl -s https://elysia-api-api-stage.vijayakrishnan12994.workers.dev/health
curl -s -o /dev/null -w '%{http_code}\n' https://elysia-api-api-prod.vijayakrishnan12994.workers.dev/

# workspace readiness (integrations + repository link)
orun integrations list --org <ws> --json && orun cloud check --org <ws>
```

## Common operations

| task | how |
|---|---|
| add a route | chain it onto the app in `apps/api/src/index.ts` before `.compile()` (`.get("/hello", …)`, `.get("/users/:id", ({ params }) => …)`, a body schema with `t.Object(...)`), a test in `tests/api`, merge |
| add a static file | add an `assets` directory to `apps/api/wrangler.jsonc` (Workers Static Assets serves it before the Worker runs); Elysia's static plugin does not run on Workers |
| deploy a change | merge to `main`; watch the run; failed lanes → `gh run rerun --failed` |
| deploy by hand | Orunbase's Deploy button, or `gh workflow run ci.yml --ref main -f environment=<env> [-f component=<a,b>]` — the named components (blank: every one) run in that environment as a merge runs them; started off `main` it is refused |
| redeploy without a change | edit the last line of `apps/api/component.yaml` (`# orun: redeploy <reason> <stamp>`) and merge — it is a deploy trigger, nothing reads it |
| rename the app | `SITE_NAME` in `apps/api/src/identity.ts` — the welcome page's title and heading, and what `/health` answers with |
| serve a custom domain | attach it to the Worker in Cloudflare (README, "Custom domain"), then replace the placeholder `elysia-api.example.com` in `intent.yaml`'s `BASE_DOMAIN` (every environment) with it; the workers.dev URL keeps answering for the smoke |
| add a runtime secret | `orun secrets set <KEY> --org <ws> --env <env>`, then declare it in the component's `optionalSecretEnv` and name it in `runtimeSecrets` |
| headless credentials | `ORUN_TOKEN` (workspace-scoped) + `GITHUB_TOKEN` |

The deployment record is the bootstrap's `02-docs` phase. Re-running it (the
Orun console's Retry on that phase) re-probes the URLs and re-renders
[deployment.md](deployment.md); it is idempotent.

## Evolution

Structural changes (a second Worker, a data store, a queue) follow the same
contract that deployed the app: add a component under `apps/`, `infra/` or
`packages/` with a `component.yaml`, land it as a pull request, and the
convergence run applies it. A Worker that reads an infra component's wiring
declares `dependsOn` on it, `mode: enforced` on `github-push-main`, so one
convergence applies the infra first.
