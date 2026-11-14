-- All Auth fixtures, audit rows and queued Airtable calls are rolled back.
begin;
do $test$
declare
  registration uuid:=gen_random_uuid(); uid uuid:=gen_random_uuid(); actor uuid:=gen_random_uuid(); lease uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid(); next_sid uuid:=gen_random_uuid();
  old_email text:=uid::text||'@edit-test.example.invalid'; new_email text:=uid::text||'@changed.example.invalid';
  company text:='Edit fixture '||registration; renamed text:='Renamed fixture '||registration;
  expected jsonb; op jsonb; failed boolean:=false;
begin
  if has_function_privilege('authenticated','public.prepare_partner_profile_edit(uuid,uuid,uuid,text,text,text,jsonb,boolean)','EXECUTE') then raise exception 'Partner can edit profiles directly'; end if;
  insert into auth.users(id,email,aud,role,encrypted_password,email_confirmed_at,raw_user_meta_data,raw_app_meta_data,recovery_token,confirmation_token)
    values(uid,old_email,'authenticated','authenticated','fixture-password-not-used',now(),'{"full_name":"Before"}',jsonb_build_object('partner_registration_id',registration),'recovery-fixture','confirmation-fixture');
  insert into public.partner_registrations(id,company,name,email,user_id,partner_id,ready,lock_token,locked_until)
    values(registration,company,'Before',old_email,uid,'rec12345678901234',true,lease,now()+interval '5 minutes');
  insert into public.partner_memberships(user_id,partner_id,enabled) values(uid,'rec12345678901234',true);
  insert into auth.sessions(id,user_id) values(sid,uid);
  perform set_config('request.jwt.claim.sub',uid::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'email',old_email,'session_id',sid)::text,true);
  if not public.partner_portal_session_valid() then raise exception 'Initial session invalid'; end if;
  expected:=jsonb_build_object('company',company,'name','Before','email',old_email);
  op:=public.prepare_partner_profile_edit(registration,lease,actor,renamed,'After',old_email,expected,false);
  if public.partner_portal_session_valid() then raise exception 'Pending edit permitted portal access'; end if;
  update auth.users set raw_user_meta_data='{"full_name":"After"}' where id=uid;
  if not public.finish_partner_profile_edit(registration,lease,actor) then raise exception 'Names finalization failed'; end if;
  if not public.partner_portal_session_valid() then raise exception 'Names edit revoked a valid session'; end if;
  if (public.get_partner_display_profile()->>'name')<>renamed then raise exception 'Display name did not update'; end if;
  expected:=jsonb_build_object('company',renamed,'name','After','email',old_email);
  begin
    perform public.prepare_partner_profile_edit(registration,lease,actor,renamed,'After',new_email,expected,false);
  exception when others then failed:=true;
  end;
  if not failed then raise exception 'Email changed without confirmation'; end if;
  op:=public.prepare_partner_profile_edit(registration,lease,actor,renamed,'After',new_email,expected,true);
  if exists(select 1 from auth.sessions where user_id=uid) then raise exception 'Old sessions retained'; end if;
  if exists(select 1 from auth.users where id=uid and (recovery_token<>'' or confirmation_token<>'')) then raise exception 'Old links retained'; end if;
  if exists(select 1 from public.partner_memberships where user_id=uid and enabled) then raise exception 'Data access still enabled'; end if;
  -- An interrupted request is resumable and does not create a second audit operation.
  perform public.prepare_partner_profile_edit(registration,lease,actor,renamed,'After',new_email,expected,true);
  if (select count(*) from public.partner_profile_edits where registration_id=registration and state='pending')<>1 then raise exception 'Duplicate edit operation'; end if;
  update auth.users set email=new_email where id=uid;
  insert into auth.sessions(id,user_id) values(next_sid,uid);
  if not public.finish_partner_profile_edit(registration,lease,actor) then raise exception 'Email finalization failed'; end if;
  if exists(select 1 from auth.sessions where user_id=uid) then raise exception 'In-flight session retained'; end if;
  if public.partner_portal_session_valid() then raise exception 'Old JWT authorized after email change'; end if;
  insert into auth.sessions(id,user_id) values(next_sid,uid);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'email',new_email,'session_id',next_sid)::text,true);
  if not public.partner_portal_session_valid() then raise exception 'New login rejected'; end if;
  if not exists(select 1 from public.partner_registrations where id=registration and user_id=uid and partner_id='rec12345678901234' and email=new_email and not profile_edit_pending) then raise exception 'IDs changed or profile incomplete'; end if;
  if (select count(*) from public.partner_profile_edits where registration_id=registration and state='complete')<>2 then raise exception 'Audit missing'; end if;
  if not exists(select 1 from public.partner_airtable_sync where registration_id=registration and revision>synced_revision) then raise exception 'Airtable synchronization missing'; end if;
end;
$test$;
rollback;
