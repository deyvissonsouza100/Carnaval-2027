-- ACESSO TOTAL SEM LOGIN (ANON)
-- Rode este arquivo no SQL Editor do Supabase.

grant usage on schema public to anon;

grant select on public.vw_blocos_regionais_atual to anon;
grant select on public.vw_alteracoes_semana to anon;
grant select on public.vw_status_blocos to anon;
grant select on public.vw_levantamento_blocos to anon;

grant select, insert, update on public.planejamento_operacional to anon;

alter table public.planejamento_operacional enable row level security;

drop policy if exists planejamento_select_anon on public.planejamento_operacional;
drop policy if exists planejamento_insert_anon on public.planejamento_operacional;
drop policy if exists planejamento_update_anon on public.planejamento_operacional;

create policy planejamento_select_anon
on public.planejamento_operacional
for select
to anon
using (true);

create policy planejamento_insert_anon
on public.planejamento_operacional
for insert
to anon
with check (true);

create policy planejamento_update_anon
on public.planejamento_operacional
for update
to anon
using (true)
with check (true);
