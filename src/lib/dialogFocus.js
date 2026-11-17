import { isPlainTab, keyboardStops } from './keyboardFocus.js';

export const dialogTabStops = keyboardStops;

export function keepDialogFocus(event) {
  if (!isPlainTab(event)) return;
  const dialog = event.currentTarget;
  // A nested modal owns its own focus sequence.
  if (event.target.closest('dialog') !== dialog) return;
  const stops = keyboardStops(dialog);
  event.preventDefault();
  if (!stops.length) {
    dialog.focus();
    return;
  }
  const index = stops.indexOf(dialog.ownerDocument.activeElement);
  const next = index < 0 ? (event.shiftKey ? stops.length - 1 : 0)
    : (index + (event.shiftKey ? -1 : 1) + stops.length) % stops.length;
  stops[next].focus();
}
