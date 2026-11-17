// Callers supply only referrals belonging to the authenticated partner.
export function referralEmailConflict(referrals, email) {
  const normalized = email.trim().toLowerCase();
  const matches = referrals.filter(referral => referral.email.trim().toLowerCase() === normalized);
  const blocked = matches.some(referral => referral.status !== "Rejected");
  const rejected = matches.filter(referral => referral.status === "Rejected");
  const rejectionTime = referral => Date.parse(referral.statusChangedAt) || 0;
  rejected.sort((a, b) => rejectionTime(b) - rejectionTime(a) || String(b.id).localeCompare(String(a.id)));
  const latest = rejected[0];
  return { blocked, rejection: latest ? { id: latest.id, statusChangedAt: latest.statusChangedAt || "" } : null };
}
