import test from "node:test";
import assert from "node:assert/strict";
import { createRecoveryHandler } from "./service.mjs";
function fixture({ missing = false, disabled = false, recent = false, failedWrite = false, mismatch = false, membershipDisabled = false } = {}) {
  const writes = [], generated = [];
  const row = { id: 'registration', email: 'partner@example.test', user_id: 'user', partner_id: 'rec123', ready: true, disabled };
  const admin = {
    from(table) {
      let update;
      const query = { select() { return query; }, eq() { return query; }, or() { return query; }, update(value) { update = value; return query; }, async maybeSingle() {
        if (update) return { data: { id: row.id } };
        return { data: table === 'partner_memberships' ? { enabled: !membershipDisabled, partner_id: row.partner_id } : missing ? null : row };
      }, then(resolve) { return Promise.resolve({ data: null }).then(resolve); } };
      return query;
    },
    auth: { admin: {
      async getUserById() { return { data: { user: { id: 'user', email: row.email, email_confirmed_at: '2026-01-01', app_metadata: { partner_registration_id: mismatch ? 'other' : row.id } } } }; },
      async generateLink(input) { generated.push(input); return { data: { user: { id: 'user' }, properties: { hashed_token: 'private-token' } } }; },
    } },
  };
  const env = { AIRTABLE_TOKEN: 'secret', AIRTABLE_BASE_ID: 'base', AIRTABLE_RECOVERY_TABLE_ID: 'table', PORTAL_URL: 'https://portal.example/pulseFx/?old=1#old' };
  const handler = createRecoveryHandler({ env, admin, fetchImpl: async (_url, options) => {
    if (options.method !== 'POST') return Response.json({ records: recent ? [{}] : [] });
    writes.push(JSON.parse(options.body));
    return Response.json({}, { status: failedWrite ? 500 : 200 });
  } });
  const request = (body = { email: ' Partner@example.test ' }) => handler(new Request('https://edge.test', { method: 'POST', body: JSON.stringify(body) }));
  return { handler, request, writes, generated };
}
test('queues a private link for the verified email and never returns the token', async () => {
  const f = fixture(); const response = await f.request();
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { accepted: true });
  assert.equal(f.writes[0].fields.Email, 'partner@example.test');
  assert.equal(f.writes[0].fields['Recovery link'], 'https://portal.example/pulseFx/?token_hash=private-token&type=recovery');
  assert.equal(f.writes[0].fields.Status, 'Pending');
  assert.equal(f.generated[0].type, 'recovery');
});
test('unavailable accounts are audited with status and error while returning the same acknowledgement', async () => {
  for (const options of [{ missing: true }, { disabled: true }, { mismatch: true }, { membershipDisabled: true }]) {
    const f = fixture(options);
    assert.deepEqual(await (await f.request()).json(), { accepted: true });
    assert.equal(f.generated.length, 0); assert.equal(f.writes.length, 1);
    const fields = f.writes[0].fields;
    assert.equal(fields.Status, options.missing ? 'Account not found' : 'Account inactive');
    assert.equal(fields.Email, 'partner@example.test');
    assert.equal(fields.Source, 'Partner Login Page');
    assert.ok(fields.Error.length > 0);
    assert.ok(fields['Requested at']);
    assert.equal(fields['Recovery link'], undefined);
  }
});
test('recent requests do not regenerate or enqueue another link', async () => {
  const f = fixture({ recent: true }); assert.equal((await f.request()).status, 202);
  assert.equal(f.generated.length, 0); assert.equal(f.writes.length, 0);
});
test('validates email and rejects forged fields', async () => {
  const f = fixture();
  for (const body of [null, [], {}, { email: 'invalid' }, { email: 'partner@example.test', link: 'forged' }]) assert.equal((await f.request(body)).status, 400);
  assert.equal(f.writes.length, 0);
});
test('failed queue writes do not report success or return private links', async () => {
  const f = fixture({ failedWrite: true }); const response = await f.request();
  assert.equal(response.status, 502); assert.ok(!(await response.text()).includes('private-token'));
});

test('audit write failures return the generic error without exposing account details', async () => {
  for (const options of [{ missing: true }, { disabled: true }]) {
    const f = fixture({ ...options, failedWrite: true });
    const response = await f.request();
    assert.equal(response.status, 502);
    assert.ok(!(await response.text()).includes('Account not found'));
    assert.equal(f.generated.length, 0);
  }
});
