# Sales workspace update — 5 November 2026

Implemented: 13 Saudi regions and 34 named cities, searchable Arabic choices, custom cities, up to 10 cities per plan; 18 business categories with specialties; saved search plans; manual Maps links; optional single-request automatic discovery; sector/service-specific message previews; evidence-based qualification; advanced CRM filters; CSV import; manual sales outcomes; A/B summaries; and next-action suggestions.

Each lead has 12 draft types in Arabic/English: first contact, WhatsApp, email, follow-up, final follow-up, discovery questions, evidenced improvements, service scope, proposal outline, and responses to price, timing and existing-provider objections. Standard templates need no paid model calls. Missing prices, timelines, success stories and guarantees are never invented. Real matching portfolio examples can be attached when supplied.

Qualification snapshots use existing owner-protected lead_sources records, with source/evidence, contact person, need, client-stated budget/scope/timing, branch/parent relationships, exclusions and next step. Unknown information remains unknown. Fit/need/contact/decision-maker/interest scores show evidence coverage and the remaining possible range. Incomplete data cannot automatically qualify a hot lead. Empty website fields no longer count as confirmed absence. Existing manually adjusted website scores remain visible.

Saved plans use existing search_jobs records with saved/archived status; reopening a plan never calls Google. Sequential duplicate saves reuse the existing plan. Existing duplicates are not deleted. No new migration is required for core targeting, qualification or draft generation.

Advanced CRM filters cover city, activity, site state, verified contact, evidence coverage, priority, service, and company type. Opt-outs and exclusions block drafts and new follow-ups. Shared contact/domain/parent information produces review hints without merging records automatically.

CSV import validates the complete file before writing, starts contacts unverified, preserves explicit opt-outs, detects duplicate business/city records and records the supplied source. Individual database failures are reported; imports are not one database-wide transaction. Limit: 200 leads, 512 KiB.

Outreach outcomes are recorded manually; draft creation never counts as contact. A/B summaries count unique clients per recorded outcome, without claiming that wording caused the result. Sector/city analytics and next actions come from actual owned records.

## Optional cloud migration

Existing Supabase projects need only `supabase/migrations/008_sales_profile.sql` to persist the optional Vexora company/sender/portfolio settings. It adds owner-scoped sales_profiles with RLS. The UI explains when migration is missing and keeps default playbooks working. This migration has not been applied remotely by the agent. Do not rerun SETUP_ONCE.sql on an existing project.

The earlier 007 migration is only needed for future automatic Pro previews. GOOGLE_REQUESTS_ENABLED remains false at the user's request. No live Google or paid AI requests were executed. Exclusion keywords apply only to transient displayed results, not provider-side search. CRM data remains independently sourced; Google names/addresses are not persisted.

## Validation and limits

Local API integration tests use isolated SQLite databases. No fake leads are inserted into the live Supabase project. Browser review confirms the translated controls, multi-city targeting, dynamic message previews and disabled automatic-search button. Full translation of older dashboard/audit/settings copy is not part of this update. Cloud brand-profile migration, live cross-user RLS isolation and provider responses still need staging/admin verification. Business size, budget and intent require independent verification or client statements.
