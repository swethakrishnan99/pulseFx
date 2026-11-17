import test from 'node:test';
import assert from 'node:assert/strict';
import { navigateTabs } from './tabNavigation.js';

function press(key, index, disabled = [], modifiers = {}) {
  const calls = [];
  const tabs = Array.from({ length: 3 }, (_, i) => ({
    disabled: disabled.includes(i),
    focus: () => calls.push(`focus:${i}`),
    click: () => calls.push(`select:${i}`),
  }));
  navigateTabs({ key, ...modifiers, target: { closest: () => tabs[index] },
    currentTarget: { querySelectorAll: () => tabs }, preventDefault: () => calls.push('prevent') });
  return calls;
}
test('arrows follow DOM order, wrap and skip disabled tabs', () => {
  assert.deepEqual(press('ArrowRight', 0), ['prevent', 'focus:1', 'select:1']);
  assert.deepEqual(press('ArrowRight', 2), ['prevent', 'focus:0', 'select:0']);
  assert.deepEqual(press('ArrowLeft', 0), ['prevent', 'focus:2', 'select:2']);
  assert.deepEqual(press('ArrowRight', 0, [1]), ['prevent', 'focus:2', 'select:2']);
});
test('Home and End select the first and last available tabs', () => {
  assert.deepEqual(press('Home', 1, [0]), ['prevent', 'focus:1', 'select:1']);
  assert.deepEqual(press('End', 0, [2]), ['prevent', 'focus:1', 'select:1']);
});
test('Tab, Shift+Tab and browser shortcuts retain native behavior', () => {
  assert.deepEqual(press('Tab', 0), []);
  assert.deepEqual(press('Tab', 0, [], { shiftKey: true }), []);
  assert.deepEqual(press('ArrowLeft', 0, [], { altKey: true }), []);
});
