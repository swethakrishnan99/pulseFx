import test from 'node:test';
import assert from 'node:assert/strict';
import { createPartnerAdminHandler } from './service.mjs';
const id='10000000-0000-4000-8000-000000000001', userId='20000000-0000-4000-8000-000000000001', actorId='30000000-0000-4000-8000-000000000001';
const original={company:'Original Partner',name:'Contact',email:'contact@example.test'};
const values={company:'Updated Partner',name:'Updated Contact',email:'new@example.test'};
function setup(options={}){
 const events=[];let row={id,...original,user_id:userId,partner_id:'rec12345678901234',ready:true,activated:!options.unactivated,disabled:!!options.disabled,profile_edit_pending:false};
 let user={id:userId,email:original.email,email_confirmed_at:options.unactivated?null:'2026-11-01T00:00:00Z',user_metadata:{full_name:original.name,keep:'retained'},app_metadata:{partner_registration_id:id,...options.targetMetadata}};
 let pending=null, failed=false;
 const auth={getUser:async()=>({data:{user:options.caller||{id:actorId,app_metadata:{role:'partner_admin'}}}}),admin:{
  getUserById:async()=>({data:{user:structuredClone(user)}}),
  listUsers:async()=>({data:{users:[user,...(options.duplicate?[{id:'other',email:values.email}]:[])]}}),
  updateUserById:async(target,attributes)=>{
   events.push(['auth-update',attributes]);assert.equal(target,userId);assert.equal(attributes.password,undefined);assert.equal(attributes.ban_duration,undefined);assert.equal(attributes.app_metadata,undefined);
   if(options.authFailure)return {error:new Error('private upstream error')};
   user={...user,email:attributes.email||user.email,user_metadata:attributes.user_metadata};
   return options.timeoutAfterAuth?{error:new Error('timeout')}:{data:{user:structuredClone(user)}};
  },
 }};
 const store={
  list:async()=>[{...row,previous_email:pending?.before.email}],claim:async(_,token)=>{row.lock_token=token;return {...row};},release:async()=>events.push(['release']),
  prepareEdit:async(_,token,actor,after,expected)=>{
   events.push(['prepare']);assert.equal(actor,actorId);assert.equal(token,row.lock_token);
   if(options.conflict)throw new Error('DB conflict');
   if(!pending){assert.deepEqual(expected,original);pending={before:{...original},after:{...after}};}
   else assert.deepEqual(pending.after,after);
   row={...row,...after,profile_edit_pending:true};return pending;
  },
  finishEdit:async()=>{
   events.push(['finish']);if(options.finishOnce&&!failed){failed=true;throw new Error('temporary failure');}
   row.profile_edit_pending=false;pending=null;
  },
  cancelEdit:async()=>{events.push(['cancel']);row={...row,...pending.before,profile_edit_pending:false};pending=null;},
 };
 const handler=createPartnerAdminHandler({env:{},auth,store});
 const request=(body={})=>handler(new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer session'},body:JSON.stringify({action:'edit',id,...values,expected:{...original},confirmEmailChange:true,...body})}));
 return {request,events,get row(){return row;},get user(){return user;}};
}
test('editing preserves IDs and ownership while updating Auth metadata, normalized email and registry',async()=>{
 const fixture=setup();const response=await fixture.request({email:' NEW@example.test '});assert.equal(response.status,200);const result=await response.json();
 assert.equal(result.partner.email,values.email);assert.equal(result.partner.company,values.company);assert.equal(result.emailChanged,true);assert.equal(fixture.row.user_id,userId);assert.equal(fixture.row.partner_id,'rec12345678901234');assert.equal(fixture.row.id,id);assert.equal(fixture.user.user_metadata.keep,'retained');assert.equal(fixture.user.user_metadata.full_name,values.name);assert.equal(fixture.events[0][0],'prepare');assert.equal(fixture.events[1][0],'auth-update');
});
test('name-only editing does not send an email change or confirm flag to Auth',async()=>{
 const fixture=setup();assert.equal((await fixture.request({email:original.email})).status,200);const attributes=fixture.events.find(([event])=>event==='auth-update')[1];assert.equal(attributes.email,undefined);assert.equal(attributes.email_confirm,undefined);
});
test('email changes require explicit same-contact confirmation',async()=>{
 const fixture=setup();assert.equal((await fixture.request({confirmEmailChange:false})).status,400);assert.equal(fixture.events.some(([event])=>event==='prepare'),false);
});
test('duplicate Auth emails and invalid fields are rejected before editing',async()=>{
 assert.equal((await setup({duplicate:true}).request()).status,409);
 for(const overrides of [{company:''},{name:''},{email:'bad'},{partner_id:'other'},{expected:{email:original.email}},{password:'newpassword'}]){
  const fixture=setup();assert.equal((await fixture.request(overrides)).status,400);assert.equal(fixture.events.some(([event])=>event==='prepare'),false);
 }
});
test('normal users, administrator targets and self edits cannot change partners',async()=>{
 assert.equal((await setup({caller:{id:actorId,user_metadata:{role:'partner_admin'}}}).request()).status,403);
 assert.equal((await setup({targetMetadata:{role:'partner_admin'}}).request()).status,403);
 assert.equal((await setup({caller:{id:userId,app_metadata:{role:'partner_admin'}}}).request()).status,403);
});
test('known Auth failure restores the original profile without pretending the edit succeeded',async()=>{
 const fixture=setup({authFailure:true});assert.equal((await fixture.request()).status,502);assert.equal(fixture.row.email,original.email);assert.equal(fixture.row.profile_edit_pending,false);assert.ok(fixture.events.some(([event])=>event==='cancel'));
});
test('a timed-out successful Auth update is reconciled before completing',async()=>{
 const fixture=setup({timeoutAfterAuth:true});assert.equal((await fixture.request()).status,200);assert.equal(fixture.row.profile_edit_pending,false);
});
test('failed finalization stays pending and can resume without creating another Auth user',async()=>{
 const fixture=setup({finishOnce:true});assert.equal((await fixture.request()).status,502);assert.equal(fixture.row.profile_edit_pending,true);
 assert.equal((await fixture.request({expected:{...values}})).status,200);assert.equal(fixture.row.profile_edit_pending,false);assert.equal(fixture.user.id,userId);
});
test('deactivated and unactivated accounts retain their access/activation state',async()=>{
 const disabled=setup({disabled:true});const result=await(await disabled.request()).json();assert.equal(result.partner.status,'Deactivated');
 const pending=setup({unactivated:true});const body=await(await pending.request()).json();assert.equal(body.newInvitationRequired,true);assert.equal(pending.events.find(([event])=>event==='auth-update')[1].email_confirm,false);
});
