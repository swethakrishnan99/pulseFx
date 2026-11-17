// Sample data for the public partner preview only.
import demoLogo from "../assets/PulseFXLogo.svg";

export const demoDate = (days, hour = 14) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, 30, 0, 0);
  return date.toISOString();
};

export const DEMO_REFERRALS = [
  {
    id: 1,
    company: "Northwind Machining Ltd.",
    contact: "Ana Costa",
    email: "ana@northwind.example",
    country: "Canada",
    status: "Documents submitted",
    created: demoDate(-6),
    modified: demoDate(-2),
    statusChangedAt: demoDate(-2),
    volume: "Under CAD 50,000",
    cur: ["CAD", "USD"],
    otherCur: "None requested",
    notes: "Imports precision tooling from European suppliers. Monthly invoices and quarterly equipment purchases."
  },
  {
    id: 2,
    company: "Harbour Street Foods",
    contact: "Tom Reyes",
    email: "tom@harbourstreet.example",
    country: "Canada",
    status: "Under review",
    created: demoDate(-20),
    modified: demoDate(-3),
    statusChangedAt: demoDate(-3),
    volume: "CAD 50,000 to 250,000",
    cur: ["CAD", "EUR", "GBP"],
    otherCur: "None requested",
    notes: "Expanding cross-border distribution with recurring supplier and freight payments."
  },
  {
    id: 3,
    company: "Lakeside Imports Inc.",
    contact: "Mei Lin",
    email: "mei@lakeside.example",
    country: "Canada",
    status: "Invited",
    created: demoDate(-40),
    modified: demoDate(-40),
    statusChangedAt: demoDate(-40),
    volume: "CAD 250,000 to 1,000,000",
    cur: ["CAD", "AUD", "MXN"],
    otherCur: "None requested",
    notes: "Seasonal inventory purchases with multi-currency collections from international customers."
  },
  {
    id: 4,
    company: "Pinecrest Logistics",
    contact: "Sam Okafor",
    email: "sam@pinecrest.example",
    country: "United States",
    status: "Account created",
    created: demoDate(-47),
    modified: demoDate(-44),
    statusChangedAt: demoDate(-44),
    volume: "Over CAD 1,000,000",
    cur: ["USD", "Other"],
    otherCur: "JPY, CHF",
    notes: "Requires payroll transfers and forward contracts for planned international expenses."
  },
  {
    id: 5,
    company: "Redline Outdoor Gear",
    contact: "Julia Park",
    email: "julia@redline.example",
    country: "Canada",
    status: "Onboarded",
    created: demoDate(-62),
    modified: demoDate(-50),
    statusChangedAt: demoDate(-50),
    volume: "Under CAD 50,000",
    cur: ["CAD", "USD"],
    otherCur: "None requested",
    notes: "Imports precision tooling from European suppliers. Monthly invoices and quarterly equipment purchases."
  },
  {
    id: 6,
    company: "Summit Dental Group",
    contact: "Raj Patel",
    email: "raj@summitdental.example",
    country: "Canada",
    status: "Onboarded",
    created: demoDate(-96),
    modified: demoDate(-80),
    statusChangedAt: demoDate(-80),
    volume: "CAD 50,000 to 250,000",
    cur: ["CAD", "EUR", "GBP"],
    otherCur: "None requested",
    notes: "Expanding cross-border distribution with recurring supplier and freight payments."
  },
  {
    id: 7,
    company: "Cobalt Packaging Co.",
    contact: "Elena Rossi",
    email: "elena@cobalt.example",
    country: "Italy",
    status: "Rejected",
    created: demoDate(-120),
    modified: demoDate(-110),
    statusChangedAt: demoDate(-110),
    volume: "CAD 250,000 to 1,000,000",
    cur: ["CAD", "AUD", "MXN"],
    otherCur: "None requested",
    notes: "Seasonal inventory purchases with multi-currency collections from international customers."
  },
  {
    id: 8,
    company: "Birchwood Furniture",
    contact: "Dan Wu",
    email: "dan@birchwood.example",
    country: "Canada",
    status: "Onboarded",
    created: demoDate(-170),
    modified: demoDate(-150),
    statusChangedAt: demoDate(-150),
    volume: "Over CAD 1,000,000",
    cur: ["USD", "Other"],
    otherCur: "JPY, CHF",
    notes: "Requires payroll transfers and forward contracts for planned international expenses."
  },
  {
    id: 9,
    company: "Aurora Medical Supplies",
    contact: "Nadia Tremblay",
    email: "finance9@example.com",
    country: "Canada",
    status: "Invited",
    volume: "Under CAD 50,000",
    cur: ["CAD", "USD"],
    otherCur: "None requested",
    notes: "Imports precision tooling from European suppliers. Monthly invoices and quarterly equipment purchases.",
    created: demoDate(-12),
    modified: demoDate(-1),
    statusChangedAt: demoDate(-1)
  },
  {
    id: 10,
    company: "Pacific Coast Electronics",
    contact: "Chris Bennett",
    email: "finance10@example.com",
    country: "United States",
    status: "Account created",
    volume: "CAD 50,000 to 250,000",
    cur: ["CAD", "EUR", "GBP"],
    otherCur: "None requested",
    notes: "Expanding cross-border distribution with recurring supplier and freight payments.",
    created: demoDate(-23),
    modified: demoDate(-8),
    statusChangedAt: demoDate(-8)
  },
  {
    id: 11,
    company: "Prairie Agri Exports",
    contact: "Sofia Alvarez",
    email: "finance11@example.com",
    country: "Canada",
    status: "Documents submitted",
    volume: "CAD 250,000 to 1,000,000",
    cur: ["CAD", "AUD", "MXN"],
    otherCur: "None requested",
    notes: "Seasonal inventory purchases with multi-currency collections from international customers.",
    created: demoDate(-34),
    modified: demoDate(-15),
    statusChangedAt: demoDate(-15)
  },
  {
    id: 12,
    company: "Evergreen Digital Studio",
    contact: "Oliver Chen",
    email: "finance12@example.com",
    country: "Canada",
    status: "Under review",
    volume: "Over CAD 1,000,000",
    cur: ["USD", "Other"],
    otherCur: "JPY, CHF",
    notes: "Requires payroll transfers and forward contracts for planned international expenses.",
    created: demoDate(-45),
    modified: demoDate(-22),
    statusChangedAt: demoDate(-22)
  },
  {
    id: 13,
    company: "Atlas Industrial Parts",
    contact: "Amara Johnson",
    email: "finance13@example.com",
    country: "United States",
    status: "Onboarded",
    volume: "Under CAD 50,000",
    cur: ["CAD", "USD"],
    otherCur: "None requested",
    notes: "Imports precision tooling from European suppliers. Monthly invoices and quarterly equipment purchases.",
    created: demoDate(-56),
    modified: demoDate(-29),
    statusChangedAt: demoDate(-29)
  },
  {
    id: 14,
    company: "Maritime Seafood Trading",
    contact: "Lucas Martin",
    email: "finance14@example.com",
    country: "Canada",
    status: "Rejected",
    volume: "CAD 50,000 to 250,000",
    cur: ["CAD", "EUR", "GBP"],
    otherCur: "None requested",
    notes: "Expanding cross-border distribution with recurring supplier and freight payments.",
    created: demoDate(-67),
    modified: demoDate(-36),
    statusChangedAt: demoDate(-36)
  },
  {
    id: 15,
    company: "Silver Birch Textiles",
    contact: "Emma Wilson",
    email: "finance15@example.com",
    country: "Canada",
    status: "Invited",
    volume: "CAD 250,000 to 1,000,000",
    cur: ["CAD", "AUD", "MXN"],
    otherCur: "None requested",
    notes: "Seasonal inventory purchases with multi-currency collections from international customers.",
    created: demoDate(-78),
    modified: demoDate(-43),
    statusChangedAt: demoDate(-43)
  },
  {
    id: 16,
    company: "Canyon Renewable Energy",
    contact: "Diego Santos",
    email: "finance16@example.com",
    country: "United States",
    status: "Account created",
    volume: "Over CAD 1,000,000",
    cur: ["USD", "Other"],
    otherCur: "JPY, CHF",
    notes: "Requires payroll transfers and forward contracts for planned international expenses.",
    created: demoDate(-89),
    modified: demoDate(-50),
    statusChangedAt: demoDate(-50)
  },
  {
    id: 17,
    company: "Northern Lights Travel",
    contact: "Leila Ahmed",
    email: "finance17@example.com",
    country: "Canada",
    status: "Documents submitted",
    volume: "Under CAD 50,000",
    cur: ["CAD", "USD"],
    otherCur: "None requested",
    notes: "Imports precision tooling from European suppliers. Monthly invoices and quarterly equipment purchases.",
    created: demoDate(-100),
    modified: demoDate(-57),
    statusChangedAt: demoDate(-57)
  },
  {
    id: 18,
    company: "Bluewater Marine Services",
    contact: "Noah Campbell",
    email: "finance18@example.com",
    country: "Canada",
    status: "Under review",
    volume: "CAD 50,000 to 250,000",
    cur: ["CAD", "EUR", "GBP"],
    otherCur: "None requested",
    notes: "Expanding cross-border distribution with recurring supplier and freight payments.",
    created: demoDate(-111),
    modified: demoDate(-64),
    statusChangedAt: demoDate(-64)
  },
];

export const DEMO_BANK_ACCOUNTS = [
  { id: "demo-pending", bank: "TD Canada Trust", holder: "ABC Accounting Inc.", institutionCode: "004", transitNumber: "10222", account: "7290456123", last4: "6123", currency: "CAD", status: "Pending verification", current: false, submittedAt: demoDate(-1), comments: "Please use our new operating account after verification." },
  { id: "demo-current", bank: "RBC Royal Bank", holder: "ABC Accounting Inc.", institutionCode: "003", transitNumber: "00212", account: "12344821", last4: "4821", currency: "CAD", status: "Verified", current: true, submittedAt: demoDate(-30), approvedAt: demoDate(-28), reviewNotes: "Account ownership and bank details confirmed against the void cheque.", comments: "Primary CAD account for monthly partner payouts." },
  { id: "demo-rejected", bank: "Bank of Montreal", holder: "ABC Accounting Inc.", institutionCode: "001", transitNumber: "00345", account: "8835100421", last4: "0421", currency: "CAD", status: "Rejected", current: false, submittedAt: demoDate(-45), rejectedAt: demoDate(-43), rejectionReason: "Transit number does not match the submitted bank document. Please check and resubmit.", comments: "Requested replacement account for referral commissions." },
  { id: "demo-previous", bank: "Scotiabank", holder: "ABC Accounting Inc.", institutionCode: "002", transitNumber: "47696", account: "7100335009", last4: "5009", currency: "CAD", status: "Verified", current: false, submittedAt: demoDate(-120), approvedAt: demoDate(-118), reviewNotes: "Business account verified. Replaced by the current RBC account.", comments: "Original payout account used during partner onboarding." },
];

export const DEMO_PAYOUTS = Array.from({ length: 16 }, (_, index) => {
  const status = ["Paid", "Pending", "Failed", "Cancelled"][index % 4];
  const bank = DEMO_BANK_ACCOUNTS[index < 8 ? 1 : 3];
  return {
    id: `demo-payout-${index + 1}`, ref: `PFXPAY-${10420 - index}`,
    client: `${DEMO_REFERRALS.filter(referral => referral.status === "Onboarded")[index % 4].company} | Referral commission`,
    amount: [1250.75, 480, 2375.50, 95, 6250, 875.25, 150, 1920][index % 8], currency: "CAD", status,
    createdAt: demoDate(-3 - index * 8), date: status === "Paid" ? demoDate(-1 - index * 8) : null,
    lastEditedAt: demoDate(-1 - index * 8), cancelledAt: status === "Cancelled" ? demoDate(-1 - index * 8) : null,
    cancellationReason: status === "Cancelled" ? "Duplicate commission entry cancelled before payment." : "",
    notes: status === "Failed" ? "Bank rejected the transfer. Partner manager is confirming the payout details before retrying." : status === "Pending" ? "Commission approved and queued for the next payout run." : status === "Paid" ? "Monthly referral commission successfully deposited." : "Replacement commission will appear in the next statement.",
    submissionId: bank.id,
    bank: { holder: bank.holder, name: bank.bank, institutionCode: bank.institutionCode, transitNumber: bank.transitNumber, account: bank.account, currency: bank.currency },
  };
});

export const DEMO_BRAND_KIT = {
  logo: { name: "PulseFX-demo-logo.svg", url: demoLogo },
  headshot: { name: "partner-contact-demo.svg", url: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" rx="24" fill="#e9f5f2"/><circle cx="120" cy="88" r="40" fill="#17384a"/><path d="M40 224v-20a80 80 0 0 1 160 0v20" fill="#17384a"/></svg>')}` },
  description: "ABC Accounting helps Canadian businesses manage cross-border growth, financial reporting and international supplier payments. Our dedicated team connects clients with PulseFX for currency exchange, payment solutions and foreign exchange risk management.",
};
export const DEMO_BRAND_ASSETS = [
  { id: "demo-logo", name: "PulseFX primary logo", description: "Full-colour logo for client presentations.", file: { name: "PulseFXLogo.svg", url: demoLogo } },
  { id: "demo-overview", name: "PulseFX company overview", description: "Introduction to PulseFX services.", file: { name: "pulsefx-company-overview.pdf", url: `${import.meta.env.BASE_URL}onepagers/pulsefx-company-overview.pdf` } },
];
export const DEMO_ONE_PAGERS = [
  { id: "demo-company", name: "PulseFX company overview", description: "Currency exchange and international payment services.", file: { name: "pulsefx-company-overview.pdf", url: `${import.meta.env.BASE_URL}onepagers/pulsefx-company-overview.pdf` } },
  { id: "demo-hedging", name: "Hedging solutions", description: "Explore forward contracts and currency risk management.", file: { name: "hedging-solutions.pdf", url: `${import.meta.env.BASE_URL}onepagers/hedging-solutions.pdf` } },
];
