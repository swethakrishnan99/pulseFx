import test from 'node:test';
import assert from 'node:assert/strict';
import {latestBankingDecision, latestPendingBanking} from './pendingBanking.mjs';
const account=(id,status,submittedAt)=>({id,status,submittedAt});
test('finds the newest pending update after the latest verified submission regardless of array order',()=>{
 const verified=account('verified','Verified','2026-11-14T12:00:00Z');
 const pending=account('new','Pending verification','2026-11-14T15:00:00Z');
 const rows=[account('old','Pending verification','2026-11-13T12:00:00Z'),pending,verified,account('mid','Pending verification','2026-11-14T14:00:00Z')];
 assert.equal(latestPendingBanking(rows,verified),pending);
});
test('old, equal-date, rejected and invalid-date updates never trigger the banner',()=>{
 const verified=account('verified','Verified','2026-11-14T12:00:00Z');
 assert.equal(latestPendingBanking([verified,account('old','Pending verification','2026-11-13T12:00:00Z'),account('equal','Pending verification','2026-11-14T07:00:00-05:00'),account('rejected','Rejected','2026-11-15T12:00:00Z'),account('invalid','Pending verification','bad')],verified),null);
});
test('uses the latest verified date and stops showing an update after approval',()=>{
 const old=account('old','Verified','2026-11-12T12:00:00Z');
 const pending=account('pending','Pending verification','2026-11-13T12:00:00Z');
 const current=account('current','Verified','2026-11-14T12:00:00Z');
 assert.equal(latestPendingBanking([old,pending,current],old),null);
 assert.equal(latestPendingBanking([old,{...pending,status:'Verified'}]),null);
});
test('shows pending submissions before any verified account exists',()=>{
 const pending=account('pending','Pending verification','2026-11-14T12:00:00Z');
 assert.equal(latestPendingBanking([pending]),pending);assert.equal(latestPendingBanking([]),null);
});

test('shows the latest approval or rejection and suppresses it after a newer submission',()=>{
 const approved={...account('approved','Verified','2026-11-12T12:00:00Z'),approvedAt:'2026-11-14T14:00:00Z'};
 const rejected={...account('rejected','Rejected','2026-11-13T12:00:00Z'),rejectedAt:'2026-11-14T15:00:00Z'};
 assert.equal(latestBankingDecision([rejected,approved]),rejected);
 assert.equal(latestBankingDecision([approved]),approved);
 assert.equal(latestBankingDecision([rejected,approved,account('new','Pending verification','2026-11-14T16:00:00Z')]),null);
 assert.equal(latestBankingDecision([rejected,account('tie','Pending verification','2026-11-14T15:00:00Z')]),null);
});
test('historical decisions use submission dates when audit dates are unavailable, ignoring last modified',()=>{
 const old={...account('old','Verified','2026-11-12T12:00:00Z'),modifiedAt:'2026-11-15T12:00:00Z'};
 const rejected=account('new','Rejected','2026-11-14T12:00:00Z');
 assert.equal(latestBankingDecision([old,rejected]),rejected);assert.equal(latestBankingDecision([]),null);
});
