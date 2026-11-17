import test from 'node:test';
import assert from 'node:assert/strict';
import { keepDialogFocus } from './dialogFocus.js';

function addAdmin() {
  const document = { activeElement: null, defaultView: { getComputedStyle: element => ({ visibility: element.visibility || 'visible' }) } };
  const dialog = { ownerDocument: document, querySelectorAll: () => controls, focus: () => { document.activeElement = dialog; } };
  const make = (id, type = 'button') => ({ id, type, tabIndex: 0, ownerDocument: document,
    matches: () => !!controls.find(element => element.id === id).disabled,
    closest: selector => selector === 'dialog' ? dialog : null,
    getClientRects: () => [{}], focus() { document.activeElement = this; } });
  const controls = [make('close'), make('name', 'text'), make('email', 'email'), make('confirm', 'checkbox'), make('cancel'), make('create')];
  controls[5].disabled = true;
  function tab(id, shiftKey = false, extras = {}) {
    const target = controls.find(element => element.id === id) || dialog;
    document.activeElement = target;
    let prevented = false;
    keepDialogFocus({ key: 'Tab', shiftKey, currentTarget: dialog, target,
      preventDefault: () => { prevented = true; }, ...extras });
    return { id: document.activeElement.id, prevented };
  }
  return { controls, dialog, document, tab };
}

test('Add admin: Tab after email reaches confirmation, then Cancel; enabled submit joins sequence', () => {
  const { controls, tab } = addAdmin();
  assert.deepEqual(tab('email'), { id: 'confirm', prevented: true });
  assert.equal(tab('confirm').id, 'cancel');
  assert.equal(tab('cancel').id, 'close');
  controls[3].checked = true; controls[5].disabled = false;
  assert.equal(tab('cancel').id, 'create');
  assert.equal(tab('create').id, 'close');
});
test('Shift+Tab traverses controls in reverse and stays in the modal', () => {
  const { tab } = addAdmin();
  assert.equal(tab('cancel', true).id, 'confirm');
  assert.equal(tab('confirm', true).id, 'email');
  assert.equal(tab('close', true).id, 'cancel');
});
test('hidden controls and controls disabled through fieldsets are excluded', () => {
  const { controls, tab } = addAdmin();
  controls[3].visibility = 'hidden';
  assert.equal(tab('email').id, 'cancel');
  controls[3].visibility = 'visible';
  controls[3].disabled = true;
  assert.equal(tab('email').id, 'cancel');
});
test('a busy modal with no enabled controls retains focus', () => {
  const { controls, dialog, document, tab } = addAdmin();
  controls.forEach(element => { element.disabled = true; });
  assert.equal(tab('email').prevented, true);
  assert.equal(document.activeElement, dialog);
});
test('Space and already handled Tab events retain their existing behavior', () => {
  const { tab } = addAdmin();
  assert.deepEqual(tab('confirm', false, { key: ' ' }), { id: 'confirm', prevented: false });
  assert.deepEqual(tab('email', false, { defaultPrevented: true }), { id: 'email', prevented: false });
});
