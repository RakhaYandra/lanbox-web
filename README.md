# lanbox-web

LANBox web UI (React + Vite). Consumes the `lanbox` API; see `lanbox-docs`
(DESIGN-SYSTEM, API-GUIDE).

## Dev (two processes)

```sh
npm install
npm run dev        # :5173, /api proxied to localhost:8080
```

Run `lanbox serve --port 8080` alongside.

## Prod

```sh
npm run build      # -> dist/
lanbox serve --web-dir ./dist
```

`VITE_API_URL` overrides the API base when served elsewhere.

## E2E (`e2e/`, @playwright/test)

Needs a sibling `../lanbox` checkout (the helper builds Go from there)
and headless-shell Chromium (`npx playwright install --only-shell chromium`).

```sh
npm run e2e        # auth, transfer, reload-resume vs real server
```

CI (`.github/workflows/e2e.yml`) checks out both repos, builds, and runs
the suite on push/PR.
