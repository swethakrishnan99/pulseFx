const controls = 'a[href], area[href], button, input, select, textarea, summary, iframe, [tabindex], [contenteditable="true"], audio[controls], video[controls]';

/** DOM order is the reading order, including controls Safari may skip by default. */
export function keyboardStops(scope) {
  const candidates = [...scope.querySelectorAll(controls)].filter(element =>
    element.tabIndex >= 0 && !element.matches(':disabled') &&
    !element.closest('[inert], [hidden]') && element.getClientRects().length > 0 &&
    !['hidden', 'collapse'].includes(element.ownerDocument.defaultView.getComputedStyle(element).visibility)
  );
  return candidates.filter(element => {
    if (element.type !== 'radio' || !element.name) return true;
    const group = candidates.filter(other => other.type === 'radio' && other.name === element.name && other.form === element.form && other.getRootNode() === element.getRootNode());
    return element === (group.find(other => other.checked) || group[0]);
  }).sort((a, b) => (a.tabIndex || Infinity) - (b.tabIndex || Infinity));
}

export function isPlainTab(event) {
  return event.key === 'Tab' && !event.defaultPrevented && !event.altKey && !event.ctrlKey && !event.metaKey;
}

/** Advance within a page; preserve native browser navigation at page boundaries. */
export function movePageFocus(event, scope, from = scope.ownerDocument.activeElement) {
  if (!isPlainTab(event)) return;
  const stops = keyboardStops(scope);
  let index = stops.indexOf(from);
  if (index < 0 && from !== scope.ownerDocument.body) {
    // A heading (tabIndex=-1), or a menu item, still has a place in DOM order.
    const following = stops.findIndex(element => from.compareDocumentPosition(element) & 4);
    index = following < 0 ? stops.length : following;
    if (!event.shiftKey) index -= 1;
  }
  const next = index < 0 && event.shiftKey ? stops.length - 1 : index + (event.shiftKey ? -1 : 1);
  if (!stops[next]) return;
  event.preventDefault();
  stops[next].focus();
}
