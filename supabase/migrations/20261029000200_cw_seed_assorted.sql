-- Seed the Assorted Coworking tenant and attach the owner accounts.
insert into public.cw_tenants (slug, name, address, phone, email, bank_details, whatsapp_phone_number_id, from_email, owner_email, billing_day, deposit_per_seat, capacity, pricing, allowed_origins)
values (
  'assorted-coworking',
  'Assorted Coworking',
  'FF 27, Zarpar Arcade, D-12 Markaz, Islamabad',
  '+923218526405',
  'hello@assorted.business',
  '{"bank":"Bank Alfalah","account_title":"Assorted Business Services","account_no":"05581009191757"}'::jsonb,
  '771331542722817',
  'hello@assorted.business',
  'ahsanilyas35@gmail.com',
  28, 10000, 30,
  '[
    {"code":"day_shift","name":"Day Shift","detail":"9AM to 5PM","price":15000,"period":"month","unit":"seat","deposit":true},
    {"code":"afternoon_shift","name":"Afternoon Shift","detail":"2PM to 10PM","price":13500,"period":"month","unit":"seat","deposit":true},
    {"code":"night_shift","name":"Night Shift","detail":"5PM to 3AM","price":12000,"period":"month","unit":"seat","deposit":true},
    {"code":"all_access","name":"24 Hour Access","detail":"Any time, all month","price":18000,"period":"month","unit":"seat","deposit":true},
    {"code":"dedicated_desk","name":"Dedicated Desk","detail":"Reserved seat, 24/7","price":22000,"period":"month","unit":"seat","deposit":true},
    {"code":"private_room","name":"Private Room","detail":"Lockable team office, 24/7","price":65000,"period":"month","unit":"room","deposit":true},
    {"code":"flex_10","name":"10 Day Flex Pass","detail":"Any 10 days in a month","price":10000,"period":"month","unit":"pass","deposit":false},
    {"code":"day_pass","name":"Day Pass","detail":"Full access for one day","price":1500,"period":"day","unit":"pass","deposit":false},
    {"code":"meeting_room_addon","name":"Meeting Room Access","price":5000,"period":"month","addon":true}
  ]'::jsonb,
  array['https://coworking.assorted.group','https://assortedcoworking.com','https://www.assortedcoworking.com']
)
on conflict (slug) do update set
  pricing = excluded.pricing,
  bank_details = excluded.bank_details,
  allowed_origins = excluded.allowed_origins;

insert into public.cw_tenant_users (tenant_id, user_id, role)
select t.id, u.id, 'owner'
from public.cw_tenants t
join auth.users u on u.email in ('ahsanilyas35@gmail.com', 'ahsanilys46@gmail.com')
where t.slug = 'assorted-coworking'
on conflict do nothing;
