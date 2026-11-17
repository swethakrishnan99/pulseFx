import { createPartnerAdminHandler } from "../partner-admin/service.mjs";

export function createPartnerInvitationsHandler({ env, fetchImpl = fetch, ...dependencies }) {
  const invitationDelivery = {
    configured: !!env.AIRTABLE_PARTNER_INVITATIONS_TABLE_ID,
    async enqueue(row, link) {
      // Never retry an ambiguous write: the email automation may already have started.
      const response = await fetchImpl(`https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}/${encodeURIComponent(env.AIRTABLE_PARTNER_INVITATIONS_TABLE_ID)}`, {
        method: "PATCH", signal: AbortSignal.timeout(15000),
        headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ performUpsert: { fieldsToMergeOn: ["Portal ID"] }, records: [{ fields: {
          "Portal ID": row.id, "Partner name": row.company, "Contact name": row.name, Email: row.email,
          "Invitation link": link, "Requested at": new Date().toISOString(),
          "Supabase user ID": row.user_id, "Partner Airtable ID": row.partner_id, Status: "Pending",
        } }] }),
      });
      if (!response.ok) throw new Error("Invitation delivery failed");
      const saved = await response.json();
      if (!/^rec[A-Za-z0-9]{14}$/.test(saved.records?.[0]?.id || "")) throw new Error("Invitation delivery not confirmed");
    },
  };
  // Reuse account provisioning, administrator authorization and registration locking.
  return createPartnerAdminHandler({ ...dependencies, env, fetchImpl, invitationDelivery, invitationsOnly: true });
}
