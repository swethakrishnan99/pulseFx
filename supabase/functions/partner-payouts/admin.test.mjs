import test from "node:test";
import assert from "node:assert/strict";
import { adminPayouts, payoutSnapshot } from "./admin.mjs";
import { createPayoutsHandler } from "./service.mjs";
const partnerId="recAAAAAAAAAAAAAA", payoutId="recBBBBBBBBBBBBBB", actorId="10000000-0000-4000-8000-000000000001";
const referralId="recEEEEEEEEEEEEEE";
const referral={id:referralId,fields:{Company:"Client",Email:"client@example.test",Partner:[partnerId]}};
const requestId="20000000-0000-4000-8000-000000000001";
const bearer=`header.${Buffer.from(JSON.stringify({session_id:"30000000-0000-4000-8000-000000000001"})).toString("base64url")}.signature`;
const env={AIRTABLE_BASE_ID:"appTest",AIRTABLE_TOKEN:"secret-token"};
const fields={Reference:"PAY-TEST-1",Partner:[partnerId],"Partner ID":partnerId,Client:"Client | client@example.test",Amount:123.45,Currency:"CAD",Status:"Pending",Notes:"Visible note"};
const original=()=>({id:payoutId,fields:{...fields}});
const create={action:"create",requestId,ref:fields.Reference,partnerId,client:fields.Client,clientId:referralId,amount:"123.45",status:"Pending",date:"",notes:fields.Notes};
const snapshot=()=>({ref:fields.Reference,partnerId,client:fields.Client,amount:123.45,currency:"CAD",status:"Pending",date:"",notes:fields.Notes});
const edit={...create,action:"edit",id:payoutId,expected:snapshot(),amount:"200.10"};
function setup(options={}){
 const rows=structuredClone(options.rows||[]),operations=new Map(),writes=[],calls=[],events=[];
 let failedRead=false,failedComplete=false,failedCreate=false;
 const partners=[{id:actorId,company:"Partner Company",name:"Partner Contact",email:"partner@example.test",partner_id:partnerId,ready:true,...options.partner}];
 const admin={rpc:async(name)=>{assert.equal(name,"portal_admin_session_valid");return {data:!options.revoked};}};
 const store={
  partners:async()=>partners,
  claim:async()=>{events.push("claim");return !options.locked;},renew:async()=>!options.expired,release:async()=>events.push("release"),
  operation:async(id)=>operations.get(id)||null,
  prepare:async(id,actor,input)=>{assert.equal(actor,actorId);operations.set(id,{actor_id:actor,input:JSON.parse(JSON.stringify(input)),result:null});},
  complete:async(id,result)=>{if(options.completeFailure&&!failedComplete){failedComplete=true;throw Error("secret-provider-error");}operations.get(id).result=result;},
 };
 const fetchImpl=async(target,init)=>{
  const url=new URL(target);calls.push(url);assert.equal(init.headers.Authorization,`Bearer ${env.AIRTABLE_TOKEN}`);
  if(options.upstreamFailure)return Response.json({error:env.AIRTABLE_TOKEN},{status:500});
  if(url.pathname.includes("/Partners_api/"))return Response.json({id:partnerId,fields:{Referrals:options.linkedReferrals||[referralId]}});
  if(url.pathname.includes("/Referrals_api/"))return Response.json(options.referral||referral);
  if(url.pathname.endsWith("/Referrals_api"))return Response.json({records:options.referrals||[referral]});
  if(url.pathname.endsWith("/Banking_details_api"))return Response.json({records:options.banks||[]});
  if(url.pathname.endsWith("/Partners_api"))return Response.json({records:[{id:partnerId,fields:{Name:"Historical Partner"}}]});
  const id=url.pathname.split("/").at(-1);
  if(init.method==="POST"||init.method==="PATCH"){
   const body=JSON.parse(init.body);writes.push(body);assert.equal(Object.keys(body).join(","),"fields");
   if(init.method==="POST"){
    rows.push({id:payoutId,fields:{...body.fields}});
    if(options.createTimeout&&!failedCreate){failedCreate=true;throw Error("secret-provider-error");}
   }else{const row=rows.find((entry)=>entry.id===id);Object.assign(row.fields,body.fields);}
   return Response.json(options.wrongWriteId?{id:"wrong"}:{id:payoutId,fields:body.fields});
  }
  if(id.startsWith("rec")){
   if(options.confirmationFailure&&writes.length&&!failedRead){failedRead=true;throw Error("secret-provider-error");}
   const found=rows.find((row)=>row.id===id);return found?Response.json(found):Response.json({},{status:404});
  }
  const formula=url.searchParams.get("filterByFormula");
  const records=formula?rows.filter((row)=>row.fields.Reference===formula.match(/='(.*)'$/)?.[1]):rows;
  return Response.json({records});
 };
 const request=(body,method="POST",user={id:actorId,app_metadata:{role:"partner_admin"}},queryPartner)=>adminPayouts({
  request:new Request(`https://api.example/?view=admin${queryPartner ? `&partnerId=${encodeURIComponent(queryPartner)}` : ""}`,{method,headers:{authorization:`Bearer ${bearer}`},...(method==="POST"?{body:typeof body==="string"?body:JSON.stringify(body)}:{})}),
  env,user,admin,store,fetchImpl,json:(body,status=200)=>Response.json(body,{status}),
 });
 return {request,rows,operations,writes,calls,events};
}
test("ordinary partners, user-metadata roles and revoked admins cannot list or write payouts",async()=>{
 for(const method of ["GET","POST"]){
  for(const user of [{id:actorId,user_metadata:{role:"partner_admin"}},{id:actorId,app_metadata:{role:"partner"}}]){
   const f=setup();assert.equal((await f.request(create,method,user)).status,403);assert.equal(f.calls.length,0);
  }
  const f=setup({revoked:true});assert.equal((await f.request(create,method)).status,401);assert.equal(f.calls.length,0);
 }
});
test("payouts handler routes admin payouts before partner membership checks",async()=>{
 const handler=createPayoutsHandler({env:{...env,SUPABASE_URL:"https://project.example",SUPABASE_ANON_KEY:"public"},fetchImpl:async()=>Response.json({id:actorId,user_metadata:{role:"partner_admin"}})});
 const response=await handler(new Request("https://api.example/?view=admin",{headers:{authorization:"Bearer token"}}));assert.equal(response.status,403);
});
test("listing includes full verified bank details only for authorized administrators",async()=>{
 const bank={id:"recCCCCCCCCCCCCCC",fields:{Partner:[partnerId],"Partner ID":partnerId,"Current account":true,Status:"Verified",Currency:"CAD","Account number":"0012345678","Account holder":"Holder","Institution name":"Bank","Institution code":"003","Transit number":"00405"}};
 const f=setup({rows:[original()],banks:[bank]});const response=await f.request(undefined,"GET");assert.equal(response.status,200);const body=await response.json();
 assert.equal(body.payouts[0].partnerName,"Partner Company");assert.equal(body.partners[0].bank.last4,"5678");assert.equal(body.partners[0].bankingStatus,"Verified");assert.equal(body.partners[0].bank.account,"0012345678");assert.equal(body.partners[0].bank.institutionCode,"003");assert.equal(body.partners[0].bank.transitNumber,"00405");
 const duplicate=setup({banks:[bank,bank]});assert.equal((await(await duplicate.request(undefined,"GET")).json()).partners[0].bank,null);
});
test("historical partner names survive a deleted registration",async()=>{
 const f=setup({partner:{deleted_at:"2026-01-01"},rows:[original()]});const body=await(await f.request(undefined,"GET")).json();assert.equal(body.partners.length,0);assert.equal(body.payouts[0].partnerName,"Historical Partner");
});
test("invalid money, status, reference, dates and field injection fail before writes",async()=>{
 for(const patch of [{amount:"0"},{amount:"-1"},{amount:"1.001"},{amount:"NaN"},{amount:"1000000000"},{ref:"x' OR TRUE()"},{partnerId:"bad"},{status:"Cancelled"},{status:"Paid",date:""},{status:"Paid",date:"2026-02-30T12:00:00Z"},{status:"Paid",date:"2026-11-14T12:00"},{status:"Pending",date:"2026-11-14T00:00:00Z"},{currency:"USD"},{Partner:["other"]},{notes:"x".repeat(2001)}]){
  const f=setup();assert.equal((await f.request({...create,...patch})).status,400,JSON.stringify(patch));assert.equal(f.writes.length,0);
 }
 const malformed=setup();assert.equal((await malformed.request("{")).status,400);assert.equal((await malformed.request("x".repeat(10001))).status,413);
});
test("new payouts derive the exact linked Partner and Partner ID and are audited",async()=>{
 const f=setup();const response=await f.request(create);assert.equal(response.status,200);const body=await response.json();assert.equal(body.payout.id,payoutId);assert.equal(body.payout.amount,123.45);
 assert.equal(f.writes.length,1);assert.deepEqual(f.writes[0].fields.Partner,[partnerId]);assert.equal(f.writes[0].fields["Partner ID"],partnerId);assert.equal(f.writes[0].fields.Currency,"CAD");assert.equal(f.operations.get(requestId).result.payout.id,payoutId);
});
test("duplicate references and unprovisioned partners cannot create records",async()=>{
 for(const options of [{rows:[original()]},{partner:{ready:false}},{partner:{deleted_at:"2026-01-01"}}]){
  const f=setup(options);assert.ok([400,409].includes((await f.request(create)).status));assert.equal(f.writes.length,0);
 }
});
test("paid records require a date and save a normalized timestamp",async()=>{
 const f=setup();const res=await f.request({...create,status:"Paid",date:"2026-11-14T12:30:00-05:00"});assert.equal(res.status,200);assert.equal((await res.json()).payout.date,"2026-11-14T17:30:00.000Z");
});
test("replayed and uncertain creations never duplicate records",async()=>{
 for(const options of [{},{createTimeout:true},{confirmationFailure:true},{completeFailure:true}]){
  const f=setup(options);const first=await f.request(create);assert.equal(first.status,Object.keys(options).length?502:200);
  assert.equal((await f.request(create)).status,200);assert.equal(f.rows.length,1);assert.equal(f.writes.length,1);
  // JSONB does not preserve object key order.
  const op=f.operations.get(requestId);op.input=Object.fromEntries(Object.entries(op.input).reverse());assert.equal((await f.request(create)).status,200);
 }
});
test("an idempotency key cannot be reused with different details",async()=>{
 const f=setup();assert.equal((await f.request(create)).status,200);assert.equal((await f.request({...create,amount:"124"})).status,409);assert.equal(f.writes.length,1);
});
test("pending payouts can be edited and stale, reassigned or changed references are rejected",async()=>{
 const f=setup({rows:[original()]});assert.equal((await f.request(edit)).status,200);assert.equal(f.rows[0].fields.Amount,200.1);
 for(const patch of [{expected:{...snapshot(),amount:999}},{ref:"DIFFERENT"},{partnerId:"recDDDDDDDDDDDDDD"}]){
  const other=setup({rows:[original()]});assert.equal((await other.request({...edit,...patch})).status,409);assert.equal(other.writes.length,0);
 }
});
test("paid/cancelled records and inconsistent ownership cannot be edited or cancelled",async()=>{
 for(const change of [{Status:"Paid","Paid at":"2026-11-14T00:00:00Z"},{Status:"Cancelled"},{Partner:["recDDDDDDDDDDDDDD"]},{Currency:"USD"}]){
  for(const action of ["edit","cancel"]){
   const row=original();Object.assign(row.fields,change);const f=setup({rows:[row]});assert.equal((await f.request({...edit,action})).status,409);assert.equal(f.writes.length,0);
  }
 }
});
test("cancellation preserves the financial fields and is safely retried",async()=>{
 for(const options of [{},{completeFailure:true}]){
  const f=setup({...options,rows:[original()]});const body={action:"cancel",requestId,id:payoutId,expected:snapshot()};
  assert.equal((await f.request(body)).status,options.completeFailure?502:200);assert.equal((await f.request(body)).status,200);
  assert.deepEqual(f.writes,[{fields:{Status:"Cancelled"}}]);assert.equal(f.rows[0].fields.Amount,123.45);assert.equal(f.rows[0].fields.Reference,fields.Reference);
 }
});
test("interrupted edits recover only if the exact intended fields are present",async()=>{
 const f=setup({rows:[original()],completeFailure:true});assert.equal((await f.request(edit)).status,502);assert.equal((await f.request(edit)).status,200);assert.equal(f.writes.length,1);
 const other=setup({rows:[original()],completeFailure:true});assert.equal((await other.request(edit)).status,502);other.rows[0].fields.Notes="Changed outside the portal";assert.equal((await other.request(edit)).status,409);assert.equal(other.writes.length,1);
});
test("locks, expired leases and unconfirmed writes never report success",async()=>{
 for(const [options,status] of [[{locked:true},409],[{expired:true},409],[{wrongWriteId:true},502],[{upstreamFailure:true},502]]){
  const f=setup(options);const response=await f.request(create);assert.equal(response.status,status);assert.doesNotMatch(await response.text(),/secret-token|secret-provider-error/);
 }
});
test("snapshot comparisons retain amount, identity, status, dates and visible notes",()=>{
 assert.deepEqual(payoutSnapshot({...snapshot(),id:payoutId,partnerName:"ignored"}),snapshot());
});


test("client options are restricted by reciprocal links and actual partner ownership",async()=>{
 const foreign={id:"recFFFFFFFFFFFFFF",fields:{Company:"Other Client",Email:"other@example.test",Partner:["recDDDDDDDDDDDDDD"]}};
 const f=setup({linkedReferrals:[referralId,foreign.id],referrals:[referral,foreign,{id:"recGGGGGGGGGGGGGG",fields:{Company:"Unlinked",Partner:[partnerId]}}]});
 const response=await f.request(undefined,"GET",undefined,partnerId);assert.equal(response.status,200);
 assert.deepEqual((await response.json()).referrals,[{id:referralId,company:"Client",email:"client@example.test"}]);
 const empty=setup({linkedReferrals:[]});assert.deepEqual((await(await empty.request(undefined,"GET",undefined,partnerId)).json()).referrals,[]);
 assert.equal((await setup().request(undefined,"GET",undefined,"bad")).status,400);
});
test("client selections are verified at save time, including spoofed and stale labels",async()=>{
 for(const options of [{linkedReferrals:[]},{referral:{...referral,fields:{...referral.fields,Partner:["recDDDDDDDDDDDDDD"]}}},{referral:{...referral,fields:{...referral.fields,Email:"changed@example.test"}}}]){
  const f=setup(options);assert.ok([400,409].includes((await f.request(create)).status));assert.equal(f.writes.length,0);
 }
 const f=setup();assert.equal((await f.request({...create,client:"Injected text",clientId:""})).status,400);assert.equal(f.writes.length,0);
 const optional=setup();assert.equal((await optional.request({...create,client:"",clientId:""})).status,200);
});
test("unchanged historical free-text clients can be preserved or cleared on edit",async()=>{
 const row=original();row.fields.Client="Historical client";
 const f=setup({rows:[row]});const expected={...snapshot(),client:"Historical client"};
 assert.equal((await f.request({...edit,clientId:"",client:"Historical client",expected})).status,200);
 const clear=setup({rows:[row]});assert.equal((await clear.request({...edit,clientId:"",client:"",expected})).status,200);assert.equal(clear.rows[0].fields.Client,"");
 const changed=setup({rows:[row]});assert.equal((await changed.request({...edit,clientId:"",client:"Other arbitrary client",expected})).status,400);
});
