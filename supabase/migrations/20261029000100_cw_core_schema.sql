-- Assorted Coworking ERP: tenant-scoped schema (tables prefixed cw_ because the
-- Supabase project is shared with other apps). Applied to project aliegtwlfphpeyvesyvi.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tenants
create table if not exists public.cw_tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  address text,
  phone text,
  email text,
  bank_details jsonb not null default '{}'::jsonb,
  whatsapp_phone_number_id text,
  from_email text,
  owner_phone text,
  owner_email text,
  billing_day int not null default 28 check (billing_day between 1 and 28),
  deposit_per_seat numeric(12,2) not null default 10000,
  capacity int not null default 30,
  pricing jsonb not null default '[]'::jsonb,
  allowed_origins text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cw_tenant_users (
  tenant_id uuid not null references public.cw_tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner','staff')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index if not exists cw_tenant_users_user_idx on public.cw_tenant_users (user_id);

create table if not exists public.cw_counters (
  tenant_id uuid not null references public.cw_tenants(id) on delete cascade,
  key text not null,
  value int not null,
  primary key (tenant_id, key)
);

-- ---------------------------------------------------------------- helpers
create or replace function public.cw_is_tenant_member(t uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cw_tenant_users
    where tenant_id = t and user_id = (select auth.uid())
  );
$$;
revoke execute on function public.cw_is_tenant_member(uuid) from anon;

create or replace function public.cw_is_tenant_owner(t uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cw_tenant_users
    where tenant_id = t and user_id = (select auth.uid()) and role = 'owner'
  );
$$;
revoke execute on function public.cw_is_tenant_owner(uuid) from anon;

create or replace function public.cw_next_counter(t uuid, k text, start_at int default 1001)
returns int
language plpgsql
set search_path = ''
as $$
declare v int;
begin
  insert into public.cw_counters (tenant_id, key, value) values (t, k, start_at)
  on conflict (tenant_id, key) do update set value = public.cw_counters.value + 1
  returning value into v;
  return v;
end;
$$;

create or replace function public.cw_set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

-- ---------------------------------------------------------------- members
create table if not exists public.cw_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.cw_tenants(id) on delete cascade,
  member_no text,
  full_name text not null,
  phone text not null,
  email text,
  company text,
  cnic text,
  plan_code text not null,
  plan_name text not null,
  plan_price numeric(12,2) not null,
  seats int not null default 1 check (seats between 1 and 50),
  monthly_fee numeric(12,2) not null,
  deposit numeric(12,2) not null default 0,
  start_date date not null,
  billing_day int not null default 28,
  status text not null default 'pending_payment'
    check (status in ('pending_payment','active','suspended','inactive')),
  emergency_contact text,
  heard_from text,
  notes text,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, member_no)
);
create index if not exists cw_members_tenant_status_idx on public.cw_members (tenant_id, status);
create index if not exists cw_members_tenant_phone_idx on public.cw_members (tenant_id, phone);

create or replace function public.cw_assign_member_no()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.member_no is null then
    new.member_no := 'M-' || public.cw_next_counter(new.tenant_id, 'member', 1001);
  end if;
  return new;
end; $$;
drop trigger if exists cw_members_assign_no on public.cw_members;
create trigger cw_members_assign_no before insert on public.cw_members
  for each row execute function public.cw_assign_member_no();
drop trigger if exists cw_members_updated_at on public.cw_members;
create trigger cw_members_updated_at before update on public.cw_members
  for each row execute function public.cw_set_updated_at();

create table if not exists public.cw_onboarding_submissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.cw_tenants(id) on delete cascade,
  member_id uuid references public.cw_members(id) on delete set null,
  payload jsonb not null,
  ip text,
  user_agent text,
  source text not null default 'join-form',
  created_at timestamptz not null default now()
);
create index if not exists cw_onboarding_submissions_tenant_idx on public.cw_onboarding_submissions (tenant_id, created_at desc);

-- ---------------------------------------------------------------- invoices
create table if not exists public.cw_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.cw_tenants(id) on delete cascade,
  member_id uuid not null references public.cw_members(id) on delete cascade,
  invoice_no text,
  period_month date not null,
  kind text not null default 'monthly' check (kind in ('monthly','signup','adhoc')),
  issue_date date not null default current_date,
  due_date date not null,
  amount numeric(12,2) not null,
  status text not null default 'sent'
    check (status in ('draft','sent','paid','overdue','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, invoice_no),
  unique (tenant_id, member_id, period_month, kind)
);
create index if not exists cw_invoices_tenant_status_due_idx on public.cw_invoices (tenant_id, status, due_date);
create index if not exists cw_invoices_member_idx on public.cw_invoices (member_id);

create or replace function public.cw_assign_invoice_no()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.invoice_no is null then
    new.invoice_no := 'INV-' || public.cw_next_counter(new.tenant_id, 'invoice', 1001);
  end if;
  return new;
end; $$;
drop trigger if exists cw_invoices_assign_no on public.cw_invoices;
create trigger cw_invoices_assign_no before insert on public.cw_invoices
  for each row execute function public.cw_assign_invoice_no();
drop trigger if exists cw_invoices_updated_at on public.cw_invoices;
create trigger cw_invoices_updated_at before update on public.cw_invoices
  for each row execute function public.cw_set_updated_at();

-- ---------------------------------------------------------------- payments / expenses
create table if not exists public.cw_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.cw_tenants(id) on delete cascade,
  invoice_id uuid references public.cw_invoices(id) on delete set null,
  member_id uuid references public.cw_members(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  method text not null default 'bank_transfer' check (method in ('cash','bank_transfer','online','cheque')),
  paid_on date not null default current_date,
  reference text,
  receipt_path text,
  notes text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists cw_payments_tenant_paid_on_idx on public.cw_payments (tenant_id, paid_on desc);
create index if not exists cw_payments_invoice_idx on public.cw_payments (invoice_id);
create index if not exists cw_payments_member_idx on public.cw_payments (member_id);

create table if not exists public.cw_expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.cw_tenants(id) on delete cascade,
  title text not null,
  category text not null default 'misc',
  amount numeric(12,2) not null check (amount > 0),
  spent_on date not null default current_date,
  method text not null default 'cash' check (method in ('cash','bank_transfer','online','cheque')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists cw_expenses_tenant_spent_on_idx on public.cw_expenses (tenant_id, spent_on desc);

-- ---------------------------------------------------------------- message log
create table if not exists public.cw_message_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.cw_tenants(id) on delete cascade,
  member_id uuid references public.cw_members(id) on delete set null,
  invoice_id uuid references public.cw_invoices(id) on delete set null,
  channel text not null check (channel in ('whatsapp','email')),
  template text,
  recipient text not null,
  status text not null check (status in ('sent','failed','skipped')),
  provider_id text,
  error text,
  payload jsonb,
  created_at timestamptz not null default now()
);
create index if not exists cw_message_log_tenant_idx on public.cw_message_log (tenant_id, created_at desc);
create index if not exists cw_message_log_member_idx on public.cw_message_log (member_id);

-- ---------------------------------------------------------------- dashboard view
create or replace view public.cw_dashboard_metrics
with (security_invoker = true) as
select
  t.id as tenant_id,
  t.capacity,
  coalesce((select sum(m.seats) from public.cw_members m where m.tenant_id = t.id and m.status = 'active'), 0)::int as active_seats,
  coalesce((select count(*) from public.cw_members m where m.tenant_id = t.id and m.status = 'active'), 0)::int as active_members,
  coalesce((select count(*) from public.cw_members m where m.tenant_id = t.id and m.status = 'pending_payment'), 0)::int as pending_members,
  coalesce((select sum(m.monthly_fee) from public.cw_members m where m.tenant_id = t.id and m.status = 'active'), 0)::numeric as mrr,
  coalesce((select sum(i.amount) from public.cw_invoices i where i.tenant_id = t.id and i.status in ('sent','overdue')), 0)::numeric as outstanding,
  coalesce((select sum(i.amount) from public.cw_invoices i where i.tenant_id = t.id and i.status = 'overdue'), 0)::numeric as overdue,
  coalesce((select sum(p.amount) from public.cw_payments p where p.tenant_id = t.id and p.paid_on >= date_trunc('month', current_date)::date), 0)::numeric as collected_this_month,
  coalesce((select sum(e.amount) from public.cw_expenses e where e.tenant_id = t.id and e.spent_on >= date_trunc('month', current_date)::date), 0)::numeric as expenses_this_month
from public.cw_tenants t;

-- ---------------------------------------------------------------- RLS
alter table public.cw_tenants enable row level security;
alter table public.cw_tenant_users enable row level security;
alter table public.cw_counters enable row level security;
alter table public.cw_members enable row level security;
alter table public.cw_onboarding_submissions enable row level security;
alter table public.cw_invoices enable row level security;
alter table public.cw_payments enable row level security;
alter table public.cw_expenses enable row level security;
alter table public.cw_message_log enable row level security;

drop policy if exists cw_tenants_select on public.cw_tenants;
create policy cw_tenants_select on public.cw_tenants for select to authenticated
  using ((select public.cw_is_tenant_member(id)));
drop policy if exists cw_tenants_update on public.cw_tenants;
create policy cw_tenants_update on public.cw_tenants for update to authenticated
  using ((select public.cw_is_tenant_owner(id))) with check ((select public.cw_is_tenant_owner(id)));

drop policy if exists cw_tenant_users_select on public.cw_tenant_users;
create policy cw_tenant_users_select on public.cw_tenant_users for select to authenticated
  using ((select public.cw_is_tenant_member(tenant_id)));
drop policy if exists cw_tenant_users_insert on public.cw_tenant_users;
create policy cw_tenant_users_insert on public.cw_tenant_users for insert to authenticated
  with check ((select public.cw_is_tenant_owner(tenant_id)));
drop policy if exists cw_tenant_users_delete on public.cw_tenant_users;
create policy cw_tenant_users_delete on public.cw_tenant_users for delete to authenticated
  using ((select public.cw_is_tenant_owner(tenant_id)));

drop policy if exists cw_counters_select on public.cw_counters;
create policy cw_counters_select on public.cw_counters for select to authenticated
  using ((select public.cw_is_tenant_member(tenant_id)));

do $$
declare tbl text;
begin
  foreach tbl in array array['cw_members','cw_onboarding_submissions','cw_invoices','cw_payments','cw_expenses','cw_message_log'] loop
    execute format('drop policy if exists %I_tenant_all on public.%I', tbl, tbl);
    execute format(
      'create policy %I_tenant_all on public.%I for all to authenticated using ((select public.cw_is_tenant_member(tenant_id))) with check ((select public.cw_is_tenant_member(tenant_id)))',
      tbl, tbl);
  end loop;
end $$;

-- Counters are bumped by triggers on behalf of authenticated users: allow the
-- trigger's insert/update through RLS for tenant members.
drop policy if exists cw_counters_write on public.cw_counters;
create policy cw_counters_write on public.cw_counters for all to authenticated
  using ((select public.cw_is_tenant_member(tenant_id))) with check ((select public.cw_is_tenant_member(tenant_id)));

-- ---------------------------------------------------------------- storage: receipts
insert into storage.buckets (id, name, public)
values ('cw-receipts', 'cw-receipts', false)
on conflict (id) do nothing;

drop policy if exists cw_receipts_select on storage.objects;
create policy cw_receipts_select on storage.objects for select to authenticated
  using (bucket_id = 'cw-receipts' and (select public.cw_is_tenant_member(((storage.foldername(name))[1])::uuid)));
drop policy if exists cw_receipts_insert on storage.objects;
create policy cw_receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'cw-receipts' and (select public.cw_is_tenant_member(((storage.foldername(name))[1])::uuid)));
drop policy if exists cw_receipts_delete on storage.objects;
create policy cw_receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'cw-receipts' and (select public.cw_is_tenant_member(((storage.foldername(name))[1])::uuid)));
