-- Extra addresses copied (CC) on a member's invoice emails (edited in the member sheet).
alter table public.cw_members add column if not exists cc_emails text[] not null default '{}';
comment on column public.cw_members.cc_emails is 'Extra addresses copied (CC) on this member''s invoice emails';
