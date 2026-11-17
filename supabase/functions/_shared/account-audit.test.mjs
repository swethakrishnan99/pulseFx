import test from 'node:test';
import assert from 'node:assert/strict';
import { createPartnerAccountAudit, createAdminAccountAudit } from './account-audit.mjs';
const id = '10000000-0000-4000-8000-000000000001';
const partnerId = 'rec12345678901234';
const actor = { id: 'verified-actor', email: 'operator@example.test' };
function airtableFixture() {
  let fields = { 'Portal ID': id, Name: 'Partner' };
  const calls = [];
  let status = 200;
  let ignoreWrites = false;
  const audit = createPartnerAccountAudit({ env: { AIRTABLE_TOKEN: 'private', AIRTABLE_BASE_ID: 'app-test', AIRTABLE_PARTNERS_TABLE_ID: 'Partners' },
    fetchImpl: async (input, options) => {
      const url = new URL(input);
      calls.push({ url, options });
      if (status !== 200) return Response.json({ secret: 'private-upstream-error' }, { status });
      if (options.method === 'PATCH' && !ignoreWrites) {
        Object.assign(fields, JSON.parse(options.body).fields);
        for (const key of Object.keys(fields)) if (fields[key] === null) delete fields[key];
      }
      const record = { id: partnerId, fields: { ...fields } };
      return Response.json(url.pathname.endsWith(partnerId) ? record : { records: [record] });
    } });
  return { audit, calls, fields: () => fields, set: value => { fields = value; }, fail: value => { status = value; }, ignore: () => { ignoreWrites = true; } };
}
test('partner audit writes exact Airtable fields, preserves originals on retry and confirms persisted values', async () => {
  const f = airtableFixture();
  await f.audit.record('partner', id, 'created', actor, partnerId);
  await f.audit.record('partner', id, 'created', { email: 'other@example.test' }, partnerId);
  await f.audit.record('partner', id, 'deactivated', actor, partnerId);
  const firstDate = f.fields()['Deactivated at'];
  await f.audit.record('partner', id, 'deactivated', { email: 'other@example.test' }, partnerId);
  assert.equal(f.fields()['Created by email'], actor.email);
  assert.equal(f.fields()['Deactivated by email'], actor.email);
  assert.equal(f.fields()['Deactivated at'], firstDate);
  assert.ok(Number.isFinite(Date.parse(firstDate)));
  assert.equal(f.calls.filter(call => call.options.method === 'PATCH').length, 2);
  const [account] = await f.audit.enrich('partner', [{ id, airtableId: partnerId }]);
  assert.equal(account.createdByEmail, actor.email);
  assert.equal(account.deactivatedAt, firstDate);
  assert.equal(account.deactivatedByEmail, actor.email);
  assert.equal(f.fields().Name, 'Partner');
});
test('reactivation clears only deactivation and permits a new disable cycle', async () => {
  const f = airtableFixture();
  await f.audit.record('partner', id, 'created', actor, partnerId);
  await f.audit.record('partner', id, 'deactivated', actor, partnerId);
  await f.audit.reactivate('partner', id, partnerId);
  assert.equal(f.fields()['Created by email'], actor.email);
  assert.equal(f.fields()['Deactivated at'], undefined);
  assert.equal(f.fields()['Deactivated by email'], undefined);
  await f.audit.record('partner', id, 'deactivated', { email: 'new@example.test' }, partnerId);
  assert.equal(f.fields()['Deactivated by email'], 'new@example.test');
});
test('historical and incomplete records stay unknown without inventing actors or dates', async () => {
  const f = airtableFixture();
  const [account] = await f.audit.enrich('partner', [{ id, airtableId: partnerId }]);
  assert.equal(account.createdByEmail, null);
  assert.equal(account.deactivatedAt, null);
  await f.audit.record('partner', id, 'deactivated', actor, null);
  assert.equal(f.calls.filter(call => call.options.method === 'PATCH').length, 0);
});
test('record ownership is checked and provider errors or unconfirmed writes cannot report success', async () => {
  const f = airtableFixture();
  f.set({ 'Portal ID': 'different-partner' });
  await assert.rejects(f.audit.record('partner', id, 'created', actor, partnerId));
  assert.equal(f.calls.filter(call => call.options.method === 'PATCH').length, 0);
  f.set({ 'Portal ID': id }); f.ignore();
  await assert.rejects(f.audit.record('partner', id, 'created', actor, partnerId));
  f.fail(422);
  await assert.rejects(f.audit.enrich('partner', [{ id, airtableId: partnerId }]), error => !error.message.includes('private'));
});
test('list enrichment checks both registration and Airtable IDs and reads only allowed fields', async () => {
  const f = airtableFixture();
  f.set({ 'Portal ID': id, 'Created by email': 'real@example.test' });
  const [account] = await f.audit.enrich('partner', [{ id, airtableId: 'rec00000000000000' }]);
  assert.equal(account.createdByEmail, null);
  assert.deepEqual(f.calls[0].url.searchParams.getAll('fields[]'), ['Portal ID', 'Created by email', 'Deactivated at', 'Deactivated by email']);
});
function authFixture() {
  let user = { id, app_metadata: { role: 'partner_admin', unrelated: 'keep' }, user_metadata: { full_name: 'Keep' } };
  const auth = { admin: {
    getUserById: async () => ({ data: { user } }),
    updateUserById: async (_, input) => { user = { ...user, ...input }; return { data: { user } }; },
  } };
  return { audit: createAdminAccountAudit(auth), user: () => user };
}
test('internal admin audit uses trusted metadata, preserves unrelated data and resets the disable cycle', async () => {
  const f = authFixture();
  await f.audit.record('admin', id, 'created', actor);
  await f.audit.record('admin', id, 'created', { email: 'other@example.test' });
  await f.audit.record('admin', id, 'deactivated', actor);
  let [account] = await f.audit.enrich('admin', [{ id }]);
  assert.equal(account.createdByEmail, actor.email);
  assert.equal(account.deactivatedByEmail, actor.email);
  await f.audit.reactivate('admin', id);
  [account] = await f.audit.enrich('admin', [{ id }]);
  assert.equal(account.deactivatedAt, null);
  assert.equal(account.createdByEmail, actor.email);
  assert.equal(f.user().app_metadata.role, 'partner_admin');
  assert.equal(f.user().app_metadata.unrelated, 'keep');
  assert.equal(f.user().user_metadata.full_name, 'Keep');
});
