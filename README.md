# VEXORA LEAD HUNTER

Private Next.js App Router / strict TypeScript / Tailwind / Supabase workspace. There is no seeded production data. Provider calls run on the server.

## Local setup

1. Install Node.js 22+ and run `npm install` (`npm.cmd` on PowerShell systems that block npm.ps1).
2. Copy `.env.example` to `.env.local`. Set your Supabase URL and public anon/publishable key. Never use a service-role key here.
3. Apply all SQL files in `supabase/migrations` in order with the Supabase SQL editor or migration tooling.
4. Disable public signups in Supabase Auth. Create/invite your internal users and set their passwords in Supabase. Configure Auth rate limits and production redirect URLs.
5. Run `npm run dev`, open http://localhost:3000/login, and sign in.
6. Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` before deployment. Deploy to a Node.js-compatible Next.js host, set environment variables, then run `npm start` when self-hosting.

Without Supabase configuration, the dashboard shell and integration instructions can be viewed, but no data access or provider calls succeed. Missing configuration never selects a fake database.

## Integrations

- **Google Places API (New)**: `GOOGLE_PLACES_API_KEY`, restricted to Places API on your server. Search uses `POST /v1/places:searchText`, `X-Goog-FieldMask: places.id`, region SA. No business names, contact fields, photos, ratings, addresses, or Google website URIs are stored. Only IDs, your own query, and job status persist in a separate table. CRM creation is independent and manual. Additional licensed providers implement `DiscoveryProvider`. Field-mask reference: https://developers.google.com/maps/documentation/places/web-service/choose-fields
- **Cost controls**: discovery is disabled initially. Usage settings require positive daily limits, monthly budget, and a conservative USD per-call cost estimate. No free-tier assumption is made. A PostgreSQL advisory lock serializes each user's usage reservations before external calls; failed calls consume the reservation. SQL aggregates the full month even if the UI displays fewer records. Use Google Cloud billing budgets and project quotas as an additional account-wide control: local estimates are not provider invoices and cannot include activity from other applications or users.
- **Anthropic**: optional `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` configured to a model your account can access. Claude subscriptions do not supply API credits. Calls use the Messages API; without configuration the assistant supplies an editable generic manual template. No message is automatically sent. https://platform.claude.com/docs/en/api/overview
- **Website audits/enrichment**: direct server requests to the independently entered official website only; confirm permission and respect site terms. robots.txt is checked. All DNS answers must be public; connections are pinned to a validated address. Redirects are revalidated, requests time out, and bodies are size-limited. Findings are HTML observations, not Lighthouse scores. Mobile viewport presence does not prove good mobile usability. Portfolio, service quality, navigation usability, and performance remain unavailable pending review/instrumentation. Public mailto, tel, and official social/WhatsApp links are captured as unverified source records. Enrichment never silently overwrites CRM contacts.
- **Contact**: verified independently entered email and telephone values become mailto/tel links. Verified official WhatsApp source links open wa.me with an encoded editable message. Review and send manually. Opt-out blocks draft generation/contact actions.

## Data protection

Every data table has RLS. Child rows reference `(lead_id, owner_id)` to prevent cross-owner associations. Each user owns their records; this is not a shared multi-user sales team database. All authenticated API operations have a database-backed 30/minute limit. Supabase Auth handles login rate limits. Private responses are no-store, mutations require matching Origin, and CSV cells are formula-neutralized. Audit history records lead mutations through a database trigger. API usage reservations are read-only to clients.

Deploy behind HTTPS. No secrets should be logged. Keep backups and manage retention for your business records; rotate provider credentials using host environment settings. Do not store restricted Google content in manually entered CRM fields. Place ID results contain no Google place display content; any future display of such content must implement the current attribution and retention requirements before use.

## Verification scope

Unit tests exercise scoring, unknown evidence, private network classification, input validation, and spreadsheet injection. Build/type/lint checks are local. Live Supabase RLS, concurrent quota reservations, authenticated browser journeys, and billable provider calls require a configured staging project and credentials. SQL migrations are included but never applied to an unknown remote project automatically.

## Current limitations

### Discovery update

`GOOGLE_REQUESTS_ENABLED=false` disables automatic Google requests at both the route and provider boundaries. It is currently disabled at the user's request; no live or billable discovery tests were executed. The discovery page offers an ordinary Google Maps link for manual research, without scraping or importing Maps content.

Automatic discovery defaults to IDs-only. Explicitly opting into the names/address preview selects Text Search Pro with only ID, display name, formatted address, and attribution fields. No contact, website, ratings, reviews, or photo fields are requested. Preview data is held only in the current component state and sent with no-store headers. Search history persists only the user's query, job status, and unique place IDs. Preview content is never used to prefill CRM fields or included in CSV exports.

Before future activation, obtain explicit budget approval, finish provider billing, configure usage settings with a conservative per-call estimate, and set the server flag to true. Existing Supabase installations must apply `supabase/migrations/007_google_preview.sql` once to enable the dedicated Pro reservation function. That incremental migration has been prepared but has not been applied remotely. IDs-only reservations keep using the existing function. Both modes share daily/monthly limits and log their respective SKU. Missing migrations or exhausted budgets fail before any provider call.

The new privacy and terms pages are unauthenticated. They describe the current internal workflow and link Google terms/privacy; a public deployment still needs appropriate company contact and retention details. Live end-to-end provider verification remains outstanding.

Arabic navigation and RTL layout are provided; full translation of workspace content remains outstanding. HTML checks are deliberately limited and do not replace a visual browser or performance audit. Attribution for future Google rich content, field-by-field manual provenance editing, advanced monthly funnel charts, usage warnings, and a comprehensive staging integration test suite need further work before a production readiness claim.

