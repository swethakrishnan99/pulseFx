const submittedTime = account => {
  const time = Date.parse(account?.submittedAt || "");
  return Number.isFinite(time) ? time : null;
};

export function latestPendingBanking(accounts, currentAccount = null) {
  const verifiedTimes = [...accounts.filter(account => account.status === "Verified"), ...(currentAccount ? [currentAccount] : [])]
    .map(submittedTime).filter(time => time !== null);
  const latestVerified = verifiedTimes.length ? Math.max(...verifiedTimes) : -Infinity;
  return accounts.filter(account => account.status === "Pending verification" && submittedTime(account) !== null && submittedTime(account) > latestVerified)
    .reduce((latest, account) => !latest || submittedTime(account) > submittedTime(latest) ? account : latest, null);
}

export function latestBankingDecision(accounts) {
  const eventTime = account => {
    const decisionAt = account.status === "Verified" ? account.approvedAt : account.status === "Rejected" ? account.rejectedAt : null;
    const time = Date.parse(decisionAt || "");
    return Number.isFinite(time) ? time : submittedTime(account);
  };
  const latest = accounts.reduce((result, account) => {
    const time = eventTime(account);
    if (time === null) return result;
    // Prefer pending on timestamp ties so a new request does not appear already reviewed.
    return !result || time > eventTime(result) || (time === eventTime(result) && account.status === "Pending verification") ? account : result;
  }, null);
  return latest && ["Verified", "Rejected"].includes(latest.status) ? latest : null;
}
