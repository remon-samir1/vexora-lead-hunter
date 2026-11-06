# Implementation & validation plan

Repository inspection: empty workspace, no existing dependencies or conventions, no repository AGENTS.md found. Node.js 24 is available. Windows PowerShell requires npm.cmd.

1. Foundation: Next App Router, TypeScript strict, Tailwind, reusable shadcn-compatible Button, private shell, Supabase password authentication, session-refresh proxy, RLS migrations.
2. Discovery: provider interface, Places IDs-only Text Search, separate search jobs, atomic PostgreSQL usage reservations and hard limits.
3. Research: official-site enrichment, source records, robots-aware DNS-pinned network fetching, HTML audit evidence, transparent scoring and manual adjustments.
4. Sales: lead forms, filtering/sorting/pagination, contact links, optional Anthropic drafts/manual fallback, opt-out enforcement, activity timeline.
5. Operations: overview and cohort charts, follow-ups, CSV export, usage settings, profiles, security headers, persistent request limits, tests and setup docs.

Phase checks were deferred while the initial dependency installation was pending. Do not treat implementation as verified until typecheck, lint, tests and production build all pass. Live RLS and provider verification additionally require credentials. See README for current scope and setup.
