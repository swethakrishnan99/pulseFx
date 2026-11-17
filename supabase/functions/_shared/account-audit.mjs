// Server-only snapshots. First write wins so retries preserve the original actor/time.
export function createAccountAudit(admin) {
  function check(result) {
    if (result.error) throw new Error('Unable to read or save account audit details.');
    return result.data;
  }
  return {
    async record(kind, id, event, actor) {
      check(await admin.from('portal_account_audit').upsert({
        account_kind: kind, account_id: id, event,
        actor_id: actor.id, actor_email: actor.email || null,
        occurred_at: new Date().toISOString(),
      }, { onConflict: 'account_kind,account_id,event', ignoreDuplicates: true }));
    },
    async reactivate(kind, id) {
      check(await admin.from('portal_account_audit').delete()
        .eq('account_kind', kind).eq('account_id', id).eq('event', 'deactivated'));
    },
    async enrich(kind, accounts) {
      if (!accounts.length) return accounts;
      const rows = check(await admin.from('portal_account_audit')
        .select('account_id,event,actor_email,occurred_at')
        .eq('account_kind', kind).in('account_id', accounts.map(account => account.id)));
      const audit = new Map();
      for (const row of rows) {
        const value = audit.get(row.account_id) || {};
        if (row.event === 'created') value.createdByEmail = row.actor_email;
        if (row.event === 'deactivated') {
          value.deactivatedAt = row.occurred_at;
          value.deactivatedByEmail = row.actor_email;
        }
        audit.set(row.account_id, value);
      }
      return accounts.map(account => ({ ...account, ...audit.get(account.id) }));
    },
  };
}
