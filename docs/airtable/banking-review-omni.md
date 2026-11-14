# Omni — banking review fields

Paste into Omni in the portal's Airtable base:

```text
In the existing "Banking_details_api" table, add or reuse these exact fields:

1. "Approval reason" — Long text, with rich text formatting disabled. Rename the existing "Review notes" field if present, preserving its values. Report a conflict if both fields already exist.
2. "Show approval reason to partner" — Checkbox, unchecked by default.
3. "Rejection reason" — Long text, with rich text formatting disabled.
4. "Show rejection reason to partner" — Checkbox, unchecked by default.
5. "Partner Comments" — Long text, with rich text formatting disabled. Optional; stores the partner's comment submitted with their account details, separately from staff reasons.
6. "Approved at" — Date, with time enabled.
7. "Approved by user ID" — Single line text, for the reviewer's Supabase Auth UUID.
8. "Approved by email" — Email.
9. "Rejected at" — Date, with time enabled.
10. "Rejected by user ID" — Single line text, for the reviewer's Supabase Auth UUID.
11. "Rejected by email" — Email.

Keep approval and rejection text and visibility independent. The backend fills reviewer identity from verified Supabase Auth and event time from the server. Do not use collaborator fields, formulas, defaults, or automations for audit metadata. Display date/time in America/Toronto if supported; API timestamps are UTC.

MIGRATION, ONLY IF NOT ALREADY COMPLETED:
For existing Rejected records, copy legacy Review notes (now Approval reason) into Rejection reason only if the destination is blank. Copy the associated legacy visibility setting for those copied reasons. Preserve the original text and audit metadata.
If "Show review notes to partner" still exists, copy its values into "Show approval reason to partner" before deleting the obsolete field. If already migrated, preserve the current destination values.

Only share each staff reason when its corresponding checkbox is checked. Preserve hidden text. Leave new Partner Comments and unknown historical audit values blank; do not invent reviewers or dates.

Preserve all records, IDs, account details, relationships, and audit metadata. Do not recreate or rename the table. Reuse fields with the correct type; report conflicting types before changing them.
```

Create or migrate all eleven fields before deploying `partner-banking`. No Supabase migration is required. The existing service-only banking review audit remains in place. Staff identities are returned only by the administrator review endpoint; partner responses omit hidden staff reasons entirely.

A retry of a confirmed Airtable decision may finish the Supabase audit only when the authenticated user ID, action-specific reason and visibility match the original decision. It never rewrites the reviewer's email or event time, including when the Auth email changes. Historical decisions without attribution cannot be reattributed through a retry.
