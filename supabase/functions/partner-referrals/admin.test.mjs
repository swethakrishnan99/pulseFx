import test from 'node:test';
import assert from 'node:assert/strict';
import { createReferralsHandler } from './service.mjs';

const id = 'rec00000000000001', partnerId = 'rec00000000000002';
const actor = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.com', app_metadata: { role: 'partner_admin' } };
const session = '22222222-2222-4222-8222-222222222222';
const bearer = `header.${btoa(JSON.stringify({ session_id: session }))}.signature`;
const env = { SUPABASE_URL: 'https://project.example', SUPABASE_ANON_KEY: 'public', AIRTABLE_TOKEN: 'secret', AIRTABLE_BASE_ID: 'base', AIRTABLE_REFERRALS_TABLE_ID: 'Referrals_api', AIRTABLE_PARTNERS_TABLE_ID: 'Partners_api' };
const modified = '2026-11-16T18:00:00.000Z';
function setup(options = {}) {
  const calls = [], rpcs = [];
  let fields = { Company: 'Smile', Contact: 'Contact', Email: 'client@example.com', Status: 'Invited', Partner: [partnerId], Created: modified, 'Last modified': modified };
  const fetchImpl = async (target, init = {}) => {
    const url = new URL(target); calls.push({ url, ...init });
    if (url.pathname === '/auth/v1/user') return Response.json(options.user || actor);
    if (url.pathname.endsWith('/Partners_api')) return Response.json({ records: [{ id: partnerId, fields: { Name: 'Partner A' } }] });
    if (init.method === 'PATCH') {
      if (options.failWrite) return new Response('', { status: 500 });
      fields = { ...fields, ...JSON.parse(init.body).fields, 'Last modified': '2026-11-16T19:00:00.000Z' };
      return Response.json({ id, fields });
    }
    if (url.pathname.endsWith(`/${id}`)) return Response.json({ id, fields });
    if (url.searchParams.get('offset')) return Response.json({ records: [] });
    return Response.json({ records: [{ id, fields }], ...(options.paginate ? { offset: 'next' } : {}) });
  };
  const admin = { rpc: async (name, args) => {
    rpcs.push({ name, args });
    return { data: name === 'portal_admin_session_valid' ? options.sessionValid !== false : name === 'claim_referral_followup' ? options.lockAvailable !== false : null, error: null };
  } };
  const handler = createReferralsHandler({ env, admin, fetchImpl });
  const request = (body, view = 'admin') => handler(new Request(`https://function.example/partner-referrals?view=${view}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}),
  }));
  return { request, calls, rpcs };
}
const update = overrides => ({ id, status: 'Under review', expectedStatus: 'Invited', expectedModifiedAt: modified, ...overrides });

test('admin listing includes referrals across partners, paginates and resolves partner names', async () => {
  const { request, calls } = setup({ paginate: true });
  const response = await request(); assert.equal(response.status, 200);
  const { referrals } = await response.json();
  assert.equal(referrals[0].partnerName, 'Partner A');
  assert.equal(referrals[0].modifiedByUserId, '');
  assert.ok(calls.some(call => call.url.searchParams.get('offset') === 'next'));
});
test('partners cannot list or modify admin referrals', async () => {
  for (const body of [undefined, update()]) {
    const { request, calls } = setup({ user: { ...actor, app_metadata: { role: 'partner' } } });
    assert.equal((await request(body)).status, 403);
    assert.equal(calls.length, 1);
  }
});
test('revoked admin sessions cannot access Airtable', async () => {
  const { request, calls } = setup({ sessionValid: false });
  assert.equal((await request(update())).status, 401); assert.equal(calls.length, 1);
});
test('status and actor fields are saved together from authenticated identity', async () => {
  const { request, calls, rpcs } = setup();
  const response = await request(update()); assert.equal(response.status, 200);
  const { referral } = await response.json();
  assert.equal(referral.status, 'Under review'); assert.equal(referral.modifiedByUserId, actor.id);
  assert.equal(referral.modifiedAt, '2026-11-16T19:00:00.000Z');
  const patch = calls.find(call => call.method === 'PATCH');
  assert.deepEqual(JSON.parse(patch.body), { fields: { Status: 'Under review', 'Last modified by user ID': actor.id, 'Last modified by email': actor.email } });
  assert.equal(rpcs.at(-1).name, 'release_referral_followup');
});
test('invalid statuses and forged attribution are rejected without a write', async () => {
  for (const body of [update({ status: 'Fake' }), update({ modifiedByUserId: 'forged' }), update({ id: '../other' })]) {
    const { request, calls } = setup(); assert.equal((await request(body)).status, 400);
    assert.ok(!calls.some(call => call.method === 'PATCH'));
  }
});
test('stale status or timestamp cannot overwrite a newer change', async () => {
  for (const body of [update({ expectedStatus: 'Onboarded' }), update({ expectedModifiedAt: '' })]) {
    const { request, calls, rpcs } = setup(); assert.equal((await request(body)).status, 409);
    assert.ok(!calls.some(call => call.method === 'PATCH'));
    assert.equal(rpcs.at(-1).name, 'release_referral_followup');
  }
});
test('concurrent writes are blocked before reading or patching the referral', async () => {
  const { request, calls } = setup({ lockAvailable: false }); assert.equal((await request(update())).status, 409);
  assert.equal(calls.length, 1);
});
test('unchanged status does not overwrite the modifier or modification date', async () => {
  const { request, calls } = setup(); assert.equal((await request(update({ status: 'Invited' }))).status, 200);
  assert.ok(!calls.some(call => call.method === 'PATCH'));
});
test('uncertain write reports a refresh requirement and releases the lease', async () => {
  const { request, rpcs } = setup({ failWrite: true }); const response = await request(update());
  assert.equal(response.status, 502); assert.match((await response.json()).error, /refresh/i);
  assert.equal(rpcs.at(-1).name, 'release_referral_followup');
});
