/** Keep a tab strip to one Tab stop; arrows select in visual DOM order. */
export function navigateTabs(event) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const current = event.target.closest('[role="tab"]');
  if (!current) return;
  const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')].filter(tab => !tab.disabled);
  const index = tabs.indexOf(current);
  let next;
  if (event.key === "Home") next = 0;
  else if (event.key === "End") next = tabs.length - 1;
  else if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
  else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
  else return;
  event.preventDefault();
  tabs[next]?.focus();
  tabs[next]?.click();
}
