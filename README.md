# PulseFX client and partner portals

React portals with Supabase email/password authentication for partner accounts and separate public client and partner demos.
Partner access requires a row in `public.partner_memberships`. Authenticated referrals load from Airtable through a Supabase Edge Function. Other business screens and public demos use sample records.

Built with React, Vite and Tailwind CSS v4.

## Run it
    npm install
    npm run dev        # then open the address it prints (usually http://localhost:5173)

Requires Node 24 LTS.

## Screens
- Dashboard: Quick Quote, USD/CAD rate trend, holding accounts (USD, EUR, GBP) with balances, payments and trades in progress, help tooltips
- Move Money: one page with a toggle between sending a payment and converting between your own accounts; fund from a holding account or by direct debit from a verified linked bank account
- Beneficiaries: masked account numbers, search, add and edit beneficiary form, CSV export
- Accounts: holding accounts (flags and balances, details side panel, certificate download demo) and a Linked bank accounts tab (new accounts show as Pending until PulseFX verifies them)
- Forwards: list of forward contracts with optional columns, and a two-step Drawdown form funded from a holding account
- Trade Finance: supplier payment finance with credit line, submitted requests, repayments, early-repayment calculator and a New request form
- Reports: payment tracker (progress by step) and payment history with CSV export (the CSV download works)
- Help & support, Profile and Security settings

## Things to know
- Exchange rate: fetched from Frankfurter (European Central Bank reference rates). These update once a day, so this is
  the latest official market rate, not a live price. If the service can't be reached the demo shows a labelled sample rate.
  A real build would use the vendor's quote API. Only `src/lib/fx.js` needs to change.
- Logo and colours are placeholders (a recreated pulse-line mark and a placeholder palette in `src/index.css`) until PulseFX's
  official brand assets are applied.
- Navigation uses simple in-page state, not a router.
- Forwards, Trade Finance, deposit rules, holidays, fees (about 1.5%) and the minimum finance amount are invented sample values pending confirmation with PulseFX.
- All state (new beneficiaries, linked accounts, drawdowns, finance requests) is kept in memory and resets when the page reloads.
- Partner sign-in validates credentials with Supabase and verifies partner membership. Client sign-in remains a demo.

## Partner login setup

1. Create a local `.env.local` file with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, filled with your Supabase project URL and publishable key.
2. Run `supabase/migrations/20261106224500_create_partner_memberships.sql` in the project's SQL Editor once.
3. In Supabase Authentication settings, disable public signups and anonymous sign-ins. Create authorized test accounts in Authentication > Users.
4. Grant accounts membership in the SQL Editor. Use the actual Airtable partner record ID when available.
5. Start the app and choose Partner portal > Login. Invalid credentials and accounts without membership are rejected.

Example membership assignment for an existing account:

```sql
insert into public.partner_memberships (user_id, partner_id)
select id, 'REPLACE_WITH_PARTNER_RECORD_ID'
from auth.users
where lower(email) = lower('REPLACE_WITH_AUTH_USER_EMAIL')
on conflict (user_id)
do update set partner_id = excluded.partner_id
returning user_id, partner_id;
```

The membership table uses row-level security. Authenticated users can read only their own membership and cannot create or change assignments.
The UI restores and revalidates the session on reload at `#partner`; logout clears this browser's partner session.
`#partner-demo` opens the public partner demo. Use the Explore a demo dropdown for either public demo.

## Partner referrals: Airtable setup and deployment

The `referrals` Edge Function validates the caller's access token with Supabase Auth, then reads their `partner_memberships` row with the same token and RLS. It never accepts a partner ID from the browser. No service-role key is needed.

In the Airtable base, keep these exact table/field names:

- `Partners`: `Name` (primary text), `Partner ID` (formula `RECORD_ID()`), and `Referrals` (the reciprocal link to referrals).
- `Referrals`: `Company` (primary text), `Partner` (single linked record to `Partners`), `Contact` (text), `Email` (email), `Country` (text), `Status` (single select), `Created` (created time), and `Last modified` (last modified time watching all editable fields).
- Status options: `Invited`, `Account created`, `Documents submitted`, `Under review`, `Onboarded`, `Rejected`. The UI derives Onboarded from Status.

Create an Airtable personal access token with `data.records:read` and access only to the test base. In Supabase **Edge Functions > Secrets**, set:

| Name | Value |
| --- | --- |
| `AIRTABLE_TOKEN` | Airtable personal access token |
| `AIRTABLE_BASE_ID` | Base ID starting with `app` |
| `AIRTABLE_REFERRALS_TABLE_ID` | Referrals table ID starting with `tbl` |

The function uses `Partners` as the partner table name. Optionally set `AIRTABLE_PARTNERS_TABLE_ID` to its table ID if that table is renamed. Supabase supplies `SUPABASE_URL` and `SUPABASE_ANON_KEY` to deployed functions automatically.

Set the account's `partner_memberships.partner_id` to the actual Airtable Partner record ID (`rec...`) using the SQL above. Provisional values such as `pilot-a`, `pilot-b`, or user UUIDs do not grant Airtable access.

From the repository root, deploy with the Supabase CLI:

```sh
npx supabase login
npx supabase functions deploy referrals --remote=YOUR_PROJECT_REF --use-api
```

`YOUR_PROJECT_REF` is the prefix of your Supabase project URL (`https://YOUR_PROJECT_REF.supabase.co`), also available in project settings. Deployment reads `supabase/config.toml`, where the legacy gateway JWT check is disabled because the function validates the user token itself through Auth. Missing or invalid tokens are still rejected before reading any partner data. The frontend workflow deploys only GitHub Pages; the Edge Function must be deployed separately.

The function reads the partner's reciprocal `Referrals` links, requests only those record IDs in batches, follows Airtable pagination, and verifies each referral has exactly the authorized `Partner` link before returning it. It returns only fields used in the list, details and CSV export. Dates are normalized to `YYYY-MM-DD` using the Airtable timestamp's UTC date. A missing last-modified timestamp falls back to the creation date.

To test manually after deploying:

1. Run `npm run dev`, sign in through the real partner login, and open **Referrals**. For the configured ABC Accounting account, expect eight referrals and no Maple Test Co. or Cedar Test Ltd.
2. Check company/status/date filters, sorting, company details and Download Excel (an Excel-compatible CSV of the filtered rows).
3. Change a referral status in Airtable, then click **Refresh**. Native Created/Last modified fields use real timestamps, so sample records created together will have the same creation date.
4. Sign in with an account assigned to Other Partner and expect only its two referrals. An account without a membership must be rejected; provisional partner IDs must show a configuration error.
5. Verify an empty partner shows **No referrals yet**, and a failed API request shows an error with **Try again**, without substituting demo data.
6. Open `#partner-demo` and confirm the public sample list still works without authentication.

Authenticated referrals are read-only. **Add a client**, dashboard counters and other portal screens remain demonstrations and do not write to Airtable.

## Partner administration and manual invitation links

The profile menu exposes **Administration** only to accounts with server-managed `app_metadata.role = partner_admin`. Admin accounts can enter without a partner membership. `#partner-admin` opens the authenticated portal. The former `#partner-admin-demo` address now also requires sign-in; administration has no sample records or generated demo links.

For live operation on the intended Supabase project:

1. Apply all migrations in `supabase/migrations`, in filename order. `partner_registrations` stores provisioning progress and has no browser access. The service-only summary function checks whether the Auth account has a confirmed email and a password; neither passwords nor their hashes are returned.
2. Create the initial administrator account and assign `app_metadata.role = partner_admin` through the trusted Auth Admin API (preserve other app metadata). Assign this to the verified PulseFX administrator, initially `partnerships@pulsefx.com`. Email matching and user-editable metadata do not grant this role. Do not grant partners this role.
3. In Airtable `Partners`, add **Portal ID** as a single-line text field alongside **Name** and **Referrals**. Portal ID is the stable registration UUID used for upsert retries; do not make it a formula. Give the function's Airtable token `data.records:read` and `data.records:write` access to the intended base.
4. Set Edge Function secrets `AIRTABLE_TOKEN`, `AIRTABLE_BASE_ID`, and **PORTAL_URL** (the full deployed portal address including its base path, for example the address ending `/pulseFx/`). Optionally set `AIRTABLE_PARTNERS_TABLE_ID`. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to hosted functions. These credentials must never have a `VITE_` prefix or appear in frontend configuration.
5. Allow the portal URL in Auth redirect settings. Keep public signup and anonymous sign-in disabled. Choose the Email OTP Expiration and password policy in Auth settings.
6. Deploy `partner-admin` separately with CLI v3: `npx supabase functions deploy partner-admin --remote=YOUR_PROJECT_REF --use-api`. Deploy the frontend with the matching project's public configuration. Local source changes do not deploy or migrate any remote project automatically.

**Add partner → Confirm and generate link** registers the contact, creates a passwordless Auth account and Airtable partner, assigns membership, then generates a private invitation link. The administrator copies it and shares it directly with the contact. No SMTP or automatic email is used. The portal verifies the link when the recipient opens the page. A valid link is consumed at that point, and the password form uses the resulting in-memory session. Used, expired or invalid links show an explanation before any password fields appear. Activation uses a separate in-memory Auth client so an existing admin session in the same browser is preserved.

**Actions** contains icon buttons with hover descriptions for copying a fresh invitation link, deactivating/reactivating a login, and deleting a login. Deactivation revokes membership access through RLS as well as banning Auth sign-in; reactivation restores access. Delete permanently removes the Auth user while retaining the Airtable partner/referral history and a hidden registration so the same partner can be registered again without duplicating Airtable records. Both deactivation and deletion require confirmation. Administrator accounts cannot be changed through these actions.

**Generate invitation link** is available for accounts awaiting activation and incomplete setups. Provisioning resumes from saved progress with a short lease to prevent concurrent duplicates. Airtable upserts use Portal ID so retries after interrupted responses reuse the same record. Existing unrelated Auth accounts are rejected instead of silently linked. Active accounts cannot receive activation links. No invitation tokens/links are persisted in the database or browser storage.

Before enabling this feature, test on the clean target environment: sign in as admin, register a contact, copy/open the link in another browser, set a password, sign in as that partner, verify referral isolation, and refresh the admin list to see **Active**. Also test expired links, link regeneration, a normal partner calling the admin API (must fail), and retrying an interrupted setup. This first version lists partners registered through the portal; it does not import legacy manual memberships. Password recovery for active partner accounts is handled by an administrator using the key action in Actions; no automatic email is sent.

`npm run lint:admin` checks the new frontend and `npm run test:admin` tests authorization, activation guards, resumable provisioning and safe failures using mocked upstream services. Live Auth, database and Airtable deployment checks remain necessary.

## GitHub Pages deployment

The Portal checks and deployment workflow checks pull requests, then builds and publishes `main` through GitHub Pages after merge.
In Settings > Secrets and variables > Actions > Variables, configure:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

These values are public frontend configuration. Passwords, Supabase secret/service-role keys and Airtable tokens must stay on the server.
Before merging, a repository administrator must change Settings > Pages > Build and deployment > Source to **GitHub Actions**. The current site uses the legacy `gh-pages` branch. The workflow uses the official Pages deployment action because pushes made with `GITHUB_TOKEN` do not trigger legacy Pages builds. The site keeps its existing `/pulseFx/` base path.
Deployment fails before publishing if the Supabase variables are missing. Database migrations and account creation remain administrator steps.
If the administrator keeps legacy branch publishing instead, configure `.env.local` on the publishing machine and use the existing `npm run deploy` command. Do not use both publishing methods at the same time.

## Validation and first-version scope

- `npm run lint:auth` checks the authentication entry points and shared navigation.
- `npm run lint:referrals` checks the partner portal and referrals client.
- `npm run test:auth` checks authenticated membership lookups, missing memberships and lookup failures.
- `npm run test:referrals` also checks the Edge Function's authorization, partner isolation, batching, pagination, malformed data, and upstream failures using mocked services.
- `npm run build` checks the production build. The full `npm run lint` currently reports existing issues in the demo components.
- Manually check valid partner sign-in, invalid credentials, an account without membership, reload at `#partner`, logout and both public demos.

Client authentication and partner business screens other than Referrals and Add a client remain demonstrations. Partner administration and manual password recovery are implemented.
No Airtable credentials or production referral data are included. Deploy `supabase/functions/referrals` separately to enable authenticated referrals.

## Partners_api mirror

`partner-sync` mirrors the business/account summary from Supabase to the configured `Partners_api` table. Fields are **Name**, **Portal ID**, **Contact**, **Email**, **Supabase User ID**, **Account status**, **Registered at** and **Deleted at**. Keep **Referrals** as the existing reciprocal link; the worker never writes that field. Contact, Portal ID and Supabase User ID are single-line text; Email is an email field; Registered at and Deleted at are dates with time. Account status is single select with `Setup incomplete`, `Awaiting activation`, `Active`, `Deactivated`, `Deleted`.

Apply `20261114001500_partner_airtable_sync.sql` after the other migrations. It installs a server-only durable queue, registration/Auth triggers and a once-per-minute retry schedule. Updates to registration business fields, password/email confirmation and Auth bans enqueue a fresh revision. The worker writes in batches of at most ten and verifies all returned values before marking a revision synchronized. Existing registrations are backfilled, including deleted logins. An older in-flight update cannot acknowledge a newer queued revision.

Deletion of the Auth user preserves the business record and sets `Deleted` in Airtable; the removed user's Supabase ID is cleared. Re-registering the same partner reuses Portal ID and clears Deleted at. Supabase remains the authority for permissions; editing the Airtable status does not grant or revoke access. Passwords, password hashes, invitation links, Auth metadata and session tokens are never sent to Airtable.

Deployment also needs a randomly generated `PARTNER_SYNC_SECRET` in Edge Function secrets and the same value in Supabase Vault under `partner_sync_secret`. Store the project URL in Vault as `partner_sync_project_url`. These server-only values authenticate the queue worker; never put them in frontend environment variables. Deploy with `npx supabase functions deploy partner-sync --remote=YOUR_PROJECT_REF --use-api`. The function has gateway JWT verification disabled because it validates its own dedicated credential. User JWTs cannot invoke it. The Airtable PAT still only needs record read/write access to the configured base; no schema permissions are required.

Registration/Auth triggers dispatch after the transaction commits through pg_net. Cron retries due jobs every minute; failures use bounded exponential backoff and honor Airtable rate limits. The admin list reports pending updates; Refresh reloads their state. Sync never delays or reverses access revocation. To inspect pending work, query `partner_airtable_sync` using an administrative connection. `select public.dispatch_partner_airtable_sync()` requests a retry of due work without exposing credentials.

`npm run test:admin` includes worker authorization, field whitelisting, all lifecycle states, batching, idempotent upserts, response verification and retry tests. `supabase/tests/partner_airtable_sync.sql` verifies database triggers, activation/deactivation/deletion and concurrent revisions inside a fully rolled-back transaction; its fixture records and queued HTTP calls are never committed or sent to Airtable.


## Manual partner password recovery

The blue key in **Actions** generates and copies a password reset link for an active partner account. If clipboard access is unavailable, a dialog displays the link for manual copying. The administrator verifies the request and sends the private link directly to the registered email address. Disabled accounts must be explicitly reactivated first; deleted, incomplete and unactivated accounts cannot receive recovery links. Administrators cannot generate recovery links for themselves or other administrator accounts through this partner endpoint.

The `partner-admin` recovery action revalidates the caller's admin role, acquires the account lease and verifies the current Auth user, registration ownership and active state. It calls `generateLink(type: recovery)` without creating accounts, altering memberships, reactivating users or sending emails. The existing password is changed only when the recipient verifies the link and submits a new password in the portal. This action requires PORTAL_URL and Auth configuration, independently of Airtable availability.

**Forgot password?** now explains how to contact partnerships@pulsefx.com, with a mailto link that the user chooses to open. It does not submit a public account lookup or claim that an email was sent. The access-link screen distinguishes recovery from first activation, handles invalid/expired links, and uses its separate in-memory Auth client so an administrator's browser session is preserved. After reset it requests global sign-out for the recovered user and directs them to sign in with the new password.


Access-link verification is deduplicated per page instance, including React Strict Mode effect replay. The password form is hidden until verification succeeds. A saved password cannot be submitted a second time through the same page flow; password-policy corrections may reuse the verified in-memory session before success. Network failures show a retry option rather than incorrectly reporting expiry. Closing or reloading the page before completing password setup may require a new link because the verification session is intentionally not persisted. This is covered by `src/lib/partnerAccess.test.mjs`.


## Add a client

Authenticated partners can save a client through `POST /functions/v1/referrals`. The function validates the Auth session and resolves an enabled partner membership through RLS; partner IDs and status supplied by the browser are rejected. The Airtable token stays in Edge Function secrets. Public preview submissions remain in memory and never call this endpoint.

In `Referrals_api`, retain Company, Partner (single link to Partners_api), Contact, Email, Country, Status, Created and Last modified. Add **Expected monthly volume** (single select: `Under CAD 50,000`, `CAD 50,000 to 250,000`, `CAD 250,000 to 1,000,000`, `Over CAD 1,000,000`), **Currencies** (multiple select: CAD, USD, EUR, GBP, AUD, MXN, Other), **Other currency** (single-line text), and **Notes** (plain long text). Existing records may leave these fields empty. The API writes only these form fields, the verified Partner link and initial status `Invited`; Airtable maintains timestamps. Saving does not send an invitation email or create a client Auth account.

Company/contact are limited to 200 characters, email to 254, Other currency to 60, and notes to 5,000. Other currency is required when Other is selected and discarded when hidden. Server-side validation enforces the supported country/volume/currency choices. The client disables submissions during a save, preserves form values on errors, and shows success only after Airtable confirms creation. Details and Excel export include all saved fields.

Before writing, the endpoint checks the partner's linked referrals for a matching company name (trimmed and case-insensitive). This blocks ordinary repeat submissions; it is not an atomic cross-request uniqueness constraint. If a write times out, check Referrals before retrying because Airtable may have accepted it. Concurrent submissions from separate tabs should not be used to submit the same client.

Deploy the updated `referrals` function after adding the fields. Existing Airtable record read/write permissions are sufficient; schema permissions are not required. `npm run test:referrals` covers POST validation, ownership, duplicate checks and upstream errors as well as read isolation.
