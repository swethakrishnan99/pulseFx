import { movePageFocus } from './keyboardFocus';

export const menuItemSelector = '[role="menuitem"]:not(:disabled)';

export function focusMenuItem(menu, last = false) {
  const items = [...menu.querySelectorAll(menuItemSelector)];
  (last ? items.at(-1) : items[0])?.focus();
}

export function navigateMenu(event, trigger, close) {
  const items = [...event.currentTarget.querySelectorAll(menuItemSelector)];
  const index = items.indexOf(event.target);
  let next;
  if (event.key === 'Escape') {
    event.preventDefault(); event.stopPropagation(); close(); trigger.focus(); return;
  }
  if (event.key === 'Tab') {
    trigger.focus();
    // Let a parent modal wrap Tab. On a page, advance from the trigger.
    if (!trigger.closest('dialog')) movePageFocus(event, trigger.ownerDocument.getElementById('root'), trigger);
    close();
    return;
  }
  if (event.key === 'ArrowDown') next = (index + 1) % items.length;
  else if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = items.length - 1;
  else return;
  event.preventDefault(); items[next]?.focus();
}
