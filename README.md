# PulseFX client and partner portals

React portals with Supabase email/password authentication for partner accounts and separate public client and partner demos.
Partner access requires a row in `public.partner_memberships`. Portal business data still uses sample records.

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
- `npm run test:auth` checks authenticated membership lookups, missing memberships and lookup failures.
- `npm run build` checks the production build. The full `npm run lint` currently reports existing issues in the demo components.
- Manually check valid partner sign-in, invalid credentials, an account without membership, reload at `#partner`, logout and both public demos.

Client authentication, password recovery and partner business screens remain demonstrations in this version.
No Airtable credentials or production referral data are included. The files under `supabase/functions/referrals` provide membership lookup helpers, not a deployed Airtable API.
