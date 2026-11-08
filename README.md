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
npx supabase functions deploy referrals --project-ref YOUR_PROJECT_REF
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

Client authentication, password recovery and partner screens other than Referrals remain demonstrations in this version.
No Airtable credentials or production referral data are included. Deploy `supabase/functions/referrals` separately to enable authenticated referrals.
