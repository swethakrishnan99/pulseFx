// The client's own bank accounts that PulseFX can collect money from by direct debit.
// Kept at module level so Move Money and Holding Accounts see the same list (demo only, resets on reload).
let accounts = [
  { id: "b-usd-1", currency: "USD", bank: "RBC Chequing", last4: "7712", holder: "PulseFX Test Account", status: "verified" },
  { id: "b-cad-1", currency: "CAD", bank: "RBC Chequing", last4: "5560", holder: "PulseFX Test Account", status: "verified" },
  { id: "b-cad-2", currency: "CAD", bank: "TD Business", last4: "3350", holder: "PulseFX Test Account", status: "verified" },
  { id: "b-eur-1", currency: "EUR", bank: "RBC EUR account", last4: "9021", holder: "PulseFX Test Account", status: "verified" },
  { id: "b-gbp-1", currency: "GBP", bank: "RBC GBP account", last4: "9022", holder: "PulseFX Test Account", status: "verified" },
  { id: "b-aud-1", currency: "AUD", bank: "RBC AUD account", last4: "9023", holder: "PulseFX Test Account", status: "verified" },
  { id: "b-mxn-1", currency: "MXN", bank: "RBC MXN account", last4: "9024", holder: "PulseFX Test Account", status: "verified" },
];

export const getBankAccounts = () => accounts;
export const addBankAccount = (a) => { accounts = [{ id: `b-${Date.now()}`, status: "pending", ...a }, ...accounts]; };
export const removeBankAccount = (id) => { accounts = accounts.filter((a) => a.id !== id); };
export const verifyBankAccount = (id) => { accounts = accounts.map((a) => (a.id === id ? { ...a, status: "verified" } : a)); };

// Lets Move Money open Holding Accounts straight on the Linked bank accounts tab.
let pendingTab = null;
export const setPendingTab = (t) => { pendingTab = t; };
export const takePendingTab = () => { const t = pendingTab; pendingTab = null; return t; };