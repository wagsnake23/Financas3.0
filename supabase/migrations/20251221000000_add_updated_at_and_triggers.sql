-- Adicionar coluna updated_at
alter table despesas_parcelas add column if not exists updated_at timestamptz default now();
alter table despesas add column if not exists updated_at timestamptz default now();
alter table receitas add column if not exists updated_at timestamptz default now();

-- Criar função para atualizar updated_at automaticamente
Create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Criar triggers para despesas_parcelas
drop trigger if exists trigger_updated_at_despesas_parcelas on despesas_parcelas;
create trigger trigger_updated_at_despesas_parcelas
before update on despesas_parcelas
for each row execute procedure handle_updated_at();

-- Criar triggers para despesas
drop trigger if exists trigger_updated_at_despesas on despesas;
create trigger trigger_updated_at_despesas
before update on despesas
for each row execute procedure handle_updated_at();

-- Criar triggers para receitas
drop trigger if exists trigger_updated_at_receitas on receitas;
create trigger trigger_updated_at_receitas
before update on receitas
for each row execute procedure handle_updated_at();