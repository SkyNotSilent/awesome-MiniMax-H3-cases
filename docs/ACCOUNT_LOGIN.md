# Google sign-in and saved cases

Browsing is public. Saving cases and opening the saved collection require a Google account. First sign-in automatically merges valid favorites from this browser into that account. Import receipts and batches are idempotent; successful imports are not replayed after a case is removed. Each browser's import is assigned to the first account that starts it. A failed import retains its original browser data.

## Server configuration

These variables are server-only and must never use the `VITE_` prefix:

- `AUTH_ENABLED=true` enables configured authentication; missing configuration keeps account writes unavailable.
- `AUTH_DATABASE_URL` connects a restricted application role to its own PostgreSQL database, separate from analytics.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` belong to a Google OAuth **Web application** client.
- `AUTH_ORIGINS` is a comma-separated list of exact origins, including ports for development.

Configure these production callback URLs in the same Google OAuth client:

```text
https://awesome-minimax-h3-cases.zzskysilent.com/api/auth/google/callback
https://h3-field-notes-production.up.railway.app/api/auth/google/callback
```

For local development add `http://localhost:5173/api/auth/google/callback`. Preview uses port 4173 and requires its own callback. Enable only origins that are actually served. This integration requests `openid email profile`, uses the authorization-code flow with PKCE, state and nonce, and verifies ID tokens through Google's official library. It never requests offline access or persists Google tokens. Configure the OAuth consent application's name, support contact and authorized domains before publishing it. The public privacy URL is `https://awesome-minimax-h3-cases.zzskysilent.com/privacy.html`. A testing-mode OAuth application can only admit its configured test users.

Sessions use host-only, HttpOnly, SameSite=Lax cookies, Secure on HTTPS. They expire after 30 days and their tokens are hashed in PostgreSQL. The two production hosts share accounts and favorites but have separate sessions and browser storage. The custom site's old-site import link opens the Railway host: sign in there with the same Google account, then return and refresh the custom site. No favorites or session tokens are passed between domains in URLs.

## Database provisioning and migration

Use an existing PostgreSQL instance with a new application database. Back up existing databases before provisioning. Create a separate schema-owner role for migrations and a login role for the running application. Do not reuse the analytics application's connection or modify its tables. Restrict the runtime role to CONNECT, schema USAGE and SELECT/INSERT/UPDATE/DELETE on the account tables; grant no access to analytics objects.

Using the schema-owner connection, run:

```sh
npm run auth:migrate
```

The migration creates account, session, login-transaction, favorite and import-receipt tables under a transaction and advisory lock. Re-running it is safe. Then grant the runtime role table permissions and configure its connection on the site service. Migration credentials must not be retained on the running service. Migration uses `AUTH_DATABASE_URL` from its environment; local Vite development can read a git-ignored `.env` file. Serve and migrate commands can also use Node's `--env-file` option.

Enable authentication only after migrating, granting permissions and configuring Google callbacks. Verify both locales and production hosts. Disabling `AUTH_ENABLED` preserves all cloud data and stops personal writes; it does not restore anonymous saves. Code rollback must retain the application database.

## Validation

`npm test` exercises guest gating, sign-in completion, browser imports, retries and stale account responses. `npm run test:server` exercises the PostgreSQL authentication suite when `TEST_AUTH_DATABASE_URL` is set. It creates and drops only a random isolated test schema. Never supply a production database to this suite. CI provides a disposable PostgreSQL service.

Complete a real Google sign-in on both production hosts with two test accounts, add/remove a favorite on separate devices, verify old-site import, cancel a login, and sign out. Mock-provider tests verify our session flow and database behavior; they do not establish that Google's consent configuration is working.

## Privacy and operations

The application stores Google sub, email, display name, avatar URL and favorites. Authentication responses and personal catalog responses are private and uncached. Public catalog requests do not depend on the account database. Cookie, token, email and favorite contents must never be logged or sent to analytics. The in-site privacy notice links to the repository's private reporting channel for account-data deletion requests. Operators must verify account ownership privately before deleting the user's row; foreign keys cascade to their sessions, favorites and import receipts. Never ask users to post account information in a public Issue.

Keep database backups private. Expired sessions and login transactions are removed during login operations. If database or Google access fails, public browsing remains available and personal operations report an error.
