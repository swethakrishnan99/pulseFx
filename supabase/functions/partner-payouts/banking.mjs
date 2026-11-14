export const bankFields = ["Submission ID", "Partner", "Partner ID", "Institution code", "Transit number", "Institution name", "Account holder", "Account number", "Currency", "Status", "Current account"];
const legacyReference = row => /^rec[A-Za-z0-9]{14}$/.test(row?.id || "") ? `airtable:${row.id}` : "";
const text = value => typeof value === "string" ? value : "";
export const ownsBank = (row, partnerId) => row?.fields?.["Partner ID"] === partnerId && Array.isArray(row.fields.Partner) && row.fields.Partner.length === 1 && row.fields.Partner[0] === partnerId;
export function bankSummary(row) {
 const f = row.fields;
 return { submissionId: text(f["Submission ID"]) || legacyReference(row), name: text(f["Institution name"]), holder: text(f["Account holder"]), institutionCode: text(f["Institution code"]), transitNumber: text(f["Transit number"]), account: text(f["Account number"]), last4: text(f["Account number"]).slice(-4), currency: text(f.Currency) };
}
export function linkedBank(banks, partnerId, submissionId) {
 if (!submissionId) return null;
 const matches = banks.filter(row => ownsBank(row, partnerId) && (row.fields["Submission ID"] === submissionId || legacyReference(row) === submissionId));
 return matches.length === 1 ? bankSummary(matches[0]) : null;
}
export function verifiedCurrentBank(banks, partnerId) {
 const flagged = banks.filter(row => row.fields?.["Partner ID"] === partnerId && row.fields["Current account"] === true);
 const row = flagged[0], f = row?.fields;
 return flagged.length === 1 && ownsBank(row, partnerId) && f.Status === "Verified" && f.Currency === "CAD"
  && /^\d{4,34}$/.test(f["Account number"] || "") && text(f["Account holder"]).trim() && text(f["Institution name"]).trim() ? bankSummary(row) : null;
}
