import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { CONFIG } from './config.js';

const state = {
  currentTab: 'blocos',
  session: null,
  supabase: null,
  data: { blocos: [], alteracoes: [], status: [], levantamento: [] }
};

const el = {
  siteTitle: document.getElementById('siteTitle'),
  loginSection: document.getElementById('loginSection'),
  dashboardSection: document.getElementById('dashboardSection'),
  loginForm: document.getElementById('loginForm'),
  logoutBtn: document.getElementById('logoutBtn'),
  refreshBtn: document.getElementById('refreshBtn'),
  sessionBadge: document.getElementById('sessionBadge'),
  navTabs: document.getElementById('navTabs'),
  searchInput: document.getElementById('searchInput'),
  regionalFilter: document.getElementById('regionalFilter'),
  statusFilter: document.getElementById('statusFilter'),
  dateFilter: document.getElementById('dateFilter'),
  summaryCards: document.getElementById('summaryCards'),
  blocosTableWrap: document.getElementById('blocosTableWrap'),
  alteracoesTableWrap: document.getElementById('alteracoesTableWrap'),
  statusTableWrap: document.getElementById('statusTableWrap'),
  levantamentoTableWrap: document.getElementById('levantamentoTableWrap'),
  blocksCount: document.getElementById('blocksCount'),
  changesCount: document.getElementById('changesCount'),
  planningModal: document.getElementById('planningModal'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  cancelModalBtn: document.getElementById('cancelModalBtn'),
  planningForm: document.getElementById('planningForm'),
  modalTitle: document.getElementById('modalTitle'),
  modalBlockId: document.getElementById('modalBlockId'),
  toast: document.getElementById('toast')
};

const planningFields = {
  situacao_do_plano: document.getElementById('situacaoDoPlano'),
  numero_plano_emprego_operacional: document.getElementById('numeroPlano'),
  link_plano_emprego_operacional: document.getElementById('linkPlano'),
  equipe_empenhada: document.getElementById('equipeEmpenhada'),
  prioridade_dsub: document.getElementById('prioridadeDsub'),
  apoio_gcmbh: document.getElementById('apoioGcmbh'),
  informacoes: document.getElementById('informacoesPlanejamento'),
  qtd_transito: document.getElementById('qtdTransito'),
  qtd_dme: document.getElementById('qtdDme'),
  qtd_gtur: document.getElementById('qtdGtur'),
  qtd_gepam: document.getElementById('qtdGepam'),
  qtd_gpir: document.getElementById('qtdGpir'),
  qtd_outros: document.getElementById('qtdOutros'),
  qtd_dma: document.getElementById('qtdDma'),
  qtd_norte: document.getElementById('qtdNorte'),
  qtd_venda_nova: document.getElementById('qtdVendaNova'),
  qtd_pampulha: document.getElementById('qtdPampulha'),
  qtd_leste: document.getElementById('qtdLeste'),
  qtd_nordeste: document.getElementById('qtdNordeste'),
  qtd_barreiro: document.getElementById('qtdBarreiro'),
  qtd_oeste: document.getElementById('qtdOeste'),
  qtd_noroeste: document.getElementById('qtdNoroeste'),
  qtd_centro_sul: document.getElementById('qtdCentroSul'),
  qtd_hipercentro: document.getElementById('qtdHipercentro'),
  total_agentes_empenhados: document.getElementById('totalAgentesEmpenhados'),
  ordem_servico_dco: document.getElementById('ordemServicoDco'),
  ordem_servico_transito: document.getElementById('ordemServicoTransito'),
  ordem_servico_gtur: document.getElementById('ordemServicoGtur'),
  ordem_servico_dme: document.getElementById('ordemServicoDme'),
  ordem_servico_gepam: document.getElementById('ordemServicoGepam'),
  ordem_servico_gpir: document.getElementById('ordemServicoGpir'),
  ordem_servico_dma: document.getElementById('ordemServicoDma'),
  hipercentro: document.getElementById('hipercentroTexto'),
  denesp: document.getElementById('denespTexto')
};

const qtyKeys = [
  'qtd_transito','qtd_dme','qtd_gtur','qtd_gepam','qtd_gpir','qtd_outros','qtd_dma','qtd_norte',
  'qtd_venda_nova','qtd_pampulha','qtd_leste','qtd_nordeste','qtd_barreiro','qtd_oeste','qtd_noroeste',
  'qtd_centro_sul','qtd_hipercentro'
];

function toast(message, isError = false) {
  if (!el.toast) return;
  el.toast.textContent = message;
  el.toast.classList.remove('hidden');
  el.toast.style.borderColor = isError ? 'rgba(255,107,107,.28)' : 'rgba(61,214,208,.28)';
  el.toast.style.color = isError ? '#ffe2e2' : '#e4fffe';
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 3500);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('pt-BR').format(date);
}
function formatNumber(value) { return new Intl.NumberFormat('pt-BR').format(Number(value || 0)); }
function escapeHtml(value) {
  return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'", '&#039;');
}
function slugStatus(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replaceAll(' ', '-');
}
function statusChip(value) {
  const label = value || 'SEM PLANO';
  return `<span class="status-chip ${slugStatus(label)}">${escapeHtml(label)}</span>`;
}
function impactChip(value) {
  const label = value || 'medio';
  return `<span class="impact-chip ${slugStatus(label)}">${escapeHtml(label)}</span>`;
}
function safeUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}
function planoHtml(item) {
  const numero = String(item.numero_plano_emprego_operacional || '').trim();
  const link = safeUrl(item.link_plano_emprego_operacional);
  if (!numero) return '—';
  if (!link) return escapeHtml(numero);
  return `<a class="plan-link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(numero)}</a>`;
}
function ordensServicoHtml(item) {
  const linhas = [
    ['DCO', item.ordem_servico_dco],
    ['Trânsito', item.ordem_servico_transito],
    ['GTUR', item.ordem_servico_gtur],
    ['DME', item.ordem_servico_dme],
    ['GEPAM', item.ordem_servico_gepam],
    ['GPIR', item.ordem_servico_gpir],
    ['DMA', item.ordem_servico_dma],
    ['HIPERCENTRO', item.hipercentro],
    ['DENESP', item.denesp]
  ]
    .map(([rotulo, valor]) => [rotulo, String(valor || '').trim()])
    .filter(([, valor]) => valor)
    .map(([rotulo, valor]) => `<div><strong>${escapeHtml(rotulo)}:</strong> ${escapeHtml(valor)}</div>`);
  return linhas.length ? linhas.join('') : 'Sem ordens lançadas';
}
function getCurrentStatus(item) { return item.status_novo || item.status_atual || ''; }
function faixaPublicoLabel(item) {
  const publico = Number(item.publico_planejado || item.publico_declarado || 0);
  if (publico <= 1000) return 'ATÉ 1.000';
  if (publico <= 5000) return '1.001 A 5.000';
  if (publico <= 10000) return '5.001 A 10.000';
  if (publico <= 20000) return '10.001 A 20.000';
  return 'ACIMA DE 20.000';
}
function empenhosResumo(item) {
  const mapa = [
    ['TRÂNSITO', item.qtd_transito],['DME', item.qtd_dme],['GTUR', item.qtd_gtur],['GEPAM', item.qtd_gepam],['GPIR', item.qtd_gpir],['OUTROS', item.qtd_outros],['DMA', item.qtd_dma],['NORTE', item.qtd_norte],['VENDA NOVA', item.qtd_venda_nova],['PAMPULHA', item.qtd_pampulha],['LESTE', item.qtd_leste],['NORDESTE', item.qtd_nordeste],['BARREIRO', item.qtd_barreiro],['OESTE', item.qtd_oeste],['NOROESTE', item.qtd_noroeste],['CENTRO SUL', item.qtd_centro_sul],['HIPERCENTRO', item.qtd_hipercentro]
  ];
  const ativos = mapa.map(([n,v]) => [n, Number(v||0)]).filter(([,v]) => v>0).map(([n,v]) => `${n} ${v}`);
  return ativos.length ? ativos.join(' • ') : 'Sem empenhos lançados';
}
function filteredBlocos() {
  const search = (el.searchInput?.value || '').trim().toLowerCase();
  const regional = el.regionalFilter?.value || '';
  const status = el.statusFilter?.value || '';
  const date = el.dateFilter?.value || '';
  return state.data.blocos.filter(item => {
    const matchesSearch = !search || String(item.nome_do_bloco || '').toLowerCase().includes(search) || String(item.numero_inscricao || '').toLowerCase().includes(search);
    const matchesRegional = !regional || item.regional_atual === regional;
    const matchesStatus = !status || item.status_novo === status || item.status_atual === status;
    const matchesDate = !date || item.data_do_desfile === date;
    return matchesSearch && matchesRegional && matchesStatus && matchesDate;
  });
}
function renderSummary() {
  const data = filteredBlocos();
  const total = data.length;
  const aprovados = data.filter(i => getCurrentStatus(i) === 'APROVADO').length;
  const revisao = data.filter(i => i.precisa_revisao_planejamento && getCurrentStatus(i) === 'APROVADO').length;
  const efetivo = data.reduce((acc, cur) => acc + Number(cur.total_agentes_empenhados || 0), 0);
  el.summaryCards.innerHTML = `
    <article class="summary-card"><h3>Total de blocos</h3><strong>${formatNumber(total)}</strong><small>Após filtros aplicados</small></article>
    <article class="summary-card"><h3>Aprovados</h3><strong>${formatNumber(aprovados)}</strong><small>Status mais recente</small></article>
    <article class="summary-card"><h3>Precisam revisão</h3><strong>${formatNumber(revisao)}</strong><small>Somente aprovados alterados</small></article>
    <article class="summary-card"><h3>Efetivo empenhado</h3><strong>${formatNumber(efetivo)}</strong><small>Total somado do planejamento</small></article>`;
}

function detailLine(label, value) {
  const v = String(value ?? '').trim();
  return v ? `<div class="detail-line"><span>${escapeHtml(label)}</span><strong>${escapeHtml(v)}</strong></div>` : '';
}
function detailLineHtml(label, valueHtml) {
  const v = String(valueHtml ?? '').trim();
  return v ? `<div class="detail-line"><span>${escapeHtml(label)}</span><strong>${v}</strong></div>` : '';
}
function qtyList(item) {
  const pairs = [
    ['TRÂNSITO', item.qtd_transito], ['DME', item.qtd_dme], ['GTUR', item.qtd_gtur], ['GEPAM', item.qtd_gepam], ['GPIR', item.qtd_gpir],
    ['OUTROS', item.qtd_outros], ['DMA', item.qtd_dma], ['NORTE', item.qtd_norte], ['VENDA NOVA', item.qtd_venda_nova], ['PAMPULHA', item.qtd_pampulha],
    ['LESTE', item.qtd_leste], ['NORDESTE', item.qtd_nordeste], ['BARREIRO', item.qtd_barreiro], ['OESTE', item.qtd_oeste], ['NOROESTE', item.qtd_noroeste],
    ['CENTRO SUL', item.qtd_centro_sul], ['HIPERCENTRO', item.qtd_hipercentro]
  ];
  return pairs.map(([n,v]) => `<div class="qty-chip"><span>${escapeHtml(n)}</span><strong>${formatNumber(v || 0)}</strong></div>`).join('');
}
function renderBlocos() {
  const rows = filteredBlocos();
  el.blocksCount.textContent = `${rows.length} blocos`;
  if (!rows.length) {
    el.blocosTableWrap.innerHTML = `<div class="empty-state">Nenhum bloco encontrado com os filtros atuais.</div>`;
    return;
  }

  el.blocosTableWrap.innerHTML = `<div class="bloco-board">${rows.map(item => {
    const ordens = ordensServicoHtml(item);
    return `
      <article class="bloco-card-main">
        <div class="bloco-head-main">
          <div>
            <div class="card-topline">${escapeHtml(item.numero_inscricao || 'Sem inscrição')} • ${formatDate(item.data_do_desfile)} • ${escapeHtml(item.regional_atual || 'Sem regional')}</div>
            <h3>${escapeHtml(item.nome_do_bloco || 'Sem nome')}</h3>
          </div>
          <div class="status-group-main">
            ${statusChip(item.status_antigo || 'SEM HISTÓRICO')}
            ${statusChip(getCurrentStatus(item) || 'SEM STATUS')}
            ${statusChip(item.situacao_do_plano || 'SEM PLANO')}
          </div>
        </div>

        <div class="bloco-grid-main">
          <section class="info-panel-main">
            <h4>Resumo operacional</h4>
            ${detailLine('Faixa de público', item.faixa_publico || faixaPublicoLabel(item))}
            ${detailLineHtml('Nº do plano', planoHtml(item))}
            ${detailLine('Prioridade DSUB', item.prioridade_dsub)}
            ${detailLine('Equipe empenhada', item.equipe_empenhada)}
            ${detailLine('Apoio GCMBH', item.apoio_gcmbh)}
            ${detailLine('Efetivo total', formatNumber(item.total_agentes_empenhados || 0))}
            ${detailLine('Revisão', item.precisa_revisao_planejamento && getCurrentStatus(item) === 'APROVADO' ? 'Precisa revisar' : 'OK')}
          </section>

          <section class="info-panel-main">
            <h4>Evento</h4>
            ${detailLine('Período', item.periodo)}
            ${detailLine('Categoria', item.categoria_do_bloco)}
            ${detailLine('Perfil', item.perfil)}
            ${detailLine('Estilo de música', item.estilo_de_musica)}
            ${detailLine('Autoriza divulgação', item.autoriza_divulgacao)}
            ${detailLine('Possui 2 desfiles', item.possui_2_desfiles)}
          </section>

          <section class="info-panel-main span-main-2">
            <h4>Empenhos</h4>
            <div class="qty-grid-main">${qtyList(item)}</div>
          </section>

          <section class="info-panel-main span-main-2">
            <h4>Ordens de serviço</h4>
            <div class="full-text-main">${ordens}</div>
          </section>

          <section class="info-panel-main span-main-2">
            <h4>Horários e percurso</h4>
            <div class="detail-grid-main">
              ${detailLine('Concentração', item.horario_de_concentracao)}
              ${detailLine('Início', item.inicio_do_desfile)}
              ${detailLine('Encerramento', item.horario_encerramento)}
              ${detailLine('Duração', item.duracao_do_desfile)}
              ${detailLine('Dispersão', item.horario_dispersao)}
              ${detailLine('Percurso', item.percurso)}
              ${detailLine('Endereço concentração', item.endereco_de_concentracao)}
              ${detailLine('Bairro concentração', item.bairro_de_concentracao)}
              ${detailLine('Endereço dispersão', item.endereco_de_dispersao)}
              ${detailLine('Bairro dispersão', item.bairro_de_dispersao)}
            </div>
          </section>

          <section class="info-panel-main span-main-2">
            <h4>Público e dimensões</h4>
            <div class="detail-grid-main">
              ${detailLine('Público anterior', item.publico_anterior)}
              ${detailLine('Público declarado', item.publico_declarado)}
              ${detailLine('Público planejado', item.publico_planejado)}
              ${detailLine('Capacidade no trajeto', item.capacidade_publico_no_trajeto)}
              ${detailLine('Extensão do desfile (m)', item.extensao_do_desfile_metros)}
              ${detailLine('Número de quadras', item.numero_de_quadras)}
              ${detailLine('Área do trajeto (m²)', item.area_do_trajeto_m2)}
              ${detailLine('Largura (m)', item.largura_metros)}
              ${detailLine('Comprimento (m)', item.comprimento_metros)}
              ${detailLine('Altura (m)', item.altura_metros)}
              ${detailLine('Potência (watts)', item.potencia_watts)}
              ${detailLine('Dimensão de veículos', item.dimensao_de_veiculos)}
            </div>
          </section>

          <section class="info-panel-main span-main-2">
            <h4>Descrição e observações</h4>
            <div class="detail-grid-main">
              ${detailLine('Descrição do bloco', item.descricao_do_bloco)}
              ${detailLine('Justificativa do status', item.justificativa_status)}
              ${detailLine('Observações ano anterior', item.observacoes_ano_anterior)}
              ${detailLine('Informações adicionais', item.informacoes_adicionais)}
              ${detailLine('Informações do planejamento', item.informacoes)}
            </div>
          </section>

          <section class="info-panel-main span-main-2">
            <h4>Responsáveis e contato</h4>
            <div class="detail-grid-main">
              ${detailLine('Responsável legal', item.responsavel_legal)}
              ${detailLine('CNPJ', item.cnpj)}
              ${detailLine('CPF', item.cpf)}
              ${detailLine('E-mail', item.email)}
              ${detailLine('Telefone', item.telefone)}
              ${detailLine('Celular', item.celular)}
              ${detailLine('Responsável secundário', item.nome_responsavel_secundario)}
              ${detailLine('E-mail secundário', item.email_responsavel_secundario)}
              ${detailLine('Celular contato 2', item.celular_contato_2)}
            </div>
          </section>
        </div>
      </article>`;
  }).join('')}</div>`;
}

function renderAlteracoes() {
  const rows = state.data.alteracoes;
  el.changesCount.textContent = `${rows.length} alterações`;
  if (!rows.length) { el.alteracoesTableWrap.innerHTML = `<div class="empty-state">Nenhuma alteração detectada até o momento.</div>`; return; }
  el.alteracoesTableWrap.innerHTML = `<table class="table"><thead><tr><th>Bloco</th><th>Tipo</th><th>Status anterior</th><th>Status atual</th><th>Impacto</th><th>Situação do plano</th><th>Revisado</th></tr></thead><tbody>${rows.map(item=>`<tr><td><strong>${escapeHtml(item.nome_do_bloco || '—')}</strong><div class="secondary">${escapeHtml(item.numero_inscricao || '—')}</div></td><td>${escapeHtml(item.tipo_alteracao || '—')}</td><td>${statusChip(item.status_anterior || '—')}</td><td>${statusChip(item.status_atual || '—')}</td><td>${impactChip(item.impacto_operacional)}</td><td>${statusChip(item.situacao_do_plano || 'SEM PLANO')}</td><td>${item.revisado ? 'Sim' : 'Não'}</td></tr>`).join('')}</tbody></table>`;
}
function renderStatus() {
  const rows = state.data.status;
  if (!rows.length) { el.statusTableWrap.innerHTML = `<div class="empty-state">Sem dados de status.</div>`; return; }
  el.statusTableWrap.innerHTML = `<table class="table"><thead><tr><th>Data</th><th>Total</th><th>Aprovados</th><th>Cadastrados</th><th>Cancelados</th><th>Com plano</th><th>Sem plano</th><th>Efetivo</th></tr></thead><tbody>${rows.map(item=>`<tr><td>${formatDate(item.data_do_desfile)}</td><td>${formatNumber(item.total_blocos)}</td><td>${formatNumber(item.total_aprovados)}</td><td>${formatNumber(item.total_cadastrados)}</td><td>${formatNumber(item.total_cancelados)}</td><td>${formatNumber(item.total_com_plano)}</td><td>${formatNumber(item.total_sem_plano)}</td><td>${formatNumber(item.efetivo_total_empenhado)}</td></tr>`).join('')}</tbody></table>`;
}
function renderLevantamento() {
  const rows = state.data.levantamento;
  if (!rows.length) { el.levantamentoTableWrap.innerHTML = `<div class="empty-state">Sem dados de levantamento.</div>`; return; }
  el.levantamentoTableWrap.innerHTML = `<table class="table"><thead><tr><th>Data</th><th>Regional</th><th>Perfil</th><th>Faixa de público</th><th>Total blocos</th><th>Aprovados</th><th>Cadastrados</th><th>Cancelados</th><th>Efetivo</th></tr></thead><tbody>${rows.map(item=>`<tr><td>${formatDate(item.data_do_desfile)}</td><td>${escapeHtml(item.regional)}</td><td>${escapeHtml(item.perfil)}</td><td>${escapeHtml(item.faixa_publico)}</td><td>${formatNumber(item.total_blocos)}</td><td>${formatNumber(item.total_aprovados)}</td><td>${formatNumber(item.total_cadastrados)}</td><td>${formatNumber(item.total_cancelados)}</td><td>${formatNumber(item.efetivo_total_empenhado)}</td></tr>`).join('')}</tbody></table>`;
}
function fillRegionalFilter() {
  const regionais = [...new Set(state.data.blocos.map(i => i.regional_atual).filter(Boolean))].sort();
  const current = el.regionalFilter.value;
  el.regionalFilter.innerHTML = `<option value="">Todas</option>` + regionais.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
  el.regionalFilter.value = current;
}
function switchTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll('.nav-tab').forEach(btn => btn.classList.toggle('is-active', btn.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === `tab-${tab}`));
}
async function loadData() {
  const client = state.supabase;
  const [blocos, alteracoes, status, levantamento] = await Promise.all([
    client.from('vw_blocos_regionais_atual').select('*').order('data_do_desfile', { ascending: true }).order('nome_do_bloco', { ascending: true }),
    client.from('vw_alteracoes_semana').select('*').order('data_alteracao', { ascending: false }),
    client.from('vw_status_blocos').select('*').order('data_do_desfile', { ascending: true }),
    client.from('vw_levantamento_blocos').select('*').order('data_do_desfile', { ascending: true })
  ]);
  const hasError = [blocos, alteracoes, status, levantamento].find(r => r.error);
  if (hasError) throw hasError.error;
  state.data.blocos = blocos.data || [];
  state.data.alteracoes = alteracoes.data || [];
  state.data.status = status.data || [];
  state.data.levantamento = levantamento.data || [];
  fillRegionalFilter();
  renderAll();
}
function renderAll() { renderSummary(); renderBlocos(); renderAlteracoes(); renderStatus(); renderLevantamento(); }
function setFieldValue(field, value) { if (field) field.value = value ?? ''; }
function getFieldValue(field) { return field ? field.value : ''; }
function updateTotalPreview() {
  const total = qtyKeys.reduce((sum, key) => sum + Number(getFieldValue(planningFields[key]) || 0), 0);
  setFieldValue(planningFields.total_agentes_empenhados, total);
}
function openPlanningModal(blockId) {
  const key = String(blockId);
  const record = state.data.blocos.find(i => String(i.bloco_consolidado_id) === key);
  if (!record) { toast('Bloco não encontrado para edição.', true); return; }
  try {
    if (el.modalTitle) el.modalTitle.textContent = `Planejamento • ${record.nome_do_bloco}`;
    if (el.modalBlockId) el.modalBlockId.value = record.bloco_consolidado_id;
    setFieldValue(planningFields.situacao_do_plano, record.situacao_do_plano || 'SEM PLANO');
    setFieldValue(planningFields.numero_plano_emprego_operacional, record.numero_plano_emprego_operacional || '');
    setFieldValue(planningFields.link_plano_emprego_operacional, record.link_plano_emprego_operacional || '');
    setFieldValue(planningFields.equipe_empenhada, record.equipe_empenhada || '');
    setFieldValue(planningFields.prioridade_dsub, record.prioridade_dsub || '');
    setFieldValue(planningFields.apoio_gcmbh, record.apoio_gcmbh || '');
    setFieldValue(planningFields.informacoes, record.informacoes || '');
    qtyKeys.forEach(key => setFieldValue(planningFields[key], Number(record[key] || 0)));
    setFieldValue(planningFields.ordem_servico_dco, record.ordem_servico_dco || '');
    setFieldValue(planningFields.ordem_servico_transito, record.ordem_servico_transito || '');
    setFieldValue(planningFields.ordem_servico_gtur, record.ordem_servico_gtur || '');
    setFieldValue(planningFields.ordem_servico_dme, record.ordem_servico_dme || '');
    setFieldValue(planningFields.ordem_servico_gepam, record.ordem_servico_gepam || '');
    setFieldValue(planningFields.ordem_servico_gpir, record.ordem_servico_gpir || '');
    setFieldValue(planningFields.ordem_servico_dma, record.ordem_servico_dma || '');
    setFieldValue(planningFields.hipercentro, record.hipercentro || '');
    setFieldValue(planningFields.denesp, record.denesp || '');
    updateTotalPreview();
    el.planningModal.classList.remove('hidden');
    el.planningModal.style.display = 'block';
    el.planningModal.setAttribute('aria-hidden', 'false');
  } catch (error) {
    console.error(error);
    toast(`Erro ao abrir edição: ${error.message}`, true);
  }
}
window.__openPlanningModal = openPlanningModal;
function closePlanningModal() {
  el.planningModal.classList.add('hidden');
  el.planningModal.style.display = '';
  el.planningModal.setAttribute('aria-hidden', 'true');
}
async function savePlanning(event) {
  event.preventDefault();
  const blocoId = el.modalBlockId.value;
  const payload = {
    bloco_consolidado_id: blocoId,
    situacao_do_plano: getFieldValue(planningFields.situacao_do_plano) || 'SEM PLANO',
    numero_plano_emprego_operacional: getFieldValue(planningFields.numero_plano_emprego_operacional) || null,
    link_plano_emprego_operacional: safeUrl(getFieldValue(planningFields.link_plano_emprego_operacional)) || null,
    equipe_empenhada: getFieldValue(planningFields.equipe_empenhada) || null,
    prioridade_dsub: getFieldValue(planningFields.prioridade_dsub) || null,
    apoio_gcmbh: getFieldValue(planningFields.apoio_gcmbh) || null,
    informacoes: getFieldValue(planningFields.informacoes) || null,
    ordem_servico_dco: getFieldValue(planningFields.ordem_servico_dco) || null,
    ordem_servico_transito: getFieldValue(planningFields.ordem_servico_transito) || null,
    ordem_servico_gtur: getFieldValue(planningFields.ordem_servico_gtur) || null,
    ordem_servico_dme: getFieldValue(planningFields.ordem_servico_dme) || null,
    ordem_servico_gepam: getFieldValue(planningFields.ordem_servico_gepam) || null,
    ordem_servico_gpir: getFieldValue(planningFields.ordem_servico_gpir) || null,
    ordem_servico_dma: getFieldValue(planningFields.ordem_servico_dma) || null,
    hipercentro: getFieldValue(planningFields.hipercentro) || null,
    denesp: getFieldValue(planningFields.denesp) || null,
    revisado_apos_ultima_alteracao: true,
    ultima_revisao_em: new Date().toISOString()
  };
  qtyKeys.forEach(key => payload[key] = Number(getFieldValue(planningFields[key]) || 0));
  const { error } = await state.supabase.from('planejamento_operacional').upsert(payload, { onConflict: 'bloco_consolidado_id' });
  if (error) { toast(`Erro ao salvar planejamento: ${error.message}`, true); return; }
  closePlanningModal();
  toast('Planejamento salvo com sucesso.');
  await loadData();
}
function updateSessionUI() {
  if (el.dashboardSection) el.dashboardSection.classList.remove('hidden');
  if (el.loginSection) el.loginSection.classList.add('hidden');
  if (el.logoutBtn) el.logoutBtn.classList.add('hidden');
  if (el.sessionBadge) el.sessionBadge.classList.add('hidden');
  if (el.refreshBtn) el.refreshBtn.classList.remove('hidden');
}

async function bootstrap() {
  if (!CONFIG.supabaseUrl || CONFIG.supabaseUrl.includes('COLE_AQUI')) { toast('Edite o arquivo js/config.js com a URL e a chave anon do Supabase.', true); return; }
  el.siteTitle.textContent = CONFIG.siteTitle;
  state.supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
  updateSessionUI();
  try { await loadData(); } catch (error) { toast(`Erro ao carregar dados: ${error.message}`, true); }
}
if (el.refreshBtn) el.refreshBtn.addEventListener('click', async () => { try { await loadData(); toast('Dados atualizados.'); } catch (error) { toast(`Erro ao atualizar: ${error.message}`, true); } });
if (el.navTabs) el.navTabs.addEventListener('click', event => { const btn = event.target.closest('[data-tab]'); if (!btn) return; switchTab(btn.dataset.tab); });
[el.searchInput, el.regionalFilter, el.statusFilter, el.dateFilter].forEach(input => { if (!input) return; input.addEventListener('input', renderAll); input.addEventListener('change', renderAll); });
if (el.blocosTableWrap) el.blocosTableWrap.addEventListener('click', event => { const button = event.target.closest('[data-open-planning]'); if (!button) return; openPlanningModal(button.dataset.openPlanning); });
if (el.closeModalBtn) el.closeModalBtn.addEventListener('click', closePlanningModal);
if (el.cancelModalBtn) el.cancelModalBtn.addEventListener('click', closePlanningModal);
if (el.planningModal) el.planningModal.addEventListener('click', event => { if (event.target.dataset.closeModal === 'true') closePlanningModal(); });
if (el.planningForm) el.planningForm.addEventListener('submit', savePlanning);
qtyKeys.forEach(key => { const field = planningFields[key]; if (field) field.addEventListener('input', updateTotalPreview); });
bootstrap();