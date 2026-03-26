-- PATCH: link do plano + atualização da view principal

alter table public.planejamento_operacional
add column if not exists link_plano_emprego_operacional text;

create or replace view public.vw_blocos_regionais_atual as
select
  ce.ano as carnaval_ano,
  ce.nome as carnaval_nome,

  bc.id as bloco_consolidado_id,
  bc.chave_comparacao,
  bc.numero_inscricao,
  bc.nome_do_bloco,
  bc.nome_bloco_normalizado,
  bc.data_do_desfile,
  bc.regional_atual,
  bc.status_atual,
  bc.ativo_na_ultima_importacao,
  bc.precisa_revisao_planejamento,

  rs.importacao_id as importacao_atual_id,
  ir.semana_referencia,
  ir.created_at as importado_em,

  rs.periodo,
  rs.possui_2_desfiles,
  ad.status_anterior as status_antigo,
  rs.status_do_desfile as status_novo,
  rs.justificativa_status,
  rs.categoria_do_bloco,
  rs.autoriza_divulgacao,
  rs.data_cadastro_ou_modificacao,
  rs.primeiro_cadastro,
  rs.publico_anterior,
  rs.publico_declarado,
  rs.publico_planejado,
  rs.observacoes_ano_anterior,
  rs.perfil,
  rs.estilo_de_musica,
  rs.descricao_do_bloco,

  rs.horario_de_concentracao,
  rs.inicio_do_desfile,
  rs.horario_encerramento,
  rs.duracao_do_desfile,
  rs.horario_dispersao,

  rs.equipamentos_utilizados,
  rs.largura_metros,
  rs.comprimento_metros,
  rs.altura_metros,
  rs.potencia_watts,
  rs.dimensao_de_veiculos,

  rs.percurso,
  rs.regional,
  rs.endereco_de_concentracao,
  rs.bairro_de_concentracao,
  rs.endereco_de_dispersao,
  rs.bairro_de_dispersao,
  rs.extensao_do_desfile_metros,
  rs.numero_de_quadras,
  rs.area_do_trajeto_m2,
  rs.capacidade_publico_no_trajeto,
  rs.informacoes_adicionais,

  rs.responsavel_legal,
  rs.cnpj,
  rs.cpf,
  rs.email,
  rs.telefone,
  rs.celular,
  rs.nome_responsavel_secundario,
  rs.email_responsavel_secundario,
  rs.celular_contato_2,

  po.apoio_gcmbh,
  po.informacoes,
  po.perfil_do_evento,
  po.situacao_do_plano,
  po.numero_plano_emprego_operacional,
  po.link_plano_emprego_operacional,
  po.equipe_empenhada,

  po.ordem_servico_dco,
  po.ordem_servico_transito,
  po.ordem_servico_gtur,
  po.ordem_servico_dme,
  po.ordem_servico_gepam,
  po.ordem_servico_gpir,
  po.ordem_servico_dma,
  po.hipercentro,
  po.denesp,
  po.observacoes_posto_comando,
  po.prioridade_dsub,

  po.qtd_transito,
  po.qtd_dme,
  po.qtd_gtur,
  po.qtd_gepam,
  po.qtd_gpir,
  po.qtd_outros,
  po.qtd_dma,
  po.qtd_norte,
  po.qtd_venda_nova,
  po.qtd_pampulha,
  po.qtd_leste,
  po.qtd_nordeste,
  po.qtd_barreiro,
  po.qtd_oeste,
  po.qtd_noroeste,
  po.qtd_centro_sul,
  po.qtd_hipercentro,
  po.total_agentes_empenhados,

  po.revisado_apos_ultima_alteracao,
  po.ultima_revisao_em,

  ad.tipo_alteracao as ultima_tipo_alteracao,
  ad.descricao_resumida as ultima_descricao_alteracao,
  ad.impacto_operacional as ultimo_impacto_operacional,
  ad.created_at as ultima_alteracao_detectada_em

from public.blocos_consolidados bc
join public.carnaval_edicoes ce
  on ce.id = bc.carnaval_edicao_id
left join public.relatorio_snapshot rs
  on rs.id = bc.snapshot_atual_id
left join public.importacoes_relatorio ir
  on ir.id = rs.importacao_id
left join public.planejamento_operacional po
  on po.bloco_consolidado_id = bc.id
left join lateral (
  select
    ad1.status_anterior,
    ad1.status_atual,
    ad1.tipo_alteracao,
    ad1.descricao_resumida,
    ad1.impacto_operacional,
    ad1.created_at
  from public.alteracoes_detectadas ad1
  where ad1.bloco_consolidado_id = bc.id
  order by ad1.created_at desc
  limit 1
) ad on true
where bc.ativo_na_ultima_importacao = true;
