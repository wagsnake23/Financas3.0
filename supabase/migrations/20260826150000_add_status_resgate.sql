alter table public.investimentos add column status text not null default 'ativo';
alter table public.investimentos add constraint status_check check (status in ('ativo', 'resgatado'));
alter table public.investimentos add column data_resgate timestamptz null;
