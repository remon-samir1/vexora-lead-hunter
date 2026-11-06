create unique index lead_name_city_dedupe on public.lead_records(owner_id,lower(trim(business_name)),lower(trim(city)));
alter table public.app_settings add constraint valid_limits check(daily_calls>=0 and daily_searches>=0 and max_results between 1 and 20 and monthly_budget>=0 and google_unit_cost>=0);
create index on public.lead_sources(owner_id,lead_id);
create index on public.website_audits(owner_id,lead_id);
create index on public.lead_activities(owner_id,lead_id);
-- Persistent timestamps on child records, plus normalized provenance payload checks.
alter table public.lead_sources add constraint source_payload_object check(jsonb_typeof(payload)='object');
