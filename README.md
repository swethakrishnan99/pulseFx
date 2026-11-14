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

## Banking details and payout history

`partner-banking` verifies Auth and the caller's enabled partner membership through RLS. It uses the existing server-only AIRTABLE_TOKEN and AIRTABLE_BASE_ID. Table names default to `Banking_details_api` and `Payouts_api`; optional AIRTABLE_BANKING_TABLE_ID and AIRTABLE_PAYOUTS_TABLE_ID secrets can override them with table IDs. Deploy this function after creating both tables; no new browser variables or database migrations are needed.

`Banking_details_api` fields: Submission ID (primary text), Partner (single link to Partners_api), Partner ID (text), Institution name (text), Account holder (text), Account number (text), Institution code (text), Transit number (text), Currency (single select: CAD), Status (single select: Pending verification, Verified, Rejected), Current account (checkbox), Review notes (plain long text), Submitted at (created time with time), Last modified (all editable fields, with time).

The portal appends each change as a new Pending verification submission with Current account unchecked. It never overwrites older submissions or changes approvals. Staff review the details in the portal under Banking approvals. Approval marks the selected submission Verified/current and clears the previous current flag. Manual Airtable review is still possible by applying those same status and flag changes, but should not run concurrently with portal reviews. Keep only one verified account current per partner. The portal reports multiple flags or a flag on an unverified submission as requiring PulseFX review; it does not pick an account automatically. Rejected submissions can include Review notes visible to the partner. Changing a verified account without marking it current does not replace the existing current account.

Account and institution/transit numbers are text so leading zeros survive. The current form supports CAD, a 4–34 digit account number and separate Institution code (3 digits) and Transit number (5 digits) inputs. The API reads and writes Institution name, Institution code and Transit number directly. The legacy Institution and transit number field is retained in Airtable for history but is no longer read or written by the portal. The form order is account holder, institution code, institution name, transit number, account number. Account numbers are returned in full only after verifying the authenticated partner membership and ownership of each record. Account cards/history display the full number and the update form prefills it, preserving leading zeros. Responses use Cache-Control: no-store. Full numbers are stored in the Pulse Airtable base for authorized review and are not logged or included in errors. Keep base access restricted to the appropriate Pulse team.

The browser keeps a random submission ID for an unchanged retry; an existing submission returns its original result without resetting approval. This is an application-level retry check, not a database uniqueness constraint across concurrent requests. Refresh after an uncertain timeout before starting a separate submission. The server rejects caller-supplied partner IDs, status, current flags and review notes.

`Payouts_api` fields: Reference (primary text), Partner (single link), Partner ID (text), Client (text), Amount (CAD currency), Currency (single select: CAD), Status (single select: Pending, Paid, Failed, Cancelled), Paid at (date with time), Notes (plain long text). Staff maintain payouts in Airtable; the portal does not initiate or modify payments. For staff-created payout rows, set both Partner and Partner ID to the same linked partner used by Banking_details_api (Partner ID is the Airtable `rec...` ID, not the Supabase Portal ID). Reads filter by Partner ID and also check the actual linked record. Inconsistent rows are excluded. The separate Payout history section loads only when expanded and exports the displayed records as CSV. Total paid includes only Paid rows in CAD.

Public preview banking stays in local component memory. Authenticated users see real empty states rather than demo accounts/payouts. Run `npm run lint:banking` and `npm run test:banking`; CI includes both.

### Admin banking approvals

Administrators now have a separate sidebar with User management and Banking approvals. The review list is available only to a caller whose Auth-verified `app_metadata.role` is `partner_admin`; email matching and user-editable metadata do not grant access. Ordinary partners retain their own banking screen and cannot read the review list or mutate approvals.

`GET partner-banking?view=review` lists submissions, partner contact information, current flags, review notes and full bank details. The initial filter is Pending verification. `POST` on this view accepts only a bank record ID, approve/reject action, notes and the expected Last modified timestamp. Rejections require a reason. Reviews of stale/inconsistent or invalid account details are rejected. Existing records keep their bank data and submission IDs.

Approval clears previous current flags for that partner, marks the selected pending submission Verified/current, and checks the resulting state before confirming. Rejection leaves the current account unchanged and marks only the pending submission Rejected. Repeated confirmed decisions do not rewrite bank data. Staff should use the portal for reviews; direct concurrent Airtable edits do not participate in the portal lock.

Apply `20261114130000_banking_review.sql` before deploying the updated partner-banking function. It creates server-only review leases and an audit table. A per-partner lease prevents simultaneous portal reviews, renews before writes and expires after five minutes if interrupted. Successful decisions record the administrator's Auth ID, target record ID, partner ID, action and time in banking_review_events, without copying account numbers. Neither anonymous users nor authenticated partner clients can call the lease/audit functions or read the tables. The function uses the existing Supabase service-role secret on the server.

Airtable updates are not a transaction: if clearing the previous current flag succeeds but final approval fails, the request remains pending and may temporarily have no current account. The UI reports an unconfirmed review and asks for a refresh/retry; it never announces success before the resulting state is confirmed. A retry of a completed final write can finish the audit without rewriting the bank data. Bank history is never deleted.

`npm run test:banking` covers review authorization, approval/rejection, ownership, stale state, lock conflict/expiry, response confirmation and audit errors. `supabase/tests/banking_review.sql` checks lease ownership, concurrent claims, audit completion and execution privileges inside a fully rolled-back transaction.


The partner profile menu displays the linked registration's company name rather than the Auth contact's full_name. Apply `20261114143000_partner_display_profile.sql`: get_partner_display_profile is available only to authenticated callers and resolves auth.uid() against an enabled, matching registration/membership. It returns only the partner ID and company name; it cannot accept a different user's ID or expose another partner's profile. The profile label is fetched independently from login, with a neutral fallback if unavailable. `supabase/tests/partner_display_profile.sql` checks ownership and execution privileges inside a rolled-back transaction.

## Editing partner details

The pencil in User management edits an existing, provisioned partner registration. Partner name, contact name and login email keep the same registration ID, Auth user ID, Airtable partner record ID and membership. The existing mirror updates Partners_api Name, Contact and Email. Referrals_api Email is the referred client's address and is never changed by this operation. Bank submissions, account holders and payout history are preserved.

Apply `20261114160000_partner_profile_edit.sql` before deploying the updated partner-admin function. A server-only audit/operation table records old/new values, creator, completion actor, timestamps and pending/completed/cancelled states. The existing registration lease serializes edits with invitation and account lifecycle actions. The server rejects edits to administrators/self, unprovisioned/deleted records, stale originals and duplicate partner names or emails, including Auth accounts outside the portal registry.

The email confirmation screen requires the admin to attest that the address belongs to the same contact; it is not a contact-transfer flow and sends no email. Auth email updates use the Admin API and retain existing confirmation state and password. Unactivated accounts need a newly generated invitation after their email is changed. Deactivated accounts remain deactivated. Name-only changes update full_name without replacing unrelated metadata or revoking existing sessions.

Preparation reserves the new canonical values under the existing database uniqueness constraints and temporarily disables membership access. Email changes clear pending confirmation/recovery/email-change/reauthentication tokens and remove existing refresh tokens/sessions through a server-only function scoped to the registration lease, both before and after updating Auth. The portal additionally validates session existence and the current email in membership RLS and display-profile queries. The access-link password flow checks this validation before saving a password. This closes the access-token window described in the [Supabase session documentation](https://supabase.com/docs/guides/auth/sessions); Auth updates use [updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid).

The Auth update is not a distributed transaction with Postgres/Airtable. The operation stays pending with data access disabled if alignment cannot be confirmed. Edit reopens the saved target values for resuming; invitation/recovery/lifecycle actions remain blocked until completion. A known rejected Auth email change can restore the original canonical values when Auth still owns the old address. Timeouts are reconciled against Auth before deciding to resume/restore. Network calls are bounded to remain within the registration lease. Completion revalidates Auth/profile alignment, restores only the previous membership state and enqueues another mirror revision. The worker retries Airtable independently, and the list shows pending mirror updates.

Run `npm run test:admin` for editing, ownership, duplicate/confirmation checks, failure reconciliation and revoked access-link sessions. `supabase/tests/partner_profile_edit.sql` verifies the database flow with rolled-back Auth/session fixtures: stable IDs, live session validation, token/session revocation, resumability, audit and queued synchronization. No fixture credentials or account updates are committed or sent to Airtable.
