-- ACESSO PÚBLICO SEM LOGIN PARA O SITE
-- Execute no SQL Editor do Supabase
-- Atenção: estas permissões permitem leitura pública das views
-- e edição pública da tabela planejamento_operacional.

grant usage on schema public to anon, authenticated;

grant select on public.vw_blocos_regionais_atual to anon, authenticated;
grant select on public.vw_alteracoes_semana to anon, authenticated;
grant select on public.vw_status_blocos to anon, authenticated;
grant select on public.vw_levantamento_blocos to anon, authenticated;

grant select, insert, update on public.planejamento_operacional to anon, authenticated;

alter table public.planejamento_operacional enable row level security;

drop policy if exists planejamento_select_authenticated on public.planejamento_operacional;
drop policy if exists planejamento_insert_authenticated on public.planejamento_operacional;
drop policy if exists planejamento_update_authenticated on public.planejamento_operacional;
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

create policy planejamento_select_authenticated
on public.planejamento_operacional
for select
to authenticated
using (true);

create policy planejamento_insert_authenticated
on public.planejamento_operacional
for insert
to authenticated
with check (true);

create policy planejamento_update_authenticated
on public.planejamento_operacional
for update
to authenticated
using (true)
with check (true);
