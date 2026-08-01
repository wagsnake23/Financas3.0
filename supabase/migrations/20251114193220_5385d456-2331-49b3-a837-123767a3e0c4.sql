create table public.categorias (
  id uuid not null default gen_random_uuid (),
  nome text not null,
  icone text null,
  cor text null,
  user_id uuid null,
  created_at timestamp with time zone null default now(),
  constraint categorias_pkey primary key (id),
  constraint categorias_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;