-- Rate Card 2026: Day Shift 16,500, Night Shift 15,000, 24 Hour Access 18,000, Dedicated Desk 22,000,
-- 10 Day Flex 10,000, Day Pass 1,500, Private Room 85,000, Meeting Room add-on +5,000.
-- Existing members keep the fee they already have (it is a snapshot on cw_members).
update public.cw_tenants
set pricing = '[
  {"code":"day_shift","name":"Day Shift","detail":"9AM to 5PM","price":16500,"period":"month","unit":"seat","deposit":true},
  {"code":"night_shift","name":"Night Shift","detail":"5PM to 3AM","price":15000,"period":"month","unit":"seat","deposit":true},
  {"code":"all_access","name":"24 Hour Access","detail":"Any time, all month","price":18000,"period":"month","unit":"seat","deposit":true},
  {"code":"dedicated_desk","name":"Dedicated Desk","detail":"Reserved seat, 24/7","price":22000,"period":"month","unit":"seat","deposit":true},
  {"code":"flex_10","name":"10 Day Flex Pass","detail":"Any 10 days in a month","price":10000,"period":"month","unit":"pass","deposit":false},
  {"code":"day_pass","name":"Day Pass","detail":"Full access for one day","price":1500,"period":"day","unit":"pass","deposit":false},
  {"code":"private_room","name":"Private Room","detail":"Lockable team office, 24/7 access","price":85000,"period":"month","unit":"room","deposit":true},
  {"code":"meeting_room_addon","name":"Meeting Room Access","addon":true,"price":5000,"period":"month"}
]'::jsonb
where slug = 'assorted-coworking';
