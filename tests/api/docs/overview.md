# api-tests

The app's vitest suite (the home page under the site's name, HEAD /, /health and its environment, Elysia's own 404, the site's name), the app module that ships called with web-standard Requests on Node, run with pnpm test

The test suite for **api**. It deploys nothing: its lane installs, builds and runs the tests.

|              |                      |
| ------------ | -------------------- |
| Type         | `turbo-package`      |
| Source       | `tests/api`          |
| Package      | `@app/api-tests`     |
| Environments | `dev`: `quick-check` |

## Depends on

- (none)

## Depended on by

- (none)
