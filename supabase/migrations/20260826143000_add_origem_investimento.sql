alter table public.investimentos
add column origem_investimento text;

update public.investimentos
set origem_investimento = 'caixa_externo';

alter table public.investimentos
alter column origem_investimento set not null;

alter table public.investimentos
add constraint investimentos_origem_check
check (
  origem_investimento in (
    'saldo_atual',
    'caixa_externo'
  )
);