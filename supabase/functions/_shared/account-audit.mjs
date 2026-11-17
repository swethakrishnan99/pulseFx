const AUDIT_FIELDS = ['Created by email', 'Deactivated at', 'Deactivated by email'];
const recordId = /^rec[A-Za-z0-9]{14}$/;
const uuid = /^[0-9a-f-]{36}$/i;
const failure = () => new Error('Unable to read or save account audit details.');
function values(fields = {}) {
  return { createdByEmail: fields['Created by email'] || null,
    deactivatedAt: fields['Deactivated at'] || null,
    deactivatedByEmail: fields['Deactivated by email'] || null };
}

// Partners use their existing Airtable record. The sync worker never writes these fields.
export function createPartnerAccountAudit({ env, fetchImpl = fetch }) {
  function baseUrl() {
    if (!env.AIRTABLE_TOKEN || !env.AIRTABLE_BASE_ID) throw failure();
    return `https://api.airtable.com/v0/${encodeURIComponent(env.AIRTABLE_BASE_ID)}/${encodeURIComponent(env.AIRTABLE_PARTNERS_TABLE_ID || 'Partners')}`;
  }
  async function call(url, options = {}) {
    const response = await fetchImpl(url, { ...options,
      headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw failure();
    return response.json();
  }
  async function record(id, partnerId) {
    if (!recordId.test(partnerId || '') || !uuid.test(id)) throw failure();
    const result = await call(`${baseUrl()}/${partnerId}`);
    if (result.id !== partnerId || result.fields?.['Portal ID'] !== id) throw failure();
    return result;
  }
  async function patch(id, partnerId, fields) {
    await call(`${baseUrl()}/${partnerId}`, { method: 'PATCH', body: JSON.stringify({ fields }) });
    // Confirm writes without exposing Airtable/provider response details.
    const saved = await record(id, partnerId);
    for (const [key, value] of Object.entries(fields)) {
      const actual = saved.fields[key];
      if (value === null ? actual != null : key === 'Deactivated at'
        ? Date.parse(actual) !== Date.parse(value) : actual !== value) throw failure();
    }
  }
  return {
    async record(kind, id, event, actor, partnerId) {
      if (kind !== 'partner' || !['created', 'deactivated'].includes(event)) throw failure();
      // Incomplete registrations may not yet have an Airtable business record.
      if (!partnerId) return;
      const current = await record(id, partnerId);
      if (event === 'created') {
        if (!current.fields['Created by email']) await patch(id, partnerId, { 'Created by email': actor.email || null });
      } else if (!current.fields['Deactivated at']) {
        await patch(id, partnerId, { 'Deactivated at': new Date().toISOString(), 'Deactivated by email': actor.email || null });
      }
    },
    async reactivate(kind, id, partnerId) {
      if (kind !== 'partner') throw failure();
      if (!partnerId) return;
      await record(id, partnerId);
      await patch(id, partnerId, { 'Deactivated at': null, 'Deactivated by email': null });
    },
    async enrich(kind, accounts) {
      if (kind !== 'partner') throw failure();
      const linked = accounts.filter(account => recordId.test(account.airtableId || '') && uuid.test(account.id));
      const byId = new Map();
      // Batch reads rather than issuing one request per partner.
      for (let i = 0; i < linked.length; i += 50) {
        const batch = linked.slice(i, i + 50);
        let offset;
        do {
          const url = new URL(baseUrl());
          url.searchParams.set('pageSize', '100');
          url.searchParams.set('filterByFormula', `OR(${batch.map(account => `{Portal ID}='${account.id}'`).join(',')})`);
          for (const field of ['Portal ID', ...AUDIT_FIELDS]) url.searchParams.append('fields[]', field);
          if (offset) url.searchParams.set('offset', offset);
          const result = await call(url);
          if (!Array.isArray(result.records)) throw failure();
          for (const row of result.records) {
            const account = batch.find(account => account.id === row.fields?.['Portal ID'] && account.airtableId === row.id);
            if (account) byId.set(account.id, values(row.fields));
          }
          offset = result.offset;
        } while (offset);
      }
      return accounts.map(account => ({ ...account, ...values(), ...byId.get(account.id) }));
    },
  };
}

// Internal admins have no Airtable partner record; trusted Auth metadata holds their audit.
export function createAdminAccountAudit(auth) {
  async function read(id) {
    const result = await auth.admin.getUserById(id);
    if (result.error || result.data?.user?.id !== id || result.data.user.app_metadata?.role !== 'partner_admin') throw failure();
    return result.data.user;
  }
  async function save(user, audit) {
    const result = await auth.admin.updateUserById(user.id, { app_metadata: { ...user.app_metadata, portal_account_audit: audit } });
    if (result.error) throw failure();
  }
  return {
    async record(kind, id, event, actor) {
      if (kind !== 'admin' || !['created', 'deactivated'].includes(event)) throw failure();
      const user = await read(id);
      const audit = { ...user.app_metadata.portal_account_audit };
      if (audit[event]) return;
      audit[event] = { actor_id: actor.id, actor_email: actor.email || null, occurred_at: new Date().toISOString() };
      await save(user, audit);
    },
    async reactivate(kind, id) {
      if (kind !== 'admin') throw failure();
      const user = await read(id);
      const audit = { ...user.app_metadata.portal_account_audit };
      delete audit.deactivated;
      await save(user, audit);
    },
    async enrich(kind, accounts) {
      if (kind !== 'admin') throw failure();
      const result = [];
      // Bound Auth requests for potentially larger admin lists.
      for (let i = 0; i < accounts.length; i += 5) {
        result.push(...await Promise.all(accounts.slice(i, i + 5).map(async account => {
          const user = await read(account.id);
          const audit = user.app_metadata.portal_account_audit || {};
          return { ...account, createdByEmail: audit.created?.actor_email || null,
            deactivatedAt: audit.deactivated?.occurred_at || null,
            deactivatedByEmail: audit.deactivated?.actor_email || null };
        })));
      }
      return result;
    },
  };
}
