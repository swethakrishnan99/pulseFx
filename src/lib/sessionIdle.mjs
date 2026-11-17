export const SESSION_IDLE_MS = 60 * 60 * 1000;

// Scope activity to the Auth session so a fresh login gets a fresh deadline.
export function sessionActivityKey(session) {
  const payload = JSON.parse(atob(session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  return `pulsefx-session-activity:${payload.session_id}`;
}

export function watchSessionIdle({ key, onExpire, target = window, storage = window.localStorage, now = Date.now, schedule = setInterval, cancel = clearInterval }) {
  let expired = false;
  let lastActivity = 0;
  function read() {
    try {
      const saved = Number(storage.getItem(key));
      if (saved > 0) lastActivity = Math.max(lastActivity, saved);
    } catch { /* Keep the in-memory deadline when storage is unavailable. */ }
  }
  // On reload, use the existing deadline rather than restarting the hour.
  read();
  if (!lastActivity) lastActivity = now();
  function check() {
    read();
    if (!expired && now() - lastActivity >= SESSION_IDLE_MS) {
      expired = true;
      onExpire();
    }
    return expired;
  }
  function activity() {
    if (check()) return;
    lastActivity = now();
    try { storage.setItem(key, String(lastActivity)); } catch { /* Memory fallback. */ }
  }
  if (!check()) {
    try { storage.setItem(key, String(lastActivity)); } catch { /* Memory fallback. */ }
  }
  const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
  events.forEach(event => target.addEventListener(event, activity, { passive: true }));
  target.addEventListener('focus', check);
  target.addEventListener('visibilitychange', check);
  target.addEventListener('storage', check);
  const timer = schedule(check, 1000);
  return () => {
    cancel(timer);
    events.forEach(event => target.removeEventListener(event, activity));
    target.removeEventListener('focus', check);
    target.removeEventListener('visibilitychange', check);
    target.removeEventListener('storage', check);
  };
}
