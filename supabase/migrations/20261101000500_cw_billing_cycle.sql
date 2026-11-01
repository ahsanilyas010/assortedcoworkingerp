-- Daily/pass members are active but must not be auto-invoiced by the monthly run.
alter table public.cw_members
  add column if not exists billing_cycle text not null default 'monthly'
  check (billing_cycle in ('monthly','daily'));
