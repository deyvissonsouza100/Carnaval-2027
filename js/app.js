import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { CONFIG } from './config.js';

const qtyKeys = [
  'qtd_transito','qtd_dme','qtd_gtur','qtd_gepam','qtd_gpir','qtd_outros','qtd_dma',
  'qtd_norte','qtd_venda_nova','qtd_pampulha','qtd_leste','qtd_nordeste','qtd_barreiro',
  'qtd_oeste','qtd_noroeste','qtd_centro_sul','qtd_hipercentro'
];

const planningTextKeys = [
  'situacao_do_plano','numero_plano_emprego_operacional','link_plano_emprego_operacional','equipe_empenhada','prioridade_dsub','apoio_gcmbh','informacoes',
  'ordem_servico_dco','ordem_servico_transito','ordem_servico_gtur','ordem_servico_dme','ordem_servico_gepam','ordem_servico_gpir','ordem_servico_dma','hipercentro','denesp'
];

const state = {
  supabase: null,
  currentTab: 'blocos',
  savingRows: new Set(),
  data: { blocos: [], alteracoes: [], status: [], levantamento: [] }
};

const el = {
  siteTitle: document.getElementById('siteTitle'),
  refreshBtn: document.getElementById('refreshBtn'),
  navTabs: document.getElementById('navTabs'),
  searchInput: document.getElementById('searchInput'),
  regionalFilter: document.getElementById('regionalFilter'),
  statusFilter: document.getElementById('statusFilter'),
  dateFilter: document.getElementById('dateFilter'),
  summaryCards: document.getElementById('summaryCards'),
  blocksCount: document.getElementById('blocksCount'),
  changesCount: document.getElementById('changesCount'),
  blocosTableWrap: document.getElementById('blocosTableWrap'),
  alteracoesTableWrap: document.getElementById('alteracoesTableWrap'),
  statusTableWrap: document.getElementById('statusTableWrap'),
  levantamentoTableWrap: document.getElementById('levantamentoTableWrap'),
  toast: document.getElementById('toast')
};

function toast(message, isError = false) {
  if (!el.toast) return;
  el.toast.textContent = message;
  el.toast.classList.remove('hidden');
  el.toast.style.borderColor = isError ? 'rgba(255,107,107,.28)' : 'rgba(61,214,208,.28)';
  el.toast.style.color = isError ? '#ffe2e2' : '#e4fffe';
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 3800);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('pt-BR');
}
function formatNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString('pt-BR') : '0';
}
function safeUrl(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
}
function statusChip(value) {
  const raw = String(value ?? '').trim() || 'SEM STATUS';
  const cls = raw.toUpperCase() === 'APROVADO' ? 'aprovado' : raw.toUpperCase() === 'CADASTRADO' ? 'cadastrado' : raw.toUpperCase() === 'CANCELADO' ? 'cancelado' : raw.toUpperCase().includes('PLANO') ? 'sem-plano' : 'sem-plano';
  return `<span class="status-chip ${cls}">${escapeHtml(raw)}</span>`;
}
function impactChip(value) {
  const raw = String(value ?? 'medio').toLowerCase();
  return `<span class="impact-chip ${escapeHtml(raw)}">${escapeHtml(raw.toUpperCase())}</span>`;
}
function faixaPublicoLabel(item) {
  const publico = Number(item.publico_planejado || item.publico_declarado || 0);
  if (publico <= 1000) return 'ATÉ 1.000';
  if (publico <= 5000) return '1.001 A 5.000';
  if (publico <= 10000) return '5.001 A 10.000';
  if (publico <= 20000) return '10.001 A 20.000';
  return 'ACIMA DE 20.000';
}
function getCurrentStatus(item) {
  return String(item.status_novo || item.status_atual || '').trim().toUpperCase();
}
function planoLinkCell(item) {
  const numero = escapeHtml(item.numero_plano_emprego_operacional || '');
  const link = safeUrl(item.link_plano_emprego_operacional);
  if (!numero && !link) return '—';
  if (numero && link) return `<a class="plan-link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">${numero}</a>`;
  if (numero) return numero;
  return `<a class="plan-link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Abrir</a>`;
}

function renderSummary() {
  const blocos = filteredBlocos();
  const aprovados = blocos.filter(item => getCurrentStatus(item) === 'APROVADO').length;
  const revisao = blocos.filter(item => getCurrentStatus(item) === 'APROVADO' && item.precisa_revisao_planejamento).length;
  const efetivo = blocos.reduce((sum, item) => sum + Number(item.total_agentes_empenhados || 0), 0);
  el.summaryCards.innerHTML = `
    <article class="summary-card"><h3>Total de blocos</h3><strong>${formatNumber(blocos.length)}</strong><small>Registros filtrados</small></article>
    <article class="summary-card"><h3>Aprovados</h3><strong>${formatNumber(aprovados)}</strong><small>Status mais recente</small></article>
    <article class="summary-card"><h3>Precisam revisão</h3><strong>${formatNumber(revisao)}</strong><small>Somente aprovados alterados</small></article>
    <article class="summary-card"><h3>Efetivo empenhado</h3><strong>${formatNumber(efetivo)}</strong><small>Total somado do planejamento</small></article>`;
}

function fillRegionalFilter() {
  const regionais = [...new Set(state.data.blocos.map(i => i.regional_atual).filter(Boolean))].sort();
  const current = el.regionalFilter.value;
  el.regionalFilter.innerHTML = `<option value="">Todas</option>` + regionais.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
  el.regionalFilter.value = current;
}

function filteredBlocos() {
  const q = (el.searchInput?.value || '').trim().toLowerCase();
  const regional = el.regionalFilter?.value || '';
  const status = (el.statusFilter?.value || '').trim().toUpperCase();
  const date = el.dateFilter?.value || '';
  return state.data.blocos.filter(item => {
    const text = `${item.nome_do_bloco || ''} ${item.numero_inscricao || ''}`.toLowerCase();
    const currentStatus = getCurrentStatus(item);
    return (!q || text.includes(q))
      && (!regional || item.regional_atual === regional)
      && (!status || currentStatus === status)
      && (!date || item.data_do_desfile === date);
  });
}

function inputCell(type, value, field, opts = {}) {
  const val = value ?? '';
  const attrs = [`data-field="${field}"`];
  if (opts.min !== undefined) attrs.push(`min="${opts.min}"`);
  if (opts.step !== undefined) attrs.push(`step="${opts.step}"`);
  if (opts.placeholder) attrs.push(`placeholder="${escapeHtml(opts.placeholder)}"`);
  if (opts.readonly) attrs.push('readonly');
  return `<input class="inline-input" type="${type}" value="${escapeHtml(val)}" ${attrs.join(' ')} />`;
}
function textareaCell(value, field) {
  return `<textarea class="inline-textarea" rows="2" data-field="${field}">${escapeHtml(value ?? '')}</textarea>`;
}
function selectPlano(value) {
  const current = String(value || 'SEM PLANO');
  const opts = ['SEM PLANO','EM ELABORACAO','CONCLUIDO','EM EXECUCAO'];
  return `<select class="inline-select" data-field="situacao_do_plano">${opts.map(o => `<option value="${o}" ${o===current?'selected':''}>${o.replaceAll('_',' ')}</option>`).join('')}</select>`;
}
function totalInline(item) {
  const total = qtyKeys.reduce((s, k) => s + Number(item[k] || 0), 0);
  return `<input class="inline-input is-total" type="number" readonly data-field="total_agentes_empenhados" value="${total}" />`;
}
function readonlyCell(value, cls='') {
  return `<div class="cell-readonly ${cls}">${value ? value : '—'}</div>`;
}

function rowHtml(item) {
  const id = escapeHtml(item.bloco_consolidado_id);
  const saving = state.savingRows.has(String(item.bloco_consolidado_id));
  const statusAntigo = statusChip(item.status_antigo || 'SEM HISTÓRICO');
  const statusNovo = statusChip(getCurrentStatus(item) || 'SEM STATUS');
  const revisao = getCurrentStatus(item) === 'APROVADO' && item.precisa_revisao_planejamento ? '<span class="revision-flag">Precisa revisar</span>' : 'OK';
  const values = {
    ...item,
    total_agentes_empenhados: qtyKeys.reduce((s,k)=>s+Number(item[k]||0),0)
  };
  return `<tr data-block-id="${id}">
    <td class="sticky-col sticky-a">${readonlyCell(escapeHtml(item.numero_inscricao || ''))}</td>
    <td class="sticky-col sticky-b">${readonlyCell(`<strong>${escapeHtml(item.nome_do_bloco || '')}</strong>`, 'cell-rich')}</td>
    <td>${readonlyCell(formatDate(item.data_do_desfile))}</td>
    <td>${readonlyCell(escapeHtml(item.regional_atual || ''))}</td>
    <td>${readonlyCell(statusAntigo, 'cell-rich')}</td>
    <td>${readonlyCell(statusNovo, 'cell-rich')}</td>
    <td>${readonlyCell(escapeHtml(item.faixa_publico || faixaPublicoLabel(item)))}</td>
    <td>${readonlyCell(escapeHtml(item.periodo || ''))}</td>
    <td>${readonlyCell(escapeHtml(item.categoria_do_bloco || ''))}</td>
    <td>${readonlyCell(escapeHtml(item.perfil || ''))}</td>
    <td>${readonlyCell(escapeHtml(item.estilo_de_musica || ''))}</td>
    <td>${readonlyCell(escapeHtml(item.publico_anterior || ''))}</td>
    <td>${readonlyCell(escapeHtml(item.publico_declarado || ''))}</td>
    <td>${readonlyCell(escapeHtml(item.publico_planejado || ''))}</td>
    <td>${readonlyCell(escapeHtml(item.percurso || ''), 'wrap-cell')}</td>
    <td>${readonlyCell(escapeHtml(item.horario_de_concentracao || ''))}</td>
    <td>${readonlyCell(escapeHtml(item.inicio_do_desfile || ''))}</td>
    <td>${readonlyCell(escapeHtml(item.horario_encerramento || ''))}</td>
    <td>${readonlyCell(escapeHtml(item.horario_dispersao || ''))}</td>
    <td>${readonlyCell(escapeHtml(item.endereco_de_concentracao || ''), 'wrap-cell')}</td>
    <td>${readonlyCell(escapeHtml(item.endereco_de_dispersao || ''), 'wrap-cell')}</td>
    <td>${readonlyCell(escapeHtml(item.descricao_do_bloco || ''), 'wrap-cell')}</td>
    <td>${readonlyCell(escapeHtml(item.informacoes_adicionais || ''), 'wrap-cell')}</td>
    <td>${readonlyCell(escapeHtml(item.responsavel_legal || ''))}</td>
    <td>${readonlyCell(escapeHtml(item.email || ''))}</td>
    <td>${readonlyCell(escapeHtml(item.celular || ''))}</td>

    <td>${selectPlano(values.situacao_do_plano)}</td>
    <td>${inputCell('text', values.numero_plano_emprego_operacional, 'numero_plano_emprego_operacional')}</td>
    <td><div class="link-cell">${inputCell('url', values.link_plano_emprego_operacional, 'link_plano_emprego_operacional', {placeholder:'https://...'})}<div class="mini-link">${planoLinkCell(item)}</div></div></td>
    <td>${inputCell('text', values.equipe_empenhada, 'equipe_empenhada')}</td>
    <td>${inputCell('text', values.prioridade_dsub, 'prioridade_dsub')}</td>
    <td>${inputCell('text', values.apoio_gcmbh, 'apoio_gcmbh')}</td>
    <td>${textareaCell(values.informacoes, 'informacoes')}</td>

    <td>${inputCell('number', values.qtd_transito, 'qtd_transito', {min:0})}</td>
    <td>${inputCell('number', values.qtd_dme, 'qtd_dme', {min:0})}</td>
    <td>${inputCell('number', values.qtd_gtur, 'qtd_gtur', {min:0})}</td>
    <td>${inputCell('number', values.qtd_gepam, 'qtd_gepam', {min:0})}</td>
    <td>${inputCell('number', values.qtd_gpir, 'qtd_gpir', {min:0})}</td>
    <td>${inputCell('number', values.qtd_outros, 'qtd_outros', {min:0})}</td>
    <td>${inputCell('number', values.qtd_dma, 'qtd_dma', {min:0})}</td>
    <td>${inputCell('number', values.qtd_norte, 'qtd_norte', {min:0})}</td>
    <td>${inputCell('number', values.qtd_venda_nova, 'qtd_venda_nova', {min:0})}</td>
    <td>${inputCell('number', values.qtd_pampulha, 'qtd_pampulha', {min:0})}</td>
    <td>${inputCell('number', values.qtd_leste, 'qtd_leste', {min:0})}</td>
    <td>${inputCell('number', values.qtd_nordeste, 'qtd_nordeste', {min:0})}</td>
    <td>${inputCell('number', values.qtd_barreiro, 'qtd_barreiro', {min:0})}</td>
    <td>${inputCell('number', values.qtd_oeste, 'qtd_oeste', {min:0})}</td>
    <td>${inputCell('number', values.qtd_noroeste, 'qtd_noroeste', {min:0})}</td>
    <td>${inputCell('number', values.qtd_centro_sul, 'qtd_centro_sul', {min:0})}</td>
    <td>${inputCell('number', values.qtd_hipercentro, 'qtd_hipercentro', {min:0})}</td>
    <td>${totalInline(values)}</td>

    <td>${textareaCell(values.ordem_servico_dco, 'ordem_servico_dco')}</td>
    <td>${textareaCell(values.ordem_servico_transito, 'ordem_servico_transito')}</td>
    <td>${textareaCell(values.ordem_servico_gtur, 'ordem_servico_gtur')}</td>
    <td>${textareaCell(values.ordem_servico_dme, 'ordem_servico_dme')}</td>
    <td>${textareaCell(values.ordem_servico_gepam, 'ordem_servico_gepam')}</td>
    <td>${textareaCell(values.ordem_servico_gpir, 'ordem_servico_gpir')}</td>
    <td>${textareaCell(values.ordem_servico_dma, 'ordem_servico_dma')}</td>
    <td>${textareaCell(values.hipercentro, 'hipercentro')}</td>
    <td>${textareaCell(values.denesp, 'denesp')}</td>

    <td>${readonlyCell(escapeHtml(revisao), 'cell-rich')}</td>
    <td class="sticky-col sticky-z action-col"><button class="primary-btn table-save-btn" type="button" data-save-row="${id}" ${saving ? 'disabled' : ''}>${saving ? 'Salvando...' : 'Salvar'}</button></td>
  </tr>`;
}

function renderBlocos() {
  const rows = filteredBlocos();
  el.blocksCount.textContent = `${rows.length} blocos`;
  if (!rows.length) {
    el.blocosTableWrap.innerHTML = `<div class="empty-state">Nenhum bloco encontrado com os filtros atuais.</div>`;
    return;
  }
  const head = `
    <thead><tr>
      <th class="sticky-col sticky-a">Inscrição</th>
      <th class="sticky-col sticky-b">Bloco</th>
      <th>Data</th><th>Regional</th><th>Status antigo</th><th>Status novo</th><th>Faixa público</th><th>Período</th><th>Categoria</th><th>Perfil</th><th>Estilo</th><th>Público anterior</th><th>Público declarado</th><th>Público planejado</th><th>Percurso</th><th>Concentração</th><th>Início</th><th>Encerramento</th><th>Dispersão</th><th>End. concentração</th><th>End. dispersão</th><th>Descrição</th><th>Informações adicionais</th><th>Responsável</th><th>E-mail</th><th>Celular</th>
      <th>Situação do plano</th><th>Nº do plano</th><th>Link do plano</th><th>Equipe empenhada</th><th>Prioridade DSUB</th><th>Apoio GCMBH</th><th>Informações do planejamento</th>
      <th>Trânsito</th><th>DME</th><th>GTUR</th><th>GEPAM</th><th>GPIR</th><th>Outros</th><th>DMA</th><th>Norte</th><th>Venda Nova</th><th>Pampulha</th><th>Leste</th><th>Nordeste</th><th>Barreiro</th><th>Oeste</th><th>Noroeste</th><th>Centro Sul</th><th>Hipercentro</th><th>Total empenhado</th>
      <th>OS DCO</th><th>OS Trânsito</th><th>OS GTUR</th><th>OS DME</th><th>OS GEPAM</th><th>OS GPIR</th><th>OS DMA</th><th>Hipercentro</th><th>DENESP</th><th>Revisão</th><th class="sticky-col sticky-z">Salvar</th>
    </tr></thead>`;
  el.blocosTableWrap.innerHTML = `<div class="table-wrap super-table-wrap"><table class="table planilha-table">${head}<tbody>${rows.map(rowHtml).join('')}</tbody></table></div>`;
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

function renderAll() {
  renderSummary();
  renderBlocos();
  renderAlteracoes();
  renderStatus();
  renderLevantamento();
}

function computeRowTotal(row) {
  let total = 0;
  qtyKeys.forEach(key => {
    const input = row.querySelector(`[data-field="${key}"]`);
    total += Number(input?.value || 0);
  });
  const totalInput = row.querySelector('[data-field="total_agentes_empenhados"]');
  if (totalInput) totalInput.value = String(total);
}

function getRowPayload(row) {
  const blocoId = row.dataset.blockId;
  const payload = { bloco_consolidado_id: blocoId, revisado_apos_ultima_alteracao: true, ultima_revisao_em: new Date().toISOString() };
  planningTextKeys.forEach(key => {
    const field = row.querySelector(`[data-field="${key}"]`);
    let value = field ? field.value : '';
    if (key === 'link_plano_emprego_operacional') value = safeUrl(value);
    payload[key] = value || null;
  });
  qtyKeys.forEach(key => {
    const field = row.querySelector(`[data-field="${key}"]`);
    payload[key] = Number(field?.value || 0);
  });
  return payload;
}

async function saveRow(blockId) {
  const row = document.querySelector(`tr[data-block-id="${CSS.escape(String(blockId))}"]`);
  if (!row) return;
  state.savingRows.add(String(blockId));
  renderBlocos();
  const freshRow = document.querySelector(`tr[data-block-id="${CSS.escape(String(blockId))}"]`) || row;
  const payload = getRowPayload(freshRow);
  const { error } = await state.supabase.from('planejamento_operacional').upsert(payload, { onConflict: 'bloco_consolidado_id' });
  state.savingRows.delete(String(blockId));
  if (error) {
    toast(`Erro ao salvar planejamento: ${error.message}`, true);
    renderBlocos();
    return;
  }
  toast('Planejamento salvo com sucesso.');
  await loadData();
}

function bindTableEvents() {
  if (!el.blocosTableWrap) return;
  el.blocosTableWrap.addEventListener('input', (event) => {
    const field = event.target.closest('[data-field]');
    if (!field) return;
    const row = field.closest('tr[data-block-id]');
    if (!row) return;
    if (qtyKeys.includes(field.dataset.field)) computeRowTotal(row);
  });
  el.blocosTableWrap.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-save-row]');
    if (!btn) return;
    saveRow(btn.dataset.saveRow);
  });
}

async function bootstrap() {
  if (!CONFIG.supabaseUrl || CONFIG.supabaseUrl.includes('COLE_AQUI')) { toast('Edite o arquivo js/config.js com a URL e a chave anon do Supabase.', true); return; }
  if (el.siteTitle) el.siteTitle.textContent = CONFIG.siteTitle;
  state.supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
  try { await loadData(); } catch (error) { console.error(error); toast(`Erro ao carregar dados: ${error.message}`, true); }
}

if (el.refreshBtn) el.refreshBtn.addEventListener('click', async () => { try { await loadData(); toast('Dados atualizados.'); } catch (error) { toast(`Erro ao atualizar: ${error.message}`, true); } });
if (el.navTabs) el.navTabs.addEventListener('click', event => { const btn = event.target.closest('[data-tab]'); if (!btn) return; switchTab(btn.dataset.tab); });
[el.searchInput, el.regionalFilter, el.statusFilter, el.dateFilter].forEach(input => { if (!input) return; input.addEventListener('input', renderAll); input.addEventListener('change', renderAll); });
bindTableEvents();
bootstrap();
