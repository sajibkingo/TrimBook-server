# TrimBook

Barber/salon booking app: two sibling folders, **two separate git repos**, no workspaces, no root manifest, no CI, no tests.

- `trimbook-server/` — Express 5 API on :5000. Lives in *this* git repo; commit its changes from the repo root.
- `trimbook-client/` — Next.js 16 app on :3000. **Its own git repo** — run git from inside it. Read `trimbook-client/AGENTS.md` before touching it; it's authoritative for client work (layout, auth flow, lint/typecheck/format quirks, the Next.js 16 local-docs warning).

## Commands

- Server has **no npm scripts**. From inside `trimbook-server/`: `nodemon index.js` (nodemon is installed *globally*, not in its package.json; plain `node index.js` also works). It's ESM (`"type": "module"`).
- cwd matters: `dotenv` loads `.env` from the current directory — running from the repo root silently starts the server with no env vars.
- Server verification: `node --check index.js`. There is no lint or typecheck on the server.
- Client verification: `cd trimbook-client && npm run lint && npm run typecheck`. JSX pages aren't type-checked; lint is the only gate for them.
- Feature work needs both servers running (`npm run dev` in the client); `apiRequest()` calls fail with a network error if the backend isn't up.

## Server gotchas (`trimbook-server/index.js`)

- Every route is registered **inside `startServer()`** after the MongoDB connect — add new routes in there, not at module top level.
- Boot exits if Mongo is unreachable or `STRIPE_SECRET_KEY` is missing (the Stripe client is constructed unconditionally).
- Auth does **not** verify a JWT: `middlewares/verifyToken.js` looks the Bearer token (or the `better-auth.session_token` cookie fallback) up in better-auth's `session` collection. Client and server must point at the same MongoDB (db `trimbook`). Don't "fix" it into JWT verification.
- Admin endpoints are registered under two paths each (e.g. `/api/admin/users` *and* `/api/users/admin/all`); gating is `verifyToken` + `verifyAdmin`.
- Express 5: path syntax differs from 4 — no bare `*` wildcards.
- Adding a new backend file/dir? Add it to `nodemon.json`'s `watch` list (nodemon reads it only at startup) or the server won't restart on those changes.

## Git quirks (this repo)

- `git status` shows hundreds of pre-existing deletions: the old root-level `index.js` / `middlewares/` / `package.json` / … left over from the server's move into `trimbook-server/`, plus a `node_modules` that was committed and later removed from disk. Not your mess — don't `git add -A`, `git restore`, or commit it unless explicitly asked.
- `trimbook-client` is tracked as a gitlink with no `.gitmodules`, so `git submodule` commands fail by design. Commit client work from inside `trimbook-client/`.
