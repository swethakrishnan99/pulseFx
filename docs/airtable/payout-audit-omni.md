# Omni — payout audit fields

Paste the following instructions into Omni in the Airtable base used by the portal:

```text
In the existing "Payouts_api" table, add or reuse the following fields using these exact names and types:

CREATION
1. "Created at" — Created time, including date and time.
   Use the record's original Airtable creation time. Do not use NOW(), Last modified time or "Paid at".
2. "Created by email" — Email.
3. "Created by user ID" — Single line text, for the creator's Supabase Auth UUID.

LAST EDIT
4. "Last edited at" — Date, with time enabled.
5. "Last edited by email" — Email, captured from the editor's verified Supabase Auth session.
6. "Last edited by user ID" — Single line text, for the editor's Supabase Auth UUID.

CANCELLATION
7. "Cancelled at" — Date, with time enabled.
8. "Cancelled by email" — Email, captured from the cancelling user's verified Supabase Auth session.
9. "Cancelled by user ID" — Single line text, for the cancelling user's Supabase Auth UUID.
10. "Cancellation reason" — Long text, with rich text formatting disabled. Optional; it may be blank.

PAYOUT ACCOUNT
11. "Bank Submission ID" — Single line text.
    This stores the exact value of "Submission ID" from the account submission in "Banking_details_api" (including its partner prefix). For legacy banking records without a Submission ID, the backend uses a stable reference in the format "airtable:rec..." pointing to that exact banking record. It is never a payout record ID or a Supabase user ID.
    The portal backend fills it when a payout is marked Paid, after verifying the selected account belongs to that partner and is the current verified CAD account. Keep it unchanged afterwards.
    Do not use a formula, lookup of the current account, automation, or default value. A later account change must not rewrite historical payouts.
    Leave it blank for existing payouts unless the actual account used is independently known and verified. Never backfill with today's current account.
    Preserve "Submission ID" and the original banking details in every "Banking_details_api" submission. New account details must remain separate submissions.

CLIENT VISIBILITY
12. "Show notes to partner" — Checkbox.
13. "Show cancellation reason to partner" — Checkbox.
Leave both unchecked by default, including on existing records. The portal manages these flags. Only explicitly checked fields may be shared with the client. Preserve the original Notes and Cancellation reason text even when hidden.

For date/time fields, display America/Toronto if supported; otherwise keep UTC. The API sends timestamps in UTC.

The portal backend will populate all author, edit and cancellation fields from the authenticated user and server time. Only "Created at" is maintained automatically by Airtable.
Do not use automatic Last modified time fields, Airtable collaborator fields, linked partner records, formulas, default values or automations for this audit metadata.
Cancellation must not overwrite the last edit metadata, creation metadata or existing Notes.

Reuse a field if it already exists with the correct type. If an existing field has a different type, report the conflict before changing it.
Preserve all existing records, fields, record IDs and relationships. Do not recreate or rename the table.
Leave missing author/edit/cancellation metadata blank for existing records. Do not invent historical events or populate them with the current user, integration account or today's date.
```

## Deployment

Create all thirteen fields before publishing the corresponding `partner-payouts` version. The administrator API requests these fields explicitly. No new Supabase migration is required: audit snapshots are stored in the existing operation ledger.

Creation attribution is immutable through portal operations. Last edit metadata changes only on an edit; cancellation stores its own timestamp, authenticated user UUID and optional reason. Request retries preserve the original event time and author, including the email captured when the edit was submitted. Changing an Auth login email does not rewrite historical payout attribution; stable Supabase user UUIDs identify the accounts across email changes. Historical unknown values remain blank and display as `—` in Payout details. Partner-facing details include creation, last update and cancellation timestamps, the optional cancellation reason when explicitly shared, and the historical account resolved using Bank Submission ID. Internal staff emails and Supabase user IDs remain administrator-only.
