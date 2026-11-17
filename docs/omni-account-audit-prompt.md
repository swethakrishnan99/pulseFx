Update the connected PulseFX Supabase project using the latest source from the `feat/admin-layout-and-session-timeout` branch of `swethakrishnan99/pulseFx` (PR #24). Do not change real accounts, send invitations, or create test users in production.

User management now needs persisted, server-verified audit details for both Partners and Admins: Created by, Deactivated at, and Deactivated by. The frontend uses an em dash (—) when no audit information exists. Do not infer historical actors or deactivation dates from Auth updated_at or banned_until.

1. Run this SQL directly in the connected database. There are no migration files to apply. If this table already exists, inspect its schema and permissions before proceeding; do not drop or overwrite existing audit data.

```sql
create table if not exists public.portal_account_audit (
  account_kind text not null check (account_kind in ('partner', 'admin')),
  account_id uuid not null,
  event text not null check (event in ('created', 'deactivated')),
  actor_id uuid not null,
  actor_email text,
  occurred_at timestamptz not null default now(),
  primary key (account_kind, account_id, event)
);
alter table public.portal_account_audit enable row level security;
revoke all on public.portal_account_audit from public, anon, authenticated;
grant select, insert, update, delete on public.portal_account_audit to service_role;
```

2. Deploy these three Edge Functions from the updated repository source, including their shared imports:
   - `partner-admin`
   - `partner-invitations` (it reuses partner-admin's creation handler)
   - `pulsefx-user-admin`

Include `supabase/functions/_shared/account-audit.mjs` and the updated `partner-admin/service.mjs`, `pulsefx-user-admin/service.mjs`, `pulsefx-user-admin/actions.mjs`, and `pulsefx-user-admin/invite.mjs`. Preserve existing secrets, configuration, gateway JWT settings and all current authorization checks. Do not recreate or change unrelated RPCs.

3. Verify that anonymous and authenticated browser roles cannot read or write the audit table. Only service_role should have access, through existing admin-verified handlers. Do not add browser RLS policies. Do not expose secrets, tokens, invitation URLs, or unrelated Auth metadata in verification output.

The partner account_id is the partner registration ID; the admin account_id is the Auth user ID. Actor ID/email come only from the server-verified caller. Creation and current deactivation snapshots use first-write-wins to preserve the original actor and timestamp on retries. Reactivation clears the current deactivation snapshot while retaining the creator; this table is not a complete historical event log. Existing accounts without snapshots must remain unknown. The displayed account creation timestamp still comes from Auth, not the audit snapshot.

4. Report the SQL and function deployment results and any blockers. Use read-only checks in production; run mutation tests only in an isolated non-production environment. Frontend code also needs its normal application deployment to display the new fields; do not assume publishing Edge Functions deploys the frontend.
