# KHE Booth — Phase 2A-B deployment status

Phase 2A-B has been merged into `main` and the production Neon migration has been applied successfully.

Before real camera capture is started, the deployment gate requires:

- GitHub Actions on `main`: migrations, lint, unit/integration/e2e tests and build must pass;
- Vercel API production must deploy the current `main` commit successfully;
- `/api/health` must return HTTP 200 with database status `ok`;
- production runtime must have no new fatal/error cluster;
- station activation/sync routes must be present in the deployed API.

A fresh production deployment retry was triggered on 2026-08-15 after the previous Vercel build-rate limit was reported as cleared.

Real camera/video capture remains blocked until this production gate is fully green.
