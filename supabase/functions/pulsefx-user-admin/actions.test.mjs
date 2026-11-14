import test from "node:test";
import assert from "node:assert/strict";
import { createPulsefxUserAdminHandler } from "./service.mjs";
import { adminSessionValid } from "../_shared/admin-session.mjs";
const targetId="10000000-0000-4000-8000-000000000001",actorId="20000000-0000-4000-8000-000000000001";
const ok=(data)=>({data,error:null});
function setup(options={}) {
  const events=[];
  let row={id:targetId,name:"Administrator",email:"admin@example.test",activated:true,disabled:false,...options.row};
  let user={id:targetId,email:row.email,user_metadata:{full_name:row.name,keep:"value"},app_metadata:{role:"partner_admin",keep:"trusted"},email_confirmed_at:row.activated?"2026-11-01":null,...options.user};
  const auth={ getUser:async()=>ok({user:options.caller||{id:actorId,app_metadata:{role:"partner_admin"}}}),admin:{
    getUserById:async()=>ok({user}),
    updateUserById:async(id,attributes)=>{
      events.push(["update",attributes]);assert.equal(id,targetId);assert.equal(attributes.app_metadata,undefined);assert.equal(attributes.password,undefined);
      if(options.updateFailure)return {error:{message:"secret-provider-error"}};
      user={...user,...attributes,user_metadata:attributes.user_metadata||user.user_metadata};
      if(attributes.ban_duration)row.disabled=attributes.ban_duration!=="none";
      if(attributes.email)row.email=attributes.email;
      if(attributes.user_metadata)row.name=attributes.user_metadata.full_name;
      return ok({user});
    },
    deleteUser:async()=>{events.push(["delete"]);return options.deleteFailure?{error:{message:"secret-provider-error"}}:ok({user});},
    generateLink:async(input)=>{events.push(["link",input]);return options.linkFailure?{error:{}}:ok({user:options.generatedUser||user,properties:options.missingToken?{}:{hashed_token:"private-token"}});},
  }};
  const store={
    verifyAdminSession:async()=>!options.revoked,
    claimAdminAction:async()=>{events.push(["claim"]);return !options.locked;},
    releaseAdminAction:async()=>events.push(["release"]),
    invalidateAdminCredentials:async()=>{events.push(["invalidate"]);if(options.invalidateFailure)throw Error("private");},
    listAdmins:async()=>[row,...(options.lastActive?[]:[{id:actorId,activated:true}])],
    partnerEmailExists:async(email)=>(options.partners||[]).some((row)=>row.email===email),
  };
  const handler=createPulsefxUserAdminHandler({auth,store,env:{PORTAL_URL:"https://portal.example/"}});
  const request=(action,body={})=>handler(new Request("https://api.example/pulsefx-user-admin",{method:"POST",headers:{authorization:"Bearer token"},body:JSON.stringify({action,id:targetId,...body})}));
  return {request,events,user:()=>user};
}
const edit={name:"Updated Admin",email:"updated@example.test",expected:{name:"Administrator",email:"admin@example.test"},confirmEmailChange:true};

test("ordinary, revoked and user-metadata-only callers cannot manage administrators",async()=>{
 for(const options of [{revoked:true},{caller:{id:actorId,user_metadata:{role:"partner_admin"}}}]){
  for(const action of ["edit","invite","recovery","enable","disable","delete"]){
   const f=setup(options);assert.ok([401,403].includes((await f.request(action,edit)).status));assert.deepEqual(f.events,[]);
  }
 }
});
test("self deactivation/deletion and last-active removal are rejected before Auth writes",async()=>{
 for(const action of ["disable","delete"]){
  for(const options of [{caller:{id:targetId,app_metadata:{role:"partner_admin"}}},{lastActive:true}]){
   const f=setup(options);assert.ok([403,409].includes((await f.request(action)).status));assert.equal(f.events.some(([name])=>name==="update"||name==="delete"),false);
  }
 }
});
test("locked operations, invalid targets, partners and role mismatches cannot be changed",async()=>{
 for(const options of [{locked:true},{user:{app_metadata:{}}},{user:{app_metadata:{role:"partner_admin",partner_registration_id:"partner"}}}]){
  const f=setup(options);assert.equal((await f.request("disable")).status,409);assert.equal(f.events.some(([name])=>name==="update"),false);
 }
 const f=setup();assert.equal((await f.request("disable",{id:"bad"})).status,400);assert.deepEqual(f.events,[]);
});
test("deactivation bans, revokes credentials and releases the action lease",async()=>{
 const f=setup();const res=await f.request("disable");assert.equal(res.status,200);assert.equal((await res.json()).administrator.status,"Deactivated");
 assert.deepEqual(f.events.map(([name])=>name),["claim","update","invalidate","release"]);
 assert.equal(f.events[1][1].ban_duration,"876000h");
});
test("reactivation preserves administrator role and pending activation status",async()=>{
 const f=setup({row:{activated:false,disabled:true}});const res=await f.request("enable");assert.equal(res.status,200);assert.equal((await res.json()).administrator.status,"Awaiting activation");assert.equal(f.events[1][1].ban_duration,"none");
});
test("deletion blocks access first and failed deletion remains safely deactivated",async()=>{
 for(const failed of [false,true]){
  const f=setup({deleteFailure:failed});const res=await f.request("delete");assert.equal(res.status,failed?502:200);assert.deepEqual(f.events.map(([name])=>name),["claim","update","invalidate","delete","release"]);
  if(failed)assert.doesNotMatch(await res.text(),/secret-provider-error/);
 }
});
test("editing names preserves role and unrelated metadata without revoking sessions",async()=>{
 const f=setup();const res=await f.request("edit",{...edit,email:"admin@example.test"});assert.equal(res.status,200);assert.equal((await res.json()).administrator.name,edit.name);assert.equal(f.user().user_metadata.keep,"value");assert.equal(f.user().app_metadata.keep,"trusted");assert.equal(f.events.some(([name])=>name==="invalidate"),false);
});
test("email edits require confirmation, reject stale/partner emails and revoke access links and sessions",async()=>{
 for(const [body,options] of [[{...edit,confirmEmailChange:false},{}],[{...edit,expected:{name:"stale",email:"admin@example.test"}},{}],[edit,{partners:[{email:edit.email}]}]]){
  const f=setup(options);assert.ok([400,409].includes((await f.request("edit",body)).status));assert.equal(f.events.some(([name])=>name==="update"),false);
 }
 const f=setup();const res=await f.request("edit",edit);assert.equal(res.status,200);const body=await res.json();assert.equal(body.emailChanged,true);assert.equal(body.administrator.id,targetId);assert.equal(body.administrator.email,edit.email);assert.deepEqual(f.events.map(([name])=>name),["claim","invalidate","update","invalidate","release"]);
});
test("self name editing is allowed while self login email changes require another admin",async()=>{
 const options={caller:{id:targetId,app_metadata:{role:"partner_admin"}}};
 assert.equal((await setup(options).request("edit",{...edit,email:"admin@example.test"})).status,200);
 assert.equal((await setup(options).request("edit",edit)).status,403);
});
test("invite and recovery validate account state and generated identity",async()=>{
 for(const [action,options,expected] of [["invite",{row:{activated:false}},200],["invite",{},409],["recovery",{},200],["recovery",{row:{activated:false}},409],["recovery",{row:{disabled:true}},409],["recovery",{generatedUser:{id:"wrong"}},502],["recovery",{missingToken:true},502]]){
  const f=setup(options);const res=await f.request(action);assert.equal(res.status,expected);if(expected===200){const body=await res.json();assert.ok(body.link.includes("private-token"));assert.equal(body.administrator.role,"partner_admin");}
 }
});
test("confirmed but unfinished invitations resume via recovery",async()=>{
 const f=setup({row:{activated:false},user:{email_confirmed_at:"2026-11-01"}});const res=await f.request("invite");assert.equal(res.status,200);assert.equal((await res.json()).kind,"recovery");
});
test("failed writes and credential revocation never return success or credentials",async()=>{
 for(const options of [{updateFailure:true},{invalidateFailure:true}]){
  const f=setup(options);const res=await f.request("disable");assert.ok(res.status>=400);assert.equal((await res.json()).administrator,undefined);assert.equal(f.events.at(-1)[0],"release");
 }
});
test("session verification requires a verified JWT session ID and the live session RPC",async()=>{
 const sid="30000000-0000-4000-8000-000000000001";
 const token=`header.${Buffer.from(JSON.stringify({session_id:sid})).toString("base64url")}.signature`;
 let calls=0;const admin={rpc:async(name,args)=>{calls++;assert.equal(name,"portal_admin_session_valid");assert.deepEqual(args,{p_user_id:actorId,p_session_id:sid});return ok(true);}};
 assert.equal(await adminSessionValid(admin,actorId,"bad-token"),false);assert.equal(calls,0);
 assert.equal(await adminSessionValid(admin,actorId,token),true);assert.equal(calls,1);
 assert.equal(await adminSessionValid({rpc:async()=>ok(false)},actorId,token),false);
 await assert.rejects(adminSessionValid({rpc:async()=>({error:{}})},actorId,token));
});
