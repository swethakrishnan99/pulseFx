import { window, document, resetDom } from './keyboardDom.mjs';
import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import PartnerReferralForm from '../src/components/PartnerReferralForm';
import { supabase } from '../src/lib/supabase';
const { createRoot } = await import('react-dom/client');
let root;
const calls = [];
let submitError = false;
async function mount() {
  calls.length = 0;
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, undefined, 'public requests never use browser session tokens');
    const body = JSON.parse(options.body); calls.push(body);
    if (body.action === 'load') return Response.json({ partner: { name: 'Partner Test' } });
    return submitError ? Response.json({ error: 'Please contact PulseFX before submitting again.' }, { status: 502 }) : Response.json({ submitted: true }, { status: 201 });
  };
  root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(<React.StrictMode><PartnerReferralForm token="signed-test-token" /></React.StrictMode>); });
}
async function fill(id, value) {
  await act(async () => {
    const element = document.getElementById(id);
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value').set.call(element, value);
    for (const type of ['input', 'change', 'propertychange']) {
      const event = new window.Event(type, { bubbles: true });
      if (type === 'propertychange') event.propertyName = 'value';
      element.dispatchEvent(event);
    }
  });
}
async function submit() {
  await act(async () => { document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); });
}
afterEach(async () => { await act(async () => root?.unmount()); root = null; resetDom(); submitError = false; });
after(() => supabase?.auth.stopAutoRefresh());
test('public link opens the existing modal with read-only partner and required fields', async () => {
  await mount();
  assert.ok(document.querySelector('dialog[open]'));
  assert.match(document.querySelector('dialog').getAttribute('aria-label'), /Partner Test/);
  assert.equal(document.getElementById('public-partner').value, 'Partner Test');
  assert.ok(document.getElementById('public-partner').hasAttribute('readOnly'), document.getElementById('public-partner').outerHTML);
  for (const name of ['firstName', 'lastName', 'email']) assert.ok(document.getElementById(`public-${name}`).hasAttribute('required'));
  assert.equal(document.querySelectorAll('input[type="checkbox"]').length, 4);
});
test('submitting the modal sends input with its link and stable submission ID, then shows confirmation', async () => {
  await mount();
  await fill('public-firstName', 'Ana'); await fill('public-lastName', 'Costa'); await fill('public-email', 'ana@example.com');
  await submit();
  const sent = calls.find(call => call.action === 'submit');
  assert.equal(sent.firstName, 'Ana'); assert.equal(sent.token, 'signed-test-token'); assert.ok(sent.submissionId);
  assert.equal(sent.source, undefined); assert.equal(sent.partnerId, undefined);
  assert.match(document.querySelector('[role="status"]').textContent, /Thank you/);
  assert.equal(document.querySelector('form'), null);
});
test('an uncertain save retains the same submission ID on retry and displays the error', async () => {
  submitError = true;
  await mount();
  await fill('public-firstName', 'Ana'); await fill('public-lastName', 'Costa'); await fill('public-email', 'ana@example.com');
  await submit(); await submit();
  const sent = calls.filter(call => call.action === 'submit');
  assert.equal(sent.length, 2); assert.equal(sent[0].submissionId, sent[1].submissionId);
  assert.match(document.querySelector('[role="alert"]').textContent, /contact PulseFX/);
});

test('Submit stays disabled until mandatory names and a valid email are filled', async () => {
  await mount();
  const button = () => document.querySelector('button[type="submit"]');
  assert.equal(button().disabled, true);
  await fill('public-firstName', 'Ana');
  await fill('public-lastName', 'Costa');
  assert.equal(button().disabled, true);
  await fill('public-email', 'invalid');
  assert.equal(button().disabled, true);
  await fill('public-email', 'ana@example.com');
  assert.equal(button().disabled, false);
  await fill('public-firstName', '   ');
  assert.equal(button().disabled, true);
});
