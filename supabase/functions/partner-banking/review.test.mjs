import test from "node:test";
import assert from "node:assert/strict";
import { bankingReview } from "./review.mjs";
import { createBankingHandler } from "./service.mjs";

const partnerId = 'recAAAAAAAAAAAAAA', oldId = 'rec00000000000001', newId = 'rec00000000000002';
const env = { AIRTABLE_BASE_ID: 'appTest', AIRTABLE_TOKEN: 'secret-test-token', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'public-key' };
const row = (id, overrides={}) => ({ id, fields: { 'Submission ID':id,'Partner ID':partnerId,Partner:[partnerId],'Institution name':'Test Bank','Account holder':'Partner','Institution code':'001','Transit number':'01234','Account number':'0012345678',Currency:'CAD',Status:'Pending verification','Current account':false,'Last modified':'2026-11-14T10:00:00.000Z','Submitted at':'2026-11-14T09:00:00.000Z', ...overrides } });
const request = (action='approve', overrides={}) => new Request('https://example.test/?view=review',{method:'POST',body:JSON.stringify({ id:newId,action,reviewNotes:action==='reject'?'Wrong bank details':'Checked with partner',expectedModifiedAt:'2026-11-14T10:00:00.000Z',...overrides })});
function setup(options={}) {
  const rows = structuredClone(options.rows || [row(oldId,{Status:'Verified','Current account':true}),row(newId)]);
  const writes=[], calls=[], rpcs=[];
  let claimed=false;
  const admin = { rpc: async (name,args) => {
    rpcs.push({name,args});
    if(options.rpcFailure===name) return {error:new Error('private error')};
    if(name==='claim_banking_review') {if(options.locked)return {data:false};claimed=true;}
    if(name==='renew_banking_review' && options.expired)return {data:false};
    if(name==='complete_banking_review') {assert.equal(claimed,true);assert.equal(args.p_actor,'10000000-0000-4000-8000-000000000001');}
    return {data:true};
  }};
  const fetchImpl=async(target,init)=>{
    const url=new URL(target);calls.push({url,init});
    assert.equal(init.headers.Authorization,`Bearer ${env.AIRTABLE_TOKEN}`);
    if(url.pathname.endsWith('/Partners_api')) return Response.json({records:[{id:partnerId,fields:{Name:'Partner Company',Contact:'Contact',Email:'partner@example.test'}}]});
    if(init.method==='PATCH') {
      const records=JSON.parse(init.body).records;writes.push(records);
      if(options.failApproval && records.some(r=>r.fields.Status==='Verified'))return Response.json({secret:env.AIRTABLE_TOKEN},{status:500});
      if(options.unconfirmed)return Response.json({records:[]});
      for(const change of records){const saved=rows.find(r=>r.id===change.id);Object.assign(saved.fields,change.fields);}
      return Response.json({records:records.map(r=>rows.find(saved=>saved.id===r.id))});
    }
    const id=url.pathname.split('/').at(-1);
    if(id.startsWith('rec')) {
      const found=rows.find(r=>r.id===id);return found?Response.json(found):Response.json({}, {status:404});
    }
    return Response.json({records:rows});
  };
  const run=(req=request(),user={id:'10000000-0000-4000-8000-000000000001',app_metadata:{role:'partner_admin'}})=>bankingReview({request:req,env,user,admin,fetchImpl,json:(body,status=200)=>Response.json(body,{status})});
  return {run,rows,writes,calls,rpcs};
}
test('only server-managed admin metadata permits review reads or writes',async()=>{
  for(const req of [new Request('https://example.test/?view=review'),request()]){
    const {run,calls,rpcs}=setup();assert.equal((await run(req,{id:'x',email:'partnerships@pulsefx.com',user_metadata:{role:'partner_admin'}})).status,403);assert.equal(calls.length,0);assert.equal(rpcs.length,0);
  }
});
test('the banking handler verifies Auth before allowing review and never trusts user metadata',async()=>{
  let calls=0;const handler=createBankingHandler({env,fetchImpl:async()=>{calls++;return Response.json({id:'user',user_metadata:{role:'partner_admin'}});}});
  const response=await handler(new Request('https://example.test/?view=review',{headers:{Authorization:'Bearer token'}}));assert.equal(response.status,403);assert.equal(calls,1);
});
test('admin list includes partner names, full numbers, ownership status and submission history',async()=>{
  const {run}=setup();const body=await(await run(new Request('https://example.test/?view=review'))).json();assert.equal(body.submissions.length,2);assert.equal(body.submissions[0].partnerName,'Partner Company');assert.equal(body.submissions[0].account,'0012345678');assert.equal(body.submissions[0].validOwnership,true);
});
test('approval clears the previous current flag, verifies the new one, retains history and audits the actor',async()=>{
  const {run,rows,writes,rpcs}=setup();const response=await run();assert.equal(response.status,200);assert.deepEqual(await response.json(),{reviewed:true});
  assert.equal(rows.length,2);assert.equal(rows[0].fields.Status,'Verified');assert.equal(rows[0].fields['Current account'],false);assert.equal(rows[1].fields.Status,'Verified');assert.equal(rows[1].fields['Current account'],true);assert.equal(rows[1].fields['Review notes'],'Checked with partner');
  assert.equal(writes[0][0].id,oldId);assert.equal(writes[1][0].id,newId);assert.ok(rpcs.some(r=>r.name==='complete_banking_review'));assert.equal(writes.flat().some(r=>'Account number' in r.fields),false);
});
test('rejection records a reason without changing the previous account',async()=>{
  const {run,rows,writes}=setup();assert.equal((await run(request('reject'))).status,200);assert.equal(rows[0].fields['Current account'],true);assert.equal(rows[1].fields.Status,'Rejected');assert.equal(rows[1].fields['Review notes'],'Wrong bank details');assert.equal(writes.length,1);
});
test('rejection requires notes; arbitrary IDs, flags and fields cannot be assigned',async()=>{
  for(const overrides of [{action:'delete'},{id:'invalid'},{reviewNotes:'x'.repeat(2001)},{current:true},{partnerId:'recBBBBBBBBBBBBBB'},{reviewNotes:''}]){
    const {run,writes}=setup();assert.equal((await run(request('reject',overrides))).status,400);assert.equal(writes.length,0);
  }
});
test('a stale review never changes approval or current flags',async()=>{
  const {run,writes}=setup();assert.equal((await run(request('approve',{expectedModifiedAt:'old'}))).status,409);assert.equal(writes.length,0);
});
test('concurrent reviews and expired locks cannot write',async()=>{
  for(const options of [{locked:true},{expired:true}]){const {run,writes}=setup(options);assert.equal((await run()).status,409);assert.equal(writes.length,0);}
});
test('inconsistent partner links and invalid bank details cannot be approved',async()=>{
  for(const fields of [{Partner:['recBBBBBBBBBBBBBB']},{'Institution code':'1'},{'Account number':''},{Currency:'USD'}]){
    const {run,writes}=setup({rows:[row(newId,fields)]});assert.equal((await run()).status,409);assert.equal(writes.length,0);
  }
});
test('already approved retries do not rewrite the reviewed fields',async()=>{
  const {run,writes}=setup({rows:[row(newId,{Status:'Verified','Current account':true,'Review notes':'Checked with partner'})]});assert.equal((await run()).status,200);assert.equal(writes.length,0);
});
test('historical verified or rejected submissions cannot be approved as a new request',async()=>{
  for(const status of ['Verified','Rejected']){const {run,writes}=setup({rows:[row(newId,{Status:status})]});assert.equal((await run()).status,409);assert.equal(writes.length,0);}
});
test('missing submissions return 404 and unconfirmed writes never report success',async()=>{
  assert.equal((await setup({rows:[]}).run()).status,404);const {run}=setup({unconfirmed:true});assert.equal((await run()).status,502);
});
test('a failed final approval remains pending and can be retried; errors never expose numbers or secrets',async()=>{
  const {run,rows,rpcs}=setup({failApproval:true});const response=await run();assert.equal(response.status,502);const text=await response.text();assert.equal(text.includes(env.AIRTABLE_TOKEN),false);assert.equal(text.includes('0012345678'),false);assert.equal(rows[1].fields.Status,'Pending verification');assert.ok(rpcs.some(r=>r.name==='release_banking_review'));
});
test('the current account cannot be rejected',async()=>{
  const {run,writes}=setup({rows:[row(newId,{Status:'Verified','Current account':true})]});assert.equal((await run(request('reject'))).status,409);assert.equal(writes.length,0);
});

test('an audit failure is unconfirmed and a retry completes the audit without rewriting the approved account',async()=>{
  const options={rpcFailure:'complete_banking_review'};const {run,rows,writes}=setup(options);
  assert.equal((await run()).status,502);assert.equal(rows[1].fields.Status,'Verified');assert.equal(rows[1].fields['Current account'],true);
  const previousWrites=writes.length;options.rpcFailure=undefined;
  assert.equal((await run()).status,200);assert.equal(writes.length,previousWrites);
});
