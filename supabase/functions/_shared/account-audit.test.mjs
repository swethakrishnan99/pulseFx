import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountAudit } from './account-audit.mjs';

function fixture() {
  const rows = [];
  let failure = false;
  const admin = { from(table) {
    assert.equal(table, 'portal_account_audit');
    return {
      async upsert(row, options) {
        assert.equal(options.ignoreDuplicates, true);
        if (failure) return { error: {} };
        if (!rows.some(existing => existing.account_kind === row.account_kind && existing.account_id === row.account_id && existing.event === row.event)) rows.push(row);
        return { data: null };
      },
      select() { return query(false); }, delete() { return query(true); },
    };
  } };
  function query(remove) {
    const filters = [];
    return {
      eq(key, value) { filters.push(row => row[key] === value); return this; },
      in(key, values) { filters.push(row => values.includes(row[key])); return this; },
      then(resolve, reject) {
        const selected = rows.filter(row => filters.every(filter => filter(row)));
        if (remove && !failure) selected.forEach(row => rows.splice(rows.indexOf(row), 1));
        return Promise.resolve(failure ? { error: {} } : { data: selected }).then(resolve, reject);
      },
    };
  }
  return { audit: createAccountAudit(admin), fail: () => { failure = true; } };
}
const actor = { id: 'verified-actor', email: 'creator@example.test' };
test('snapshots persist original actor across retries and stay scoped to account kind', async () => {
  const { audit } = fixture();
  await audit.record('partner', 'id', 'created', actor);
  await audit.record('partner', 'id', 'created', { id: 'other', email: 'other@example.test' });
  const [partner] = await audit.enrich('partner', [{ id: 'id' }]);
  assert.equal(partner.createdByEmail, actor.email);
  assert.deepEqual(await audit.enrich('admin', [{ id: 'id' }]), [{ id: 'id' }]);
});
test('reactivation clears current deactivation, preserves creator and permits a new disable cycle', async () => {
  const { audit } = fixture();
  await audit.record('admin', 'id', 'created', actor);
  await audit.record('admin', 'id', 'deactivated', actor);
  let [account] = await audit.enrich('admin', [{ id: 'id' }]);
  assert.ok(Number.isFinite(Date.parse(account.deactivatedAt)));
  assert.equal(account.deactivatedByEmail, actor.email);
  await audit.reactivate('admin', 'id');
  [account] = await audit.enrich('admin', [{ id: 'id' }]);
  assert.equal(account.createdByEmail, actor.email);
  assert.equal(account.deactivatedAt, undefined);
  await audit.record('admin', 'id', 'deactivated', { id: 'new', email: 'new@example.test' });
  assert.equal((await audit.enrich('admin', [{ id: 'id' }]))[0].deactivatedByEmail, 'new@example.test');
});
test('unknown historical accounts stay unknown and database failures do not report success', async () => {
  const f = fixture();
  assert.deepEqual(await f.audit.enrich('partner', [{ id: 'old' }]), [{ id: 'old' }]);
  f.fail();
  await assert.rejects(f.audit.record('partner', 'id', 'created', actor));
  await assert.rejects(f.audit.enrich('partner', [{ id: 'id' }]));
  await assert.rejects(f.audit.reactivate('partner', 'id'));
});
