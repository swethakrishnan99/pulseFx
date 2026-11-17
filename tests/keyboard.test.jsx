import { window, document, resetDom } from './keyboardDom.mjs';
import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React, { act } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import KeyboardNavigation from '../src/components/KeyboardNavigation';
import PortalDialog from '../src/components/PortalDialog';
import ProfileMenu from '../src/components/ProfileMenu';
import SearchableSelect from '../src/components/SearchableSelect';
import Account from '../src/components/Account';
import PartnerAdmin, { InviteDialog } from '../src/components/PartnerAdmin';
import Beneficiaries from '../src/components/Beneficiaries';
import HoldingAccounts from '../src/components/HoldingAccounts';
import Reports from '../src/components/Reports';
import TradeFinance from '../src/components/Tradefinance';
import NewFinanceRequest from '../src/components/NewFinanceRequest';
import SendPayment from '../src/components/SendPayment';
import Forwards from '../src/components/Forwardsdrawdown';
import Login from '../src/components/Login';
import BankingDetails from '../src/components/BankingDetails';
import PartnerPortal from '../src/components/PartnerPortal';
import HistoricalRates from '../src/components/HistoricalRates';
import HelpSupport from '../src/components/HelpSupport';
import PartnerEdit from '../src/components/PartnerEdit';
import { PayoutDialog } from '../src/components/AdminPayouts';
import DateRangeFilter from '../src/components/DateRangeFilter';
import ClientApp from '../src/ClientApp';
import Sidebar from '../src/components/Sidebar';
import Documents from '../src/components/Documents';
import BankingApprovals from '../src/components/BankingApprovals';
import PayoutHistory from '../src/components/PayoutHistory';
import AdminPayouts from '../src/components/AdminPayouts';
import ActionButton from '../src/components/ActionButton';
import { supabase } from '../src/lib/supabase';
import { keyboardStops } from '../src/lib/keyboardFocus';

// DOM integration, not a substitute for browser layout/assistive technology QA.
// Supply layout and native dialog/focus APIs absent from linkedom; real React
// markup, event handlers, selectors, state updates and focus sequences run below.
const { createRoot } = await import('react-dom/client');
after(() => supabase?.auth.stopAutoRefresh());
let root;
const container = document.getElementById('root');
async function mount(content, { path = "/", route, withMain = true } = {}) {
  root = createRoot(container);
  await act(async () => { root.render(<React.StrictMode><MemoryRouter initialEntries={[path]}><KeyboardNavigation />{route ? <Routes><Route path={route} element={content} /></Routes> : withMain ? <main id="main-content">{content}</main> : content}</MemoryRouter></React.StrictMode>); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 15)); });
}
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; container.innerHTML = ''; resetDom(); });
function button(text) {
  const found = [...document.querySelectorAll('button')].find(element => element.textContent.trim() === text || element.getAttribute('aria-label') === text);
  assert.ok(found, `button: ${text}`); return found;
}
async function click(element) { await act(async () => { element.focus(); element.click(); }); }
async function key(value, shiftKey = false) {
  let prevented;
  await act(async () => {
    const event = new window.Event('keydown', { bubbles: true, cancelable: true });
    Object.assign(event, { key: value, shiftKey });
    document.activeElement.dispatchEvent(event);
    prevented = event.defaultPrevented;
  });
  return prevented;
}
function expectFocus(element) { assert.ok(document.activeElement === element, `expected focus: ${element?.id || element?.textContent || element?.tagName}; actual: ${document.activeElement?.id || document.activeElement?.textContent || document.activeElement?.tagName}`); }
async function walk(stops, wrap = false) {
  assert.ok(stops.length);
  stops[0].focus();
  for (const next of stops.slice(1)) { await key('Tab'); expectFocus(next); }
  if (wrap) { await key('Tab'); expectFocus(stops[0]); await key('Tab', true); expectFocus(stops.at(-1)); }
  else stops.at(-1).focus();
  for (const previous of stops.slice(0, -1).reverse()) { await key('Tab', true); expectFocus(previous); }
}

test('Add admin: actual dialog reaches checkbox after email and wraps both ways', async () => {
  await mount(<PartnerAdmin />);
  await click(button('Add admin'));
  const email = document.getElementById('add-admin-email');
  const checkbox = document.querySelector('dialog input[type="checkbox"]');
  email.focus(); await key('Tab'); expectFocus(checkbox);
  await key(' '); // Space must not be consumed by the Tab handler.
  await walk(keyboardStops(document.querySelector('dialog')), true);
});

test('page controls include selects, checkboxes, switches, links and buttons after text fields', async () => {
  await mount(<form><input id="email" type="email" /><select id="country"><option>Canada</option></select><input id="check" type="checkbox" /><button type="button" role="switch">Toggle</button><a href="#example">Help</a><button>Submit</button><button disabled>Disabled</button><input hidden /></form>);
  const stops = keyboardStops(container);
  assert.equal(stops.length, 7); // skip link plus six form controls
  await walk(stops);
});

test('account menu opens without selector errors, supports arrows, Escape and Tab exit', async () => {
  await mount(<><ProfileMenu /><button>After menu</button></>);
  const trigger = button('Account menu');
  await click(trigger); expectFocus(button('User settings'));
  await key('ArrowDown'); expectFocus(button('Logout'));
  await key('Escape'); expectFocus(trigger); assert.equal(document.querySelector('[role="menu"]'), null);
  await key('ArrowUp'); expectFocus(button('Logout'));
  await key('Tab'); expectFocus(button('After menu'));
});

test('historical rates menu supports keyboard opening, navigation and dismissal', async () => {
  await mount(<HistoricalRates />);
  const trigger = button('More options'); trigger.focus();
  await key('ArrowDown'); expectFocus(button('Update watchlist'));
  await key('End'); expectFocus(button('Set rate alerts'));
  await key('Escape'); expectFocus(trigger);
});

for (const [name, component] of [
  ['Login', <Login />], ['Beneficiaries', <Beneficiaries />], ['Accounts', <HoldingAccounts />],
  ['Reports', <Reports />], ['Trade finance', <TradeFinance />], ['Move money', <SendPayment />],
  ['Forwards', <Forwards />], ['Banking', <BankingDetails />], ['Help', <HelpSupport />],
  ['Account profile', <Account />], ['Account security', <Account tab="security" />], ['Account notifications', <Account tab="notifications" />],
]) {
  test(`${name}: all available controls can be traversed forward and backward`, async () => {
    await mount(component); await walk(keyboardStops(container));
  });
}

for (const [name, component] of [
  ['New finance request', <NewFinanceRequest onClose={() => {}} />],
  ['Edit administrator', <PartnerEdit partner={{ id: 'test', role: 'partner_admin', name: 'Test Admin', email: 'test@example.com' }} onClose={() => {}} />],
  ['Edit partner', <PartnerEdit partner={{ id: 'test', name: 'Test Partner', company: 'Example', email: 'test@example.com' }} onClose={() => {}} />],
]) {
  test(`${name}: controls stay within the dialog in both directions`, async () => {
    await mount(component); await walk(keyboardStops(document.querySelector('dialog')), true);
  });
}

test('beneficiary add form: all labels target fields and conditional bank fields follow address fields', async () => {
  await mount(<Beneficiaries />); await click(button('Add beneficiary'));
  const form = document.querySelector('form');
  for (const control of form.querySelectorAll('input, select, textarea')) {
    assert.ok(control.id); assert.ok(form.querySelector(`label[for="${control.id}"]`));
  }
  await walk(keyboardStops(container));
});

test('beneficiary column chooser: checkboxes receive focus; Escape returns to trigger', async () => {
  await mount(<Beneficiaries />); const trigger = button('Choose columns'); await click(trigger);
  expectFocus(document.querySelector('[role="dialog"] input'));
  await key('Escape'); expectFocus(trigger); assert.equal(document.querySelector('[role="dialog"]'), null);
});

test('tabs have one Tab stop and arrows activate the next panel without submitting', async () => {
  await mount(<Account />);
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  assert.equal(tabs.filter(tab => tab.tabIndex === 0).length, 1);
  tabs[0].focus(); await key('ArrowRight'); expectFocus(tabs[1]);
  assert.equal(tabs[1].getAttribute('aria-selected'), 'true');
  assert.equal(document.querySelector('[role="tabpanel"]').getAttribute('aria-labelledby'), tabs[1].id);
});

test('dialog success state recovers focus after the form is removed', async () => {
  function Example() {
    const [saved, setSaved] = React.useState(false);
    return <PortalDialog title="Example" onClose={() => {}}>{saved ? <div role="status"><button>Done</button></div> : <form onSubmit={event => event.preventDefault()}><input /><button type="button" onClick={() => setSaved(true)}>Save</button></form>}</PortalDialog>;
  }
  await mount(<Example />); await click(button('Save')); expectFocus(button('Done'));
});

async function fill(element, value) {
  await act(async () => {
    element.focus();
    if (element.tagName === 'SELECT') {
      const option = [...element.options].find(option => (option.getAttribute('value') ?? option.textContent) === value);
      assert.ok(option, `select option: ${value}`);
      option.selected = true;
    } else {
      const property = element.type === 'checkbox' ? 'checked' : 'value';
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), property);
      if (descriptor?.set) descriptor.set.call(element, value);
      else element[property] = value;
    }
    for (const type of element.type === 'checkbox' ? ['click'] : ['input', 'change', 'propertychange']) {
      const event = new window.Event(type, { bubbles: true });
      if (type === 'propertychange') event.propertyName = 'value';
      element.dispatchEvent(event);
    }
  });
}

for (const page of ['home', 'referrals', 'add', 'banking', 'payouts', 'brand', 'guide', 'contact']) {
  test(`Partner ${page}: real routed page traverses all controls`, async () => {
    await mount(<PartnerPortal basePath="/demo" onExit={() => {}} />, { path: `/demo/${page}`, route: '/demo/:page?', withMain: false });
    const dialog = document.querySelector('dialog');
    await walk(keyboardStops(dialog || container), !!dialog);
  });
}

for (const [mode, payout] of [['create', null], ['edit', { id: 'payout', ref: 'PAY-TEST', partnerId: 'partner', amount: 100, status: 'Pending' }], ['cancel', { id: 'payout', ref: 'PAY-TEST', partnerId: 'partner', amount: 100, status: 'Pending' }]]) {
  test(`Payout ${mode}: all dialog controls are reachable`, async () => {
    await mount(<PayoutDialog mode={mode} payout={payout} partners={[{ id: 'partner', name: 'Example', email: 'example@example.com' }]} onClose={() => {}} />);
    await walk(keyboardStops(document.querySelector('dialog')), true);
    if (mode === 'create') assert.ok(button('Add payout'));
    if (mode === 'edit') assert.ok(button('Save changes'));
  });
}

test('Add partner confirmation has no icon and all controls can be traversed', async () => {
  await mount(<InviteDialog partners={[]} onClose={() => {}} />);
  const create = button('Create and generate link');
  assert.equal(create.querySelector('svg'), null);
  assert.equal(create.disabled, true);
  await fill(document.getElementById('admin-company'), 'Example Partner');
  assert.equal(create.disabled, true);
  await fill(document.getElementById('admin-name'), 'Example Contact');
  assert.equal(create.disabled, true);
  await fill(document.getElementById('admin-email'), 'invalid');
  assert.equal(create.disabled, true);
  await fill(document.getElementById('admin-email'), 'contact@example.com');
  assert.equal(create.disabled, false);
  await fill(document.getElementById('admin-name'), '   ');
  assert.equal(create.disabled, true);
  await fill(document.getElementById('admin-name'), 'Example Contact');
  assert.equal(create.disabled, false);
  await walk(keyboardStops(document.querySelector('dialog')), true);
});

test('Add admin confirmation has no icon', async () => {
  await mount(<PartnerAdmin />); await click(button('Add admin'));
  assert.equal(button('Create and generate link').querySelector('svg'), null);
});

test('searchable select: arrows and Enter select; Tab exits; clearing returns focus to input', async () => {
  function Example() {
    const [value, setValue] = React.useState('');
    return <><SearchableSelect id="example-select" label="Partner" options={[{ value: 'one', label: 'One' }, { value: 'two', label: 'Two' }]} value={value} onChange={setValue} /><button>Next field</button></>;
  }
  await mount(<Example />);
  const input = document.getElementById('example-select');
  await act(async () => input.focus()); await key('ArrowDown'); await key('Enter');
  assert.equal(input.value, 'Two');
  await key('Tab'); expectFocus(button('Clear Partner'));
  await click(button('Clear Partner')); expectFocus(input);
  await key('Tab'); expectFocus(button('Next field'));
});

test('calendar: opening, arrows, Escape and Tab exit preserve logical focus order', async () => {
  await mount(<><DateRangeFilter id="period" label="Created" onChange={() => {}} /><button>Next filter</button></>);
  const trigger = button('Created date range'); await click(trigger);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  const original = document.activeElement;
  assert.ok(original.hasAttribute('data-date'));
  await key('ArrowRight');
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  assert.notEqual(document.activeElement.getAttribute('data-date'), original.getAttribute('data-date'));
  await key('Escape'); expectFocus(trigger);
  await key('Tab'); expectFocus(button('Next filter'));
});

test('page boundaries allow leaving the page; dialogs alone wrap', async () => {
  await mount(<><button>First</button><button>Last</button></>);
  button('Last').focus(); assert.equal(await key('Tab'), false);
  document.querySelector('a').focus(); assert.equal(await key('Tab', true), false);
});

test('Add client remains disabled until every required value and conditional Other currency is complete', async () => {
  await mount(<PartnerPortal basePath="/demo" onExit={() => {}} />, { path: '/demo/add', route: '/demo/:page?', withMain: false });
  assert.equal(button('Add client').disabled, true);
  for (const [id, value] of [['preview-company', 'Keyboard Test Company'], ['preview-name', 'Test Contact'], ['preview-email', 'contact@example.com'], ['preview-country', 'Canada'], ['preview-volume', 'Under CAD 50,000']]) {
    await fill(document.getElementById(id), value);
    assert.equal(button('Add client').disabled, true);
  }
  const currencies = [...document.querySelectorAll('label')];
  const other = currencies.find(label => label.textContent.trim() === 'Other').querySelector('input');
  await fill(other, true);
  assert.ok(document.getElementById('preview-other'));
  assert.equal(button('Add client').disabled, true);
  await fill(document.getElementById('preview-other'), 'JPY');
  assert.equal(button('Add client').disabled, false);
  await fill(document.getElementById('preview-email'), 'invalid');
  assert.equal(button('Add client').disabled, true);
});

test('DOM fixture delivers native text/select edits to React', async () => {
  function Example() {
    const [value, setValue] = React.useState('');
    const [country, setCountry] = React.useState('');
    return <><input id="probe" value={value} onChange={e => setValue(e.target.value)} /><select id="probe-select" value={country} onChange={e => setCountry(e.target.value)}><option value="">Choose</option><option value="Canada">Canada</option></select><output>{value}:{country}</output></>;
  }
  await mount(<Example />);
  await fill(document.getElementById('probe'), 'updated');
  assert.equal(document.querySelector('output').textContent, 'updated:');
  await fill(document.getElementById('probe-select'), 'Canada');
  assert.equal(document.querySelector('output').textContent, 'updated:Canada');
});


test('mobile menu traps Tab, excludes page controls and restores its trigger on close', async () => {
  window.innerWidth = 375;
  await mount(<><Sidebar active="dashboard" onNavigate={() => {}} /><button>Outside drawer</button></>);
  const trigger = button('Open menu'); await click(trigger);
  const drawer = document.querySelector('dialog');
  assert.ok(drawer);
  await walk(keyboardStops(drawer), true);
  await click(button('Close menu')); expectFocus(trigger);
  assert.equal(document.querySelector('dialog'), null);
});

test('linked bank account form reaches selects and all fields; cancel restores link button', async () => {
  await mount(<HoldingAccounts />);
  await click(button('Linked bank accounts'));
  await click(button('Link a bank account'));
  const form = document.querySelector('form');
  assert.ok(form);
  for (const control of form.querySelectorAll('input, select')) assert.ok(form.querySelector(`label[for="${control.id}"]`));
  await walk(keyboardStops(container));
  await click(button('Cancel')); expectFocus(button('Link a bank account'));
});

test('bank details: complete dialog can be traversed and cancel restores Update trigger', async () => {
  await mount(<BankingDetails />);
  const trigger = button('Update bank details'); await click(trigger);
  const stops = keyboardStops(document.querySelector('dialog'));
  assert.ok(stops.some(control => control.id === 'bk-comments'));
  await walk(stops, true); await click(button('Cancel')); expectFocus(trigger);
});

test('Forwards columns: focus enters panel, reaches its controls, Escape restores trigger', async () => {
  await mount(<Forwards />);
  const trigger = button('Choose columns and filters'); await click(trigger);
  expectFocus(button('Close columns and filters'));
  const panel = document.querySelector('[role="dialog"]');
  await walk(keyboardStops(panel));
  await key('Escape'); expectFocus(trigger);
});

test('new finance request: conditional supplier and payment-term fields join the sequence', async () => {
  await mount(<NewFinanceRequest onClose={() => {}} />);
  await fill(document.getElementById('nr-supplier'), '__new');
  assert.ok(document.querySelector('[aria-label="Supplier company name"]'));
  await fill(document.getElementById('nr-terms'), 'Other');
  assert.ok(document.querySelector('[aria-label="Other payment terms"]'));
  await walk(keyboardStops(document.querySelector('dialog')), true);
});

for (const [name, component] of [['Admin banking approvals', <BankingApprovals />], ['Admin payout list', <AdminPayouts />], ['Admin documents', <Documents />]]) {
  test(`${name}: initial and error-state controls remain reachable`, async () => {
    await mount(component); await walk(keyboardStops(container));
  });
}

test('disabled row actions are skipped; enabled actions remain in order', async () => {
  await mount(<><ActionButton label="Disabled action" disabled>Unavailable</ActionButton><ActionButton label="Enabled action">Available</ActionButton><button>Next action</button></>);
  const stops = keyboardStops(container);
  assert.equal(stops.length, 3);
  assert.ok(!stops.some(control => control.getAttribute('aria-label') === 'Disabled action'));
  await walk(stops);
});

test('a checked radio group contributes one Tab stop and leaves arrow behavior native', async () => {
  await mount(<form><input type="radio" name="delivery" /><input type="radio" name="delivery" defaultChecked /><input type="radio" name="delivery" /><button>After radios</button></form>);
  const radios = [...document.querySelectorAll('input[type="radio"]')];
  const stops = keyboardStops(container);
  assert.equal(stops.filter(control => control.type === 'radio').length, 1);
  radios[1].focus(); assert.equal(await key('ArrowDown'), false);
  await key('Tab'); expectFocus(button('After radios'));
});


test('client Logout navigates to sign-in instead of rendering an empty screen', async () => {
  await mount(<Routes><Route path="/client" element={<ClientApp />} /><Route path="/" element={<h1>Sign in</h1>} /></Routes>, { path: '/client', withMain: false });
  await click(button('Account menu')); await click(button('Logout'));
  assert.equal(document.querySelector('h1').textContent, 'Sign in');
});


test('payout Amount accepts only decimal money, formats cents and preserves numeric editing', async () => {
  await mount(<PayoutDialog mode="create" partners={[]} onClose={() => {}} />);
  const amount = document.getElementById('payout-amount');
  await fill(amount, '1234.5');
  assert.equal(amount.value, '1234.5');
  for (const invalid of ['letters', '-10', '1e3', '12.345', '1000000000']) {
    await fill(amount, invalid);
    assert.equal(Number(amount.value), 1234.5);
  }
  await click(button('Cancel')); // The fixture keeps the dialog open so its formatted value can be inspected.
  assert.equal(amount.value, '1,234.50');
  await fill(amount, '2500');
  await click(button('Cancel'));
  assert.equal(amount.value, '2,500.00');
  await fill(amount, '');
  await click(button('Cancel'));
  assert.equal(amount.value, '');
});


test('blurring payout Amount onto non-focusable content does not refocus the first field or jump scroll', async () => {
  await mount(<PayoutDialog mode="create" partners={[]} onClose={() => {}} />);
  const amount = document.getElementById('payout-amount');
  const dialog = document.querySelector('dialog');
  await fill(amount, '1234.5');
  dialog.scrollTop = 240;
  await act(async () => document.body.focus());
  assert.equal(amount.value, '1,234.50');
  expectFocus(document.body);
  assert.equal(dialog.scrollTop, 240);
});


for (const [name, component, label, direction] of [
  ['Admin payouts', <AdminPayouts />, 'Created at', 'descending'],
  ['Payout history', <PayoutHistory />, 'Created at', 'descending'],
  ['User management', <PartnerAdmin />, 'Partner', 'ascending'],
  ['Banking approvals', <BankingApprovals />, 'Submitted at', 'ascending'],
]) {
  test(`${name}: requested initial sort is shown on its column`, async () => {
    await mount(component);
    const sorted = [...document.querySelectorAll('[aria-sort]')].find(header => header.getAttribute('aria-sort') !== 'none');
    assert.ok(sorted);
    assert.equal(sorted.getAttribute('aria-sort'), direction);
    assert.ok(sorted.textContent.includes(label));
  });
}

test('Referrals: Created at descends by default and date labels use at consistently', async () => {
  await mount(<PartnerPortal basePath="/demo" onExit={() => {}} />, { path: '/demo/referrals', route: '/demo/:page?', withMain: false });
  const sorted = document.querySelector('[aria-sort="descending"]');
  assert.ok(sorted);
  assert.ok(sorted.textContent.includes('Created at'));
  assert.ok([...document.querySelectorAll('th')].some(header => header.textContent.includes('Last modified at')));
  assert.ok(button('Last modified at date range'));
});
