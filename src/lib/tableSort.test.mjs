import test from 'node:test';
import assert from 'node:assert/strict';
import { sortTableRows } from './tableSort.mjs';

test('amounts sort numerically without mutating rows, preserving equal values', () => {
  const rows = [{id:1,amount:100},{id:2,amount:9.5},{id:3,amount:-2},{id:4,amount:9.5}];
  assert.deepEqual(sortTableRows(rows,{key:'amount',dir:'asc'}).map(r=>r.id),[3,2,4,1]);
  assert.deepEqual(sortTableRows(rows,{key:'amount',dir:'desc'}).map(r=>r.id),[1,2,4,3]);
  assert.deepEqual(rows.map(r=>r.id),[1,2,3,4]);
});
test('dates compare timestamps across offsets and keep missing dates last in both directions', () => {
 const rows=[{id:1,date:'2026-11-14T10:00:00-05:00'},{id:2,date:'2026-11-14T14:00:00Z'},{id:3,date:null},{id:4,date:'invalid'}];
 const columns={date:{type:'date'}};
 assert.deepEqual(sortTableRows(rows,{key:'date',dir:'asc'},columns).map(r=>r.id),[2,1,3,4]);
 assert.deepEqual(sortTableRows(rows,{key:'date',dir:'desc'},columns).map(r=>r.id),[1,2,3,4]);
});
test('text sorts naturally and ignores case', () => {
 const rows=[{ref:'PAY-10'},{ref:'pay-2'},{ref:'PAY-1'}];
 assert.deepEqual(sortTableRows(rows,{key:'ref',dir:'asc'}).map(r=>r.ref),['PAY-1','pay-2','PAY-10']);
});
test('computed accessors support nested numbers, booleans and default order', () => {
 const rows=[{nested:{amount:20},active:true},{nested:{amount:3},active:false}];
 assert.deepEqual(sortTableRows(rows,null),rows);
 assert.equal(sortTableRows(rows,{key:'amount',dir:'asc'},{amount:r=>r.nested.amount})[0],rows[1]);
 assert.equal(sortTableRows(rows,{key:'active',dir:'asc'})[0],rows[1]);
});
