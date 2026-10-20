// Hands an accepted quote from the Dashboard to Send Payment without touching App.jsx.
// Demo only: a plain module variable, cleared when Send Payment closes.
let pending = null;
export const setPendingQuote = (q) => { pending = q; };
export const readPendingQuote = () => pending;
export const clearPendingQuote = () => { pending = null; };

// Hands a chosen beneficiary from the Beneficiaries page to Send Payment ("Pay" button).
let pendingBen = null;
export const setPendingBeneficiary = (b) => { pendingBen = b; };
export const readPendingBeneficiary = () => pendingBen;
export const clearPendingBeneficiary = () => { pendingBen = null; };

// Hands "pay from this holding account" from Holding Accounts to Send Payment ("Pay" button).
let pendingPayFrom = null;
export const setPendingPayFrom = (c) => { pendingPayFrom = c; };
export const readPendingPayFrom = () => pendingPayFrom;
export const clearPendingPayFrom = () => { pendingPayFrom = null; };