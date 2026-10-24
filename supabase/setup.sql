-- Vestiti — banco completo (estoque + catálogo). Rode este arquivo inteiro UMA vez em:
-- Supabase > SQL Editor > New query > Run.
-- Cada usuário só enxerga e altera os próprios dados (Row Level Security).

create table if not exists public.produtos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome        text not null check (length(trim(nome)) > 0),
  codigo      text default '',
  categoria   text default '',
  unidade     text not null default 'un',
  preco_venda numeric(14,2) not null default 0 check (preco_venda >= 0),
  estoque_min numeric(14,3) not null default 0 check (estoque_min >= 0),
  criado_em   timestamptz not null default now()
);

create table if not exists public.entradas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  produto_id  uuid not null references public.produtos(id) on delete cascade,
  data        date not null default current_date,
  qtd         numeric(14,3) not null check (qtd > 0),
  custo_unit  numeric(14,4) not null check (custo_unit >= 0),
  fornecedor  text default '',
  obs         text default '',
  criado_em   timestamptz not null default now()
);

create table if not exists public.vendas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  produto_id  uuid not null references public.produtos(id) on delete cascade,
  data        date not null default current_date,
  qtd         numeric(14,3) not null check (qtd > 0),
  preco_unit  numeric(14,2) not null check (preco_unit >= 0),
  cliente     text default '',
  obs         text default '',
  criado_em   timestamptz not null default now()
);

create index if not exists produtos_user_idx on public.produtos(user_id);
create index if not exists entradas_user_idx on public.entradas(user_id, data);
create index if not exists entradas_prod_idx on public.entradas(produto_id);
create index if not exists vendas_user_idx   on public.vendas(user_id, data);
create index if not exists vendas_prod_idx   on public.vendas(produto_id);

alter table public.produtos enable row level security;
alter table public.entradas enable row level security;
alter table public.vendas   enable row level security;

drop policy if exists "dono" on public.produtos;
drop policy if exists "dono" on public.entradas;
drop policy if exists "dono" on public.vendas;

create policy "dono" on public.produtos for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "dono" on public.entradas for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
    and exists (select 1 from public.produtos p where p.id = produto_id and p.user_id = auth.uid()));

create policy "dono" on public.vendas for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid()
    and exists (select 1 from public.produtos p where p.id = produto_id and p.user_id = auth.uid()));



-- 1) Campos novos no cadastro de produto
alter table public.produtos add column if not exists descricao text not null default '';
alter table public.produtos add column if not exists tamanhos  text not null default '';
alter table public.produtos add column if not exists cores     text not null default '';
alter table public.produtos add column if not exists foto_url  text not null default '';
alter table public.produtos add column if not exists publicado boolean not null default false;

-- 2) Vitrine pública: só produtos marcados "Mostrar no catálogo",
--    só colunas seguras (sem custo, sem vendas, sem clientes).
--    A view calcula o estoque disponível = entradas - vendas.
create or replace view public.catalogo as
select
  p.id,
  p.user_id      as loja_id,
  p.nome,
  p.categoria,
  p.descricao,
  p.preco_venda,
  p.tamanhos,
  p.cores,
  p.foto_url,
  p.criado_em,
  coalesce(e.q, 0) - coalesce(v.q, 0) as estoque
from public.produtos p
left join (select produto_id, sum(qtd) q from public.entradas group by produto_id) e on e.produto_id = p.id
left join (select produto_id, sum(qtd) q from public.vendas   group by produto_id) v on v.produto_id = p.id
where p.publicado;

grant select on public.catalogo to anon, authenticated;

-- 3) Pasta pública de fotos dos produtos
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do update set public = true;

drop policy if exists "fotos_enviar"  on storage.objects;
drop policy if exists "fotos_alterar" on storage.objects;
drop policy if exists "fotos_apagar"  on storage.objects;

-- cada usuário só mexe na própria pasta: fotos/<id do usuário>/arquivo.jpg
create policy "fotos_enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos_alterar" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos_apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
