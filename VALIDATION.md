# Validation results — 5 November 2026

- `npm run typecheck`: PASS.
- `npm run lint`: PASS, no warnings.
- `npm test`: PASS, 7 files / 110 tests. Includes authenticated qualification/draft/import/search-plan workflows on isolated SQLite, owner isolation, unknown evidence, CSV opt-outs, source provenance, duplicate handling, no-paid-call defaults, and Google field masks.
- `npm run build`: PASS, Next.js 16.4.5 production build.
- `npm audit --omit=dev`: PASS, zero production vulnerabilities reported.
- Full dependency audit: 8 moderate findings in the development-only typescript-eslint / minimatch chain; the installed upstream range has no nonbreaking fix reported by npm.
- Production HTTP smoke checks: HTTP 200 for `/login`, `/dashboard`, `/leads`, `/discover`, `/audits`, `/follow-ups`, `/analytics`, `/settings`, `/settings/integrations`, `/settings/usage`.
- Browser: configuration-state dashboard rendered; Arabic navigation labels and RTL shell available.

Supabase connection and authenticated browser access have been observed. Live cross-user RLS isolation, concurrent quota reservations and billable provider responses have not been verified against staging. Optional migration 008 for brand-profile persistence is prepared but not applied remotely. No paid provider requests were executed and no fake lead records were created in production. Remaining setup and limits are documented in SALES-WORKSPACE.md.
