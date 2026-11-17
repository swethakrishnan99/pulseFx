import test from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_IDLE_MS, watchSessionIdle } from './sessionIdle.mjs';

function setup(saved) {
  let time = 1000;
  let expired = 0;
  let tick;
  const target = new EventTarget();
  const values = new Map(saved ? [['session', String(saved)]] : []);
  const stop = watchSessionIdle({ key: 'session', target,
    storage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
    now: () => time, schedule: callback => { tick = callback; return 1; }, cancel: () => {},
    onExpire: () => expired++,
  });
  return { target, values, stop, tick: () => tick(), time: value => { time = value; }, expired: () => expired };
}

test('expires after one hour and fires only once', () => {
  const f = setup();
  f.time(1000 + SESSION_IDLE_MS - 1); f.tick(); assert.equal(f.expired(), 0);
  f.time(1000 + SESSION_IDLE_MS); f.tick(); f.tick(); assert.equal(f.expired(), 1);
  f.stop();
});
test('interaction renews the deadline; returning after expiry cannot renew it', () => {
  const f = setup();
  f.time(2000); f.target.dispatchEvent(new Event('keydown'));
  f.time(1000 + SESSION_IDLE_MS); f.tick(); assert.equal(f.expired(), 0);
  f.time(2000 + SESSION_IDLE_MS); f.target.dispatchEvent(new Event('pointerdown'));
  assert.equal(f.expired(), 1); assert.equal(f.values.get('session'), '2000'); f.stop();
});
test('reload keeps saved activity and other tabs share the deadline', () => {
  const f = setup(500);
  f.time(500 + SESSION_IDLE_MS - 1); f.tick(); assert.equal(f.expired(), 0);
  f.values.set('session', String(SESSION_IDLE_MS)); f.target.dispatchEvent(new Event('storage'));
  f.time(SESSION_IDLE_MS * 2); f.target.dispatchEvent(new Event('focus'));
  assert.equal(f.expired(), 1); f.stop();
});
