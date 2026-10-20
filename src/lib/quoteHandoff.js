// Hands an accepted quote from the Dashboard to Send Payment without touching App.jsx.
// Demo only: a plain module variable, cleared when Send Payment closes.
let pending = null;
export const setPendingQuote = (q) => { pending = q; };
export const readPendingQuote = () => pending;
export const clearPendingQuote = () => { pending = null; };