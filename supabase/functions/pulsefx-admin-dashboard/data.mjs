import { ownsBank, verifiedCurrentBank, bankFields } from "../partner-payouts/banking.mjs";
const text = value => typeof value === "string" ? value : "";
const timestamp = value => value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : "";

async function readRegistrations(admin) {
  const { data, error } = await admin.rpc("list_partner_admin_accounts");
  if (error || !Array.isArray(data)) throw new Error("Partner registrations unavailable");
  return data;
}

// Called only after the dashboard handler verifies the live administrator session.
export async function dashboardData({
  env,
  admin,
  list,
  base
}) {
  const table = (key, fallback) => `${base}/${encodeURIComponent(env[key] || fallback)}`;
  const [registrations, accounts, referrals, payouts, banks, kits] = await Promise.all([readRegistrations(admin), list(table("AIRTABLE_PARTNERS_TABLE_ID", "Partners_api"), ["Name", "Referrals"]), list(table("AIRTABLE_REFERRALS_TABLE_ID", "Referrals_api"), ["Company", "Email", "Country", "Status", "Created", "Partner", "Currencies", "Expected monthly volume"]), list(table("AIRTABLE_PAYOUTS_TABLE_ID", "Payouts_api"), ["Partner", "Partner ID", "Amount", "Currency", "Status", "Created at", "Paid at"]), list(table("AIRTABLE_BANKING_TABLE_ID", "Banking_details_api"), bankFields), list(table("AIRTABLE_BRAND_KIT_TABLE_ID", "Brand_kit_api"), ["Partner Airtable ID", "Brand logo", "Brand headshot", "Brand description"])]);
  function setupFor(partnerId) {
    const submissions = banks.filter(bank => ownsBank(bank, partnerId));
    const brand = kits.filter(kit => kit.fields["Partner Airtable ID"] === partnerId);
    const logo = brand.some(kit => kit.fields["Brand logo"]?.length > 0);
    const headshot = brand.some(kit => kit.fields["Brand headshot"]?.length > 0);
    const description = brand.some(kit => text(kit.fields["Brand description"]).trim());
    return {
      banking: submissions.some(bank => bank.fields.Status === "Pending verification") ? "Pending verification" : verifiedCurrentBank(banks, partnerId) ? "Verified" : submissions.length ? "Needs review" : "Missing",
      brand: logo && headshot && description ? "Complete" : logo || headshot || description ? "Partial" : "Missing"
    };
  }
  const partners = registrations.filter(row => !row.deleted_at).map(row => {
    const partnerId = row.partner_id || "";
    return {
      id: partnerId || row.id,
      registrationId: row.id,
      name: row.name,
      company: row.company,
      email: row.email,
      createdAt: timestamp(row.user_created_at),
      status: row.disabled ? "Deactivated" : row.activated ? "Active" : row.ready ? "Awaiting activation" : "Setup incomplete",
      ...setupFor(partnerId)
    };
  });
  // Keep historical and Airtable-only partners visible, including their referrals and payments.
  const known = new Set(partners.map(row => row.id));
  for (const row of accounts) {
    if (known.has(row.id)) continue;
    const registration = registrations.find(item => item.partner_id === row.id);
    partners.push({
      id: row.id,
      name: registration?.name || text(row.fields.Name),
      company: text(row.fields.Name),
      email: registration?.email || "",
      createdAt: timestamp(registration?.user_created_at),
      status: registration?.deleted_at ? "Deleted account" : "Airtable only",
      ...setupFor(row.id)
    });
    known.add(row.id);
  }
  const reciprocal = new Map(accounts.map(row => [row.id, new Set(row.fields.Referrals || [])]));
  return {
    partners,
    referrals: referrals.map(row => {
      const f = row.fields;
      const partnerId = f.Partner?.length === 1 ? f.Partner[0] : "";
      return {
        id: row.id,
        partnerId,
        validOwnership: !!partnerId && reciprocal.get(partnerId)?.has(row.id) === true,
        company: text(f.Company),
        email: text(f.Email),
        country: text(f.Country) || "Unknown",
        status: text(f.Status) || "Unknown",
        createdAt: timestamp(f.Created) || timestamp(row.createdTime),
        currencies: Array.isArray(f.Currencies) ? f.Currencies : [],
        volume: text(f["Expected monthly volume"]) || "Unknown"
      };
    }),
    payouts: payouts.map(row => {
      const f = row.fields;
      const partnerId = text(f["Partner ID"]);
      return {
        id: row.id,
        partnerId,
        amount: typeof f.Amount === "number" && Number.isFinite(f.Amount) ? f.Amount : null,
        currency: text(f.Currency) || "CAD",
        status: text(f.Status) || "Pending",
        createdAt: timestamp(f["Created at"]) || timestamp(row.createdTime),
        date: timestamp(f["Paid at"]),
        validOwnership: /^rec[A-Za-z0-9]{14}$/.test(partnerId) && Array.isArray(f.Partner) && f.Partner.length === 1 && f.Partner[0] === partnerId
      };
    }),
    loadedAt: new Date().toISOString()
  };
}
