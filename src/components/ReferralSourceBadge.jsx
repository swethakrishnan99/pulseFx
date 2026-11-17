const styles = {
  "Partner Portal": "bg-blue-100 text-blue-800",
  "Referral Link": "bg-blue-900 text-white",
};

export default function ReferralSourceBadge({ source }) {
  if (!source) return <span className="text-gray-400">—</span>;
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${styles[source] || "bg-gray-100 text-gray-700"}`}>{source}</span>;
}
