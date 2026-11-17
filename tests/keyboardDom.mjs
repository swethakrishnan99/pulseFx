import { parseHTML } from 'linkedom';
const { window } = parseHTML('<html><body><div id="root"></div></body></html>');
const { document, HTMLElement, HTMLInputElement, HTMLOptionElement } = window;
Object.defineProperty(HTMLInputElement.prototype, 'type', { get() { return this.getAttribute('type') || 'text'; }, set(value) { this.setAttribute('type', value); } });
Object.defineProperty(HTMLInputElement.prototype, 'checked', { get() { return this.hasAttribute('checked'); }, set(value) { this.toggleAttribute('checked', !!value); } });
Object.defineProperty(HTMLInputElement.prototype, 'form', { get() { return this.closest('form'); } });
Object.defineProperty(HTMLOptionElement.prototype, 'value', { configurable: true, get() { return this.getAttribute('value') ?? this.textContent; }, set(value) { this.setAttribute('value', value); } });
document.oninput = null;
HTMLElement.prototype.attachEvent = function (name, handler) { this.addEventListener(name.slice(2), handler); };
HTMLElement.prototype.detachEvent = function (name, handler) { this.removeEventListener(name.slice(2), handler); };
let active = document.body;
Object.defineProperty(document, 'activeElement', { get: () => active?.isConnected ? active : document.body });
Object.defineProperty(HTMLElement.prototype, 'tabIndex', {
  get() { const attr = this.getAttribute('tabindex'); return attr !== null ? Number(attr) : /^(BUTTON|INPUT|SELECT|TEXTAREA|IFRAME|SUMMARY)$/.test(this.tagName) || this.hasAttribute('href') ? 0 : -1; },
  set(value) { this.setAttribute('tabindex', String(value)); },
});
HTMLElement.prototype.focus = function () {
  if (this.matches(':disabled')) return;
  const previous = active; active = this;
  previous?.dispatchEvent(Object.assign(new window.Event('focusout', { bubbles: true }), { relatedTarget: this }));
  this.dispatchEvent(Object.assign(new window.Event('focusin', { bubbles: true }), { relatedTarget: previous }));
};
HTMLElement.prototype.getClientRects = function () {
  for (let element = this; element; element = element.parentElement) {
    if (element.hasAttribute('hidden') || (window.innerWidth >= 768 && element.classList.contains('md:hidden')) || (element.classList.contains('hidden') && !(window.innerWidth >= 768 && element.classList.contains('md:flex')))) return [];
  }
  return [{}];
};
HTMLElement.prototype.getBoundingClientRect = () => ({ top: 100, bottom: 140, left: 100, right: 500, width: 400, height: 40 });
Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get() { return 400; } });
HTMLElement.prototype.scrollIntoView = () => {};
HTMLElement.prototype.select = () => {};
HTMLElement.prototype.showModal = function () { this.open = true; this.setAttribute('open', ''); this.querySelector('button:not(:disabled), input:not(:disabled)')?.focus(); };
HTMLElement.prototype.close = function () { this.open = false; this.removeAttribute('open'); };
window.getComputedStyle = () => ({ visibility: 'visible' });
window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
window.scrollTo = () => {};
window.innerWidth = 1280; window.innerHeight = 900;
window.getSelection = () => ({ anchorNode: null, anchorOffset: 0, focusNode: null, focusOffset: 0 });
const storage = new Map();
Object.assign(globalThis, {
  window, document, HTMLElement, Node: window.Node,
  localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  requestAnimationFrame: callback => setTimeout(callback, 0), cancelAnimationFrame: clearTimeout,
  ResizeObserver: class { observe() {} disconnect() {} },
  fetch: async () => { throw new Error('Network disabled in keyboard tests'); },
  IS_REACT_ACT_ENVIRONMENT: true,
});
window.requestAnimationFrame = globalThis.requestAnimationFrame;
window.cancelAnimationFrame = clearTimeout;

export { window, document };
export function resetDom() { active = document.body; storage.clear(); window.innerWidth = 1280; }
