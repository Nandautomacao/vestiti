
(() => {
  // ---------- utilidades ----------
  const $ = (id) => document.getElementById(id);
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const brlCompact = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
  const qf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
  const pct = (v) => (isFinite(v) ? (v * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' : '—');
  const money = (v) => brl.format(v || 0);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const hoje = () => iso(new Date());
  const fmtData = (s) => (s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(2, 4) : '');
  const parseNum = (s) => {
    s = String(s ?? '').trim().replace(/\s|R\$/g, '');
    if (!s) return NaN;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    return Number(s);
  };
  const fmtInput = (v) => (isFinite(v) ? v.toFixed(2).replace('.', ',') : '');

  function inPeriod(d, p) {
    if (!d) return false;
    const now = new Date();
    const ym = now.getFullYear() + '-' + pad(now.getMonth() + 1);
    if (p === 'mes') return d.slice(0, 7) === ym;
    if (p === 'mesant') { const x = new Date(now.getFullYear(), now.getMonth() - 1, 1); return d.slice(0, 7) === x.getFullYear() + '-' + pad(x.getMonth() + 1); }
    if (p === '30d') { const x = new Date(); x.setDate(x.getDate() - 29); return d >= iso(x) && d <= hoje(); }
    if (p === 'ano') return d.slice(0, 4) === String(now.getFullYear());
    return true;
  }
  const periodoNome = { mes: 'este mês', mesant: 'mês passado', '30d': 'últimos 30 dias', ano: 'este ano', tudo: 'todo o período' };

  let toastTimer;
  function toast(msg) {
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 3200);
  }

  // ---------- estado ----------
  const S = { db: null, produtos: [], entradas: [], vendas: [] };
  let D = { prod: new Map(), venda: new Map(), entrada: new Map() };

  // Custo médio ponderado: processa entradas e vendas em ordem cronológica.
  function derive() {
    const prod = new Map(S.produtos.map((p) => [p.id, { ...p, qtd: 0, custoMedio: 0, movs: 0 }]));
    const ev = [
      ...S.entradas.map((e) => ({ k: 0, r: e })),
      ...S.vendas.map((v) => ({ k: 1, r: v })),
    ].sort((a, b) => (a.r.data < b.r.data ? -1 : a.r.data > b.r.data ? 1 : a.k - b.k || (a.r.criadoEm || 0) - (b.r.criadoEm || 0)));
    const venda = new Map(), entrada = new Map();
    for (const { k, r } of ev) {
      const st = prod.get(r.produtoId);
      if (!st) continue;
      st.movs++;
      const q = Number(r.qtd) || 0;
      if (k === 0) {
        const c = Number(r.custoUnit) || 0;
        const antes = st.custoMedio;
        if (st.qtd <= 0) st.custoMedio = c;
        else st.custoMedio = (st.qtd * st.custoMedio + q * c) / (st.qtd + q);
        st.qtd += q;
        entrada.set(r.id, { total: q * c, medioAntes: antes, medioDepois: st.custoMedio });
      } else {
        const preco = Number(r.precoUnit) || 0;
        const receita = q * preco, cmv = q * st.custoMedio;
        venda.set(r.id, { receita, cmv, lucro: receita - cmv, custoUnit: st.custoMedio, falta: q > st.qtd + 1e-9 });
        st.qtd -= q;
      }
    }
    D = { prod, venda, entrada };
  }

  const nomeProd = (id) => D.prod.get(id)?.nome || '(produto excluído)';
  const unProd = (id) => D.prod.get(id)?.unidade || 'un';
  function estoquePill(p) {
    if (p.qtd <= 0) return '<span class="pill out">sem estoque</span>';
    if (p.estoqueMin > 0 && p.qtd <= p.estoqueMin) return '<span class="pill low">baixo</span>';
    return '';
  }

  // ---------- render ----------
  function render() {
    derive();
    renderPainel(); renderVendas(); renderEntradas(); renderProdutos(); fillSelects();
    const cats = [...new Set(S.produtos.map((p) => p.categoria).filter(Boolean))].sort();
    $('categorias').innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join('');
  }

  function renderPainel() {
    const p = $('periodo').value;
    const vs = S.vendas.filter((v) => inPeriod(v.data, p));
    let fat = 0, cmv = 0, itens = 0;
    for (const v of vs) { const i = D.venda.get(v.id); if (!i) continue; fat += i.receita; cmv += i.cmv; itens += Number(v.qtd) || 0; }
    const lucro = fat - cmv;
    const comprado = S.entradas.filter((e) => inPeriod(e.data, p)).reduce((s, e) => s + (D.entrada.get(e.id)?.total || 0), 0);
    let valEst = 0, valVenda = 0;
    for (const pr of D.prod.values()) if (pr.qtd > 0) { valEst += pr.qtd * pr.custoMedio; valVenda += pr.qtd * (Number(pr.precoVenda) || 0); }
    const nome = periodoNome[p];
    $('kpis').innerHTML = `
      <div class="kpi"><span class="eyebrow">Faturamento</span><span class="v">${money(fat)}</span><span class="s">${vs.length} venda${vs.length === 1 ? '' : 's'} · ${nome}</span></div>
      <div class="kpi"><span class="eyebrow">Custo do que foi vendido</span><span class="v">${money(cmv)}</span><span class="s">pelo custo médio de entrada</span></div>
      <div class="kpi hl"><span class="eyebrow">Lucro bruto</span><span class="v ${lucro < 0 ? 'neg' : 'pos'}">${money(lucro)}</span><span class="s">margem ${fat ? pct(lucro / fat) : '—'}</span></div>
      <div class="kpi"><span class="eyebrow">Compras no período</span><span class="v">${money(comprado)}</span><span class="s">entradas de mercadoria</span></div>
      <div class="kpi"><span class="eyebrow">Valor em estoque</span><span class="v">${money(valEst)}</span><span class="s">a custo · ${money(valVenda)} a preço de venda</span></div>`;

    // gráfico 6 meses
    const now = new Date(), meses = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); meses.push({ ym: d.getFullYear() + '-' + pad(d.getMonth() + 1), label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), fat: 0, lucro: 0 }); }
    for (const v of S.vendas) { const m = meses.find((x) => x.ym === (v.data || '').slice(0, 7)); const i = D.venda.get(v.id); if (m && i) { m.fat += i.receita; m.lucro += i.lucro; } }
    $('chart').innerHTML = chartSvg(meses);

    // repor
    const repor = [...D.prod.values()].filter((x) => (x.estoqueMin > 0 && x.qtd <= x.estoqueMin) || (x.qtd <= 0 && x.movs > 0)).sort((a, b) => a.qtd - b.qtd);
    $('repor').innerHTML = repor.length
      ? repor.slice(0, 8).map((x) => `<li><span class="name">${esc(x.nome)}</span><span class="num ${x.qtd <= 0 ? 'neg' : ''}">${qf.format(x.qtd)} ${esc(x.unidade || 'un')}<span class="muted"> / mín ${qf.format(x.estoqueMin || 0)}</span></span></li>`).join('')
      : `<li class="muted">${S.produtos.length ? 'Nenhum produto abaixo do mínimo.' : 'Cadastre produtos com estoque mínimo para ver alertas aqui.'}</li>`;

    // top produtos
    const agg = new Map();
    for (const v of vs) { const i = D.venda.get(v.id); if (!i) continue; const a = agg.get(v.produtoId) || { q: 0, fat: 0, lucro: 0 }; a.q += Number(v.qtd) || 0; a.fat += i.receita; a.lucro += i.lucro; agg.set(v.produtoId, a); }
    const top = [...agg.entries()].sort((a, b) => b[1].lucro - a[1].lucro).slice(0, 6);
    $('topTable').innerHTML = top.length
      ? `<thead><tr><th>Produto</th><th class="n">Qtd vendida</th><th class="n">Faturamento</th><th class="n">Lucro</th><th class="n">Margem</th></tr></thead><tbody>${top.map(([id, a]) => `<tr><td>${esc(nomeProd(id))}</td><td class="n">${qf.format(a.q)} ${esc(unProd(id))}</td><td class="n">${money(a.fat)}</td><td class="n ${a.lucro < 0 ? 'neg' : 'pos'}">${money(a.lucro)}</td><td class="n">${a.fat ? pct(a.lucro / a.fat) : '—'}</td></tr>`).join('')}</tbody>`
      : `<tbody><tr><td class="muted" style="border:0">Nenhuma venda em ${nome}.</td></tr></tbody>`;
  }

  function chartSvg(m) {
    const W = 640, H = 230, L = 64, R = 10, T = 12, B = 28;
    const vals = m.flatMap((x) => [x.fat, x.lucro]);
    let max = Math.max(...vals, 0), min = Math.min(...vals, 0);
    if (max === min) max = min + 100;
    // passo "redondo"
    const raw = (max - min) / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= raw);
    max = Math.ceil(max / step) * step; min = Math.floor(min / step) * step;
    const y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min));
    let g = '';
    for (let v = min; v <= max + step / 2; v += step) {
      g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="${v === 0 ? 1.4 : 1}"/>`;
      g += `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${esc(brlCompact.format(v))}</text>`;
    }
    const bw = (W - L - R) / m.length, w = Math.min(22, bw * 0.3);
    m.forEach((x, i) => {
      const cx = L + bw * i + bw / 2;
      const bar = (v, xx, color) => { const y0 = y(0), y1 = y(v); return `<rect x="${xx}" y="${Math.min(y0, y1)}" width="${w}" height="${Math.max(Math.abs(y1 - y0), v ? 1 : 0)}" rx="2" fill="${color}"><title>${esc(x.label)}: ${esc(money(v))}</title></rect>`; };
      g += bar(x.fat, cx - w - 2, 'var(--accent)') + bar(x.lucro, cx + 2, x.lucro < 0 ? 'var(--bad)' : 'var(--good)');
      g += `<text x="${cx}" y="${H - 8}" text-anchor="middle">${esc(x.label)}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Faturamento e lucro dos últimos 6 meses">${g}</svg>`;
  }

  const BORBOLETA = '<svg class="borboleta" viewBox="0 0 64 48" aria-hidden="true"><g class="asas"><path class="asa-a" d="M31 22C27 9 14 1 7 4 0 7 3 18 14 22z"/><path class="asa-a" d="M33 22C37 9 50 1 57 4c7 3 4 14-7 18z"/><path class="asa-b" d="M31 24c-9-1-17 5-15 12 2 6 10 6 15-6z"/><path class="asa-b" d="M33 24c9-1 17 5 15 12-2 6-10 6-15-6z"/></g><rect class="corpo" x="30.6" y="15" width="2.8" height="22" rx="1.4"/><path class="antena" d="M32 16c-1-5-4-9-7-11M32 16c1-5 4-9 7-11" fill="none" stroke-width="1.3" stroke-linecap="round"/></svg>';
  function emptyRow(cols, title, text, btn) {
    return `<tbody><tr><td colspan="${cols}" style="border:0"><div class="empty">${BORBOLETA}<strong>${title}</strong><span>${text}</span>${btn || ''}</div></td></tr></tbody>`;
  }

  function vendasFiltradas() {
    const p = $('periodoVendas').value, q = $('buscaVendas').value.trim().toLowerCase();
    return S.vendas.filter((v) => inPeriod(v.data, p) && (!q || nomeProd(v.produtoId).toLowerCase().includes(q) || (v.cliente || '').toLowerCase().includes(q)))
      .sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.criadoEm || 0) - (a.criadoEm || 0));
  }

  function renderVendas() {
    const rows = vendasFiltradas();
    $('btnCsv').hidden = !rows.length;
    if (!S.vendas.length) { $('vendasTable').innerHTML = emptyRow(9, 'Nenhuma venda registrada', 'Cada venda baixa o estoque e calcula o lucro pelo custo médio do produto.', S.produtos.length ? '<button type="button" class="primary" data-act="nova-venda">+ Registrar venda</button>' : '<span>Comece cadastrando um produto na aba Produtos.</span>'); return; }
    if (!rows.length) { $('vendasTable').innerHTML = emptyRow(9, 'Nada encontrado', 'Mude o período ou a busca.'); return; }
    let tf = 0, tc = 0;
    const body = rows.map((v) => {
      const i = D.venda.get(v.id) || { receita: 0, cmv: 0, lucro: 0 }; tf += i.receita; tc += i.cmv;
      return `<tr><td>${fmtData(v.data)}</td><td class="wrap">${esc(nomeProd(v.produtoId))}${i.falta ? '<span class="pill out" title="Vendido sem estoque suficiente">sem estoque</span>' : ''}${v.obs ? `<span class="sub">${esc(v.obs)}</span>` : ''}</td>
        <td class="n">${qf.format(v.qtd)} ${esc(unProd(v.produtoId))}</td><td class="n">${money(v.precoUnit)}</td><td class="n">${money(i.receita)}</td>
        <td class="n">${money(i.cmv)}</td><td class="n ${i.lucro < 0 ? 'neg' : 'pos'}">${money(i.lucro)}</td><td>${esc(v.cliente || '')}</td>
        <td><button type="button" class="ghost danger" data-act="del-venda" data-id="${esc(v.id)}" aria-label="Excluir venda">Excluir</button></td></tr>`;
    }).join('');
    $('vendasTable').innerHTML = `<thead><tr><th>Data</th><th>Produto</th><th class="n">Qtd</th><th class="n">Preço un.</th><th class="n">Total</th><th class="n">Custo</th><th class="n">Lucro</th><th>Cliente</th><th></th></tr></thead>
      <tbody>${body}</tbody><tfoot><tr><td colspan="4">${rows.length} venda${rows.length === 1 ? '' : 's'}</td><td class="n">${money(tf)}</td><td class="n">${money(tc)}</td><td class="n ${tf - tc < 0 ? 'neg' : 'pos'}">${money(tf - tc)}</td><td colspan="2">margem ${tf ? pct((tf - tc) / tf) : '—'}</td></tr></tfoot>`;
  }

  function renderEntradas() {
    const p = $('periodoEntradas').value, q = $('buscaEntradas').value.trim().toLowerCase();
    if (!S.entradas.length) { $('entradasTable').innerHTML = emptyRow(8, 'Nenhuma entrada registrada', 'Registre cada compra com quantidade e custo unitário. O custo médio do produto é recalculado a cada entrada.', S.produtos.length ? '<button type="button" data-act="nova-entrada">+ Registrar entrada</button>' : '<span>Comece cadastrando um produto na aba Produtos.</span>'); return; }
    const rows = S.entradas.filter((e) => inPeriod(e.data, p) && (!q || nomeProd(e.produtoId).toLowerCase().includes(q) || (e.fornecedor || '').toLowerCase().includes(q)))
      .sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.criadoEm || 0) - (a.criadoEm || 0));
    if (!rows.length) { $('entradasTable').innerHTML = emptyRow(8, 'Nada encontrado', 'Mude o período ou a busca.'); return; }
    let tot = 0;
    const body = rows.map((e) => {
      const i = D.entrada.get(e.id) || { total: 0 }; tot += i.total;
      return `<tr><td>${fmtData(e.data)}</td><td class="wrap">${esc(nomeProd(e.produtoId))}${e.obs ? `<span class="sub">${esc(e.obs)}</span>` : ''}</td><td class="n">${qf.format(e.qtd)} ${esc(unProd(e.produtoId))}</td>
        <td class="n">${money(e.custoUnit)}</td><td class="n">${money(i.total)}</td><td class="n muted">${i.medioDepois != null ? money(i.medioDepois) : '—'}</td><td>${esc(e.fornecedor || '')}</td>
        <td><button type="button" class="ghost danger" data-act="del-entrada" data-id="${esc(e.id)}" aria-label="Excluir entrada">Excluir</button></td></tr>`;
    }).join('');
    $('entradasTable').innerHTML = `<thead><tr><th>Data</th><th>Produto</th><th class="n">Qtd</th><th class="n">Custo un.</th><th class="n">Total</th><th class="n">Custo médio após</th><th>Fornecedor</th><th></th></tr></thead>
      <tbody>${body}</tbody><tfoot><tr><td colspan="4">${rows.length} entrada${rows.length === 1 ? '' : 's'}</td><td class="n">${money(tot)}</td><td colspan="3"></td></tr></tfoot>`;
  }

  function renderProdutos() {
    const q = $('buscaProdutos').value.trim().toLowerCase();
    if (!S.produtos.length) { $('produtosTable').innerHTML = emptyRow(8, 'Nenhum produto cadastrado', 'Cadastre suas mercadorias com preço de venda e, se quiser, o estoque inicial com o custo pago.', '<button type="button" class="primary" data-act="novo-produto">+ Cadastrar primeiro produto</button>'); return; }
    const rows = [...D.prod.values()].filter((p) => !q || [p.nome, p.codigo, p.categoria].some((x) => (x || '').toLowerCase().includes(q))).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    if (!rows.length) { $('produtosTable').innerHTML = emptyRow(8, 'Nada encontrado', 'Tente outro termo de busca.'); return; }
    let tv = 0;
    const body = rows.map((p) => {
      const preco = Number(p.precoVenda) || 0, margem = preco && p.custoMedio ? (preco - p.custoMedio) / preco : NaN, val = Math.max(p.qtd, 0) * p.custoMedio; tv += val;
      const sub = [p.codigo, p.categoria].filter(Boolean).map(esc).join(' · ');
      return `<tr><td class="wrap">${p.fotoUrl ? `<img class="thumb" src="${esc(p.fotoUrl)}" alt="" loading="lazy">` : ''}${esc(p.nome)}${p.publicado ? '<span class="pill ok">no site</span>' : ''}${sub ? `<span class="sub">${sub}</span>` : ''}</td>
        <td class="n">${qf.format(p.qtd)} ${esc(p.unidade || 'un')}${estoquePill(p)}</td><td class="n">${p.custoMedio ? money(p.custoMedio) : '—'}</td><td class="n">${money(preco)}</td>
        <td class="n ${margem < 0 ? 'neg' : ''}">${pct(margem)}</td><td class="n">${money(val)}</td>
        <td><button type="button" class="ghost" data-act="edit-produto" data-id="${esc(p.id)}">Editar</button><button type="button" class="ghost danger" data-act="del-produto" data-id="${esc(p.id)}">Excluir</button></td></tr>`;
    }).join('');
    $('produtosTable').innerHTML = `<thead><tr><th>Produto</th><th class="n">Estoque</th><th class="n">Custo médio</th><th class="n">Preço venda</th><th class="n">Margem</th><th class="n">Valor em estoque</th><th></th></tr></thead>
      <tbody>${body}</tbody><tfoot><tr><td colspan="5">${rows.length} produto${rows.length === 1 ? '' : 's'}</td><td class="n">${money(tv)}</td><td></td></tr></tfoot>`;
  }

  function fillSelects() {
    const opts = [...D.prod.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((p) => `<option value="${esc(p.id)}">${esc(p.nome)} — ${qf.format(p.qtd)} ${esc(p.unidade || 'un')}</option>`).join('');
    for (const id of ['eProduto', 'vProduto']) { const s = $(id), cur = s.value; s.innerHTML = '<option value="">Selecione…</option>' + opts; if (cur && D.prod.has(cur)) s.value = cur; }
  }

  // ---------- abas ----------
  function setTab(name) {
    document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    for (const t of ['painel', 'vendas', 'entradas', 'produtos']) $('tab-' + t).hidden = t !== name;
  }
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  if (['painel', 'vendas', 'entradas', 'produtos'].includes(location.hash.slice(1))) setTab(location.hash.slice(1));

  for (const id of ['periodo', 'periodoVendas', 'buscaVendas', 'periodoEntradas', 'buscaEntradas', 'buscaProdutos']) $(id).addEventListener('input', render);

  // ---------- diálogos ----------
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  const showErr = (el, msg) => { el.textContent = msg; el.hidden = !msg; };

  // produto
  let editando = null, fotoNova = null, fotoUrl = '';
  function mostrarFoto() {
    const src = fotoNova ? URL.createObjectURL(fotoNova) : fotoUrl;
    $('pFotoPrev').hidden = !src; if (src) $('pFotoPrev').src = src;
    $('pFotoRemover').hidden = !src;
  }
  // reduz a foto para no máximo 1200px antes de enviar (carrega mais rápido no site)
  async function prepararFoto(file) {
    if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem (JPG ou PNG).');
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.85));
  }
  $('pFoto').addEventListener('change', async () => {
    const f = $('pFoto').files[0]; if (!f) return;
    try { fotoNova = await prepararFoto(f); mostrarFoto(); showErr($('pErro'), ''); }
    catch (e) { fotoNova = null; $('pFoto').value = ''; showErr($('pErro'), e.message); }
  });
  $('pFotoRemover').addEventListener('click', () => { fotoNova = null; fotoUrl = ''; $('pFoto').value = ''; mostrarFoto(); });
  function abrirProduto(id) {
    editando = id || null;
    const p = id ? D.prod.get(id) : null;
    $('dlgProdutoTitulo').textContent = p ? 'Editar produto' : 'Novo produto';
    $('pNome').value = p?.nome || ''; $('pCodigo').value = p?.codigo || ''; $('pCategoria').value = p?.categoria || '';
    $('pUnidade').value = p?.unidade || 'un'; $('pPreco').value = p ? fmtInput(Number(p.precoVenda)) : ''; $('pMin').value = p?.estoqueMin || '';
    $('pQtdIni').value = ''; $('pCustoIni').value = ''; $('pInicial').hidden = !!p;
    $('pCatalogo').hidden = !S.temCatalogo; $('pCatalogoAviso').hidden = !!S.temCatalogo;
    $('pPublicado').checked = !!p?.publicado; $('pTamanhos').value = p?.tamanhos || ''; $('pCores').value = p?.cores || ''; $('pDescricao').value = p?.descricao || '';
    $('pFoto').value = ''; fotoNova = null; fotoUrl = p?.fotoUrl || ''; mostrarFoto();
    showErr($('pErro'), ''); $('dlgProduto').showModal(); $('pNome').focus();
  }
  $('formProduto').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const nome = $('pNome').value.trim(), preco = parseNum($('pPreco').value), min = Number($('pMin').value) || 0;
    if (!nome) return showErr($('pErro'), 'Informe o nome do produto.');
    if (!isFinite(preco) || preco < 0) return showErr($('pErro'), 'Informe o preço de venda, por exemplo 25,90.');
    const qIni = Number($('pQtdIni').value) || 0, cIni = parseNum($('pCustoIni').value);
    if (!editando && qIni > 0 && (!isFinite(cIni) || cIni < 0)) return showErr($('pErro'), 'Para lançar estoque inicial, informe também o custo unitário.');
    const dados = { nome, codigo: $('pCodigo').value.trim(), categoria: $('pCategoria').value.trim(), unidade: $('pUnidade').value, precoVenda: preco, estoqueMin: min };
    if (S.temCatalogo) Object.assign(dados, { publicado: $('pPublicado').checked, tamanhos: $('pTamanhos').value.trim(), cores: $('pCores').value.trim(), descricao: $('pDescricao').value.trim(), fotoUrl });
    const btn = ev.submitter; if (btn) btn.disabled = true;
    try {
      if (S.temCatalogo && fotoNova) { dados.fotoUrl = await api.enviarFoto(fotoNova); fotoUrl = dados.fotoUrl; fotoNova = null; }
      if (editando) { await api.updProduto(editando, dados); toast('Produto atualizado'); }
      else {
        const novoId = await api.addProduto(dados);
        if (qIni > 0) await api.addEntrada({ produtoId: novoId, data: hoje(), qtd: qIni, custoUnit: cIni, fornecedor: '', obs: 'Estoque inicial', criadoEm: Date.now() });
        toast('Produto cadastrado');
      }
      $('dlgProduto').close();
    } catch (e) { showErr($('pErro'), msgErro(e)); } finally { if (btn) btn.disabled = false; }
  });

  // entrada
  function abrirEntrada(pid) {
    $('formEntrada').reset(); $('eData').value = hoje(); if (pid) $('eProduto').value = pid;
    showErr($('eErro'), ''); prevEntrada(); $('dlgEntrada').showModal();
  }
  function prevEntrada() {
    const p = D.prod.get($('eProduto').value), q = Number($('eQtd').value) || 0, c = parseNum($('eCusto').value);
    if (!p) { $('ePreview').innerHTML = '<span class="muted">Escolha um produto para ver o efeito no estoque e no custo médio.</span>'; return; }
    const novoMedio = q > 0 && isFinite(c) ? (p.qtd <= 0 ? c : (p.qtd * p.custoMedio + q * c) / (p.qtd + q)) : p.custoMedio;
    $('ePreview').innerHTML = `<span>Total da entrada</span><span class="n">${money(q * (isFinite(c) ? c : 0))}</span>
      <span>Estoque</span><span class="n">${qf.format(p.qtd)} → ${qf.format(p.qtd + q)} ${esc(p.unidade || 'un')}</span>
      <span>Custo médio</span><span class="n">${p.custoMedio ? money(p.custoMedio) : '—'} → ${novoMedio ? money(novoMedio) : '—'}</span>`;
  }
  ['eProduto', 'eQtd', 'eCusto'].forEach((id) => $(id).addEventListener('input', prevEntrada));
  $('formEntrada').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const pid = $('eProduto').value, data = $('eData').value, q = Number($('eQtd').value), c = parseNum($('eCusto').value);
    if (!pid) return showErr($('eErro'), 'Escolha o produto.');
    if (!data) return showErr($('eErro'), 'Informe a data da entrada.');
    if (!(q > 0)) return showErr($('eErro'), 'A quantidade precisa ser maior que zero.');
    if (!isFinite(c) || c < 0) return showErr($('eErro'), 'Informe o custo unitário, por exemplo 12,50.');
    const btn = ev.submitter; if (btn) btn.disabled = true;
    try {
      await api.addEntrada({ produtoId: pid, data, qtd: q, custoUnit: c, fornecedor: $('eFornecedor').value.trim(), obs: $('eObs').value.trim(), criadoEm: Date.now() });
      $('dlgEntrada').close(); toast('Entrada registrada');
    } catch (e) { showErr($('eErro'), msgErro(e)); } finally { if (btn) btn.disabled = false; }
  });

  // venda
  function abrirVenda(pid) {
    $('formVenda').reset(); $('vData').value = hoje(); if (pid) $('vProduto').value = pid;
    const p = D.prod.get($('vProduto').value); if (p) $('vPreco').value = fmtInput(Number(p.precoVenda));
    showErr($('vErro'), ''); prevVenda(); $('dlgVenda').showModal();
  }
  function prevVenda() {
    const p = D.prod.get($('vProduto').value), q = Number($('vQtd').value) || 0, pr = parseNum($('vPreco').value);
    $('vAviso').hidden = true;
    if (!p) { $('vPreview').innerHTML = '<span class="muted">Escolha um produto para ver o lucro estimado.</span>'; return; }
    const total = q * (isFinite(pr) ? pr : 0), custo = q * p.custoMedio, lucro = total - custo;
    $('vPreview').innerHTML = `<span>Em estoque</span><span class="n">${qf.format(p.qtd)} ${esc(p.unidade || 'un')}</span>
      <span>Total da venda</span><span class="n">${money(total)}</span>
      <span>Custo (médio ${money(p.custoMedio)})</span><span class="n">${money(custo)}</span>
      <span><strong>Lucro estimado</strong></span><span class="n ${lucro < 0 ? 'neg' : 'pos'}"><strong>${money(lucro)}</strong>${total ? ' · ' + pct(lucro / total) : ''}</span>`;
    if (q > p.qtd) { $('vAviso').textContent = `Estoque insuficiente: há ${qf.format(p.qtd)} ${p.unidade || 'un'}. Registre uma entrada antes ou ajuste a quantidade.`; $('vAviso').hidden = false; }
    else if (!p.custoMedio) { $('vAviso').textContent = 'Este produto ainda não tem custo de entrada, então o lucro aparece igual ao total.'; $('vAviso').hidden = false; }
  }
  $('vProduto').addEventListener('input', () => { const p = D.prod.get($('vProduto').value); if (p) $('vPreco').value = fmtInput(Number(p.precoVenda)); prevVenda(); });
  ['vQtd', 'vPreco'].forEach((id) => $(id).addEventListener('input', prevVenda));
  $('formVenda').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const pid = $('vProduto').value, data = $('vData').value, q = Number($('vQtd').value), pr = parseNum($('vPreco').value), p = D.prod.get(pid);
    if (!pid) return showErr($('vErro'), 'Escolha o produto.');
    if (!data) return showErr($('vErro'), 'Informe a data da venda.');
    if (!(q > 0)) return showErr($('vErro'), 'A quantidade precisa ser maior que zero.');
    if (!isFinite(pr) || pr < 0) return showErr($('vErro'), 'Informe o preço unitário, por exemplo 25,90.');
    if (p && q > p.qtd + 1e-9) return showErr($('vErro'), 'Não há estoque suficiente para essa venda.');
    const btn = ev.submitter; if (btn) btn.disabled = true;
    try {
      await api.addVenda({ produtoId: pid, data, qtd: q, precoUnit: pr, cliente: $('vCliente').value.trim(), obs: $('vObs').value.trim(), criadoEm: Date.now() });
      $('dlgVenda').close(); toast('Venda registrada');
    } catch (e) { showErr($('vErro'), msgErro(e)); } finally { if (btn) btn.disabled = false; }
  });

  // confirmar exclusão
  let onConfirm = null;
  function confirmar(titulo, texto, fn) { $('cTitulo').textContent = titulo; $('cTexto').textContent = texto; onConfirm = fn; $('dlgConfirm').showModal(); }
  $('formConfirm').addEventListener('submit', async (ev) => {
    ev.preventDefault(); const btn = $('cOk'); btn.disabled = true;
    try { await onConfirm?.(); $('dlgConfirm').close(); } catch (e) { toast(msgErro(e)); } finally { btn.disabled = false; }
  });

  // ações delegadas
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]'); if (!b || !S.db) return;
    const id = b.dataset.id;
    switch (b.dataset.act) {
      case 'nova-venda': return abrirVenda();
      case 'nova-entrada': return abrirEntrada();
      case 'novo-produto': return abrirProduto();
      case 'edit-produto': return abrirProduto(id);
      case 'del-venda': {
        const v = S.vendas.find((x) => x.id === id);
        return confirmar('Excluir venda?', `${nomeProd(v?.produtoId)} · ${qf.format(v?.qtd)} un em ${fmtData(v?.data)}. A quantidade volta para o estoque.`, async () => { await api.del('vendas', id); toast('Venda excluída'); });
      }
      case 'del-entrada': {
        const e = S.entradas.find((x) => x.id === id);
        return confirmar('Excluir entrada?', `${nomeProd(e?.produtoId)} · ${qf.format(e?.qtd)} un em ${fmtData(e?.data)}. O estoque e o custo médio serão recalculados.`, async () => { await api.del('entradas', id); toast('Entrada excluída'); });
      }
      case 'del-produto': {
        const p = D.prod.get(id), ents = S.entradas.filter((x) => x.produtoId === id), vds = S.vendas.filter((x) => x.produtoId === id);
        const n = ents.length + vds.length;
        return confirmar('Excluir produto?', n ? `“${p?.nome}” tem ${ents.length} entrada(s) e ${vds.length} venda(s). Elas também serão excluídas e saem dos relatórios de lucro.` : `“${p?.nome}” será removido do cadastro.`, async () => {
          await api.del('produtos', id); // entradas e vendas saem junto (on delete cascade) toast('Produto excluído');
        });
      }
    }
  });
  $('btnNovaVenda').addEventListener('click', () => abrirVenda());
  $('btnNovaEntrada').addEventListener('click', () => abrirEntrada());
  $('btnNovoProduto').addEventListener('click', () => abrirProduto());

  // CSV
  $('btnCsv').addEventListener('click', async () => {
    const rows = vendasFiltradas();
    const n = (v) => (Number(v) || 0).toFixed(2).replace('.', ',');
    const q = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
    const lines = ['Data;Produto;Quantidade;Preço unitário;Total;Custo;Lucro;Cliente;Observação'];
    for (const v of rows) { const i = D.venda.get(v.id) || {}; lines.push([fmtData(v.data), q(nomeProd(v.produtoId)), String(v.qtd).replace('.', ','), n(v.precoUnit), n(i.receita), n(i.cmv), n(i.lucro), q(v.cliente), q(v.obs)].join(';')); }
    const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `vendas-${hoje()}.csv`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });


  function msgErro(e) {
    const m = String(e?.message || '');
    if (/JWT|session/i.test(m)) return 'Sua sessão expirou. Saia e entre de novo.';
    if (/network|failed to fetch/i.test(m)) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
    return 'Não foi possível salvar: ' + (m || 'erro desconhecido') + '.';
  }

  // ---------- Supabase ----------
  const cfg = window.APP_CONFIG || {};
  const boot = $('boot');
  if (!window.supabase || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_URL.includes('SEU-PROJETO')) {
    boot.textContent = 'Falta configurar o Supabase: preencha SUPABASE_URL e SUPABASE_ANON_KEY no arquivo config.js (veja o README).';
    return;
  }
  const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  // ---------- nome do estabelecimento ----------
  const lsGet = (k) => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  function setLoja(nome) {
    nome = (nome || '').trim() || 'Meu estabelecimento';
    document.querySelectorAll('.loja-nome').forEach((el) => (el.textContent = nome));
    document.title = nome + ' · Estoque & Vendas';
    lsSet('lojaNome', nome);
  }
  setLoja(lsGet('lojaNome') || cfg.NOME_ESTABELECIMENTO);
  function abrirLoja() {
    $('lojaNome').value = document.querySelector('.loja-nome').textContent === 'Meu estabelecimento' ? '' : document.querySelector('.loja-nome').textContent;
    showErr($('lojaErro'), ''); $('dlgLoja').showModal(); $('lojaNome').focus();
  }
  $('btnEditLoja')?.addEventListener('click', abrirLoja);
  $('btnCopiarId')?.addEventListener('click', async () => {
    const t = $('lojaId').textContent;
    try { await navigator.clipboard.writeText(t); toast('ID copiado'); }
    catch { const r = document.createRange(); r.selectNodeContents($('lojaId')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Selecionado: use Ctrl+C'); }
  });
  $('formLoja')?.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const nome = $('lojaNome').value.trim();
    if (!nome) return showErr($('lojaErro'), 'Informe o nome do estabelecimento.');
    const btn = ev.submitter; if (btn) btn.disabled = true;
    const { error } = await sb.auth.updateUser({ data: { estabelecimento: nome } });
    if (btn) btn.disabled = false;
    if (error) return showErr($('lojaErro'), 'Não foi possível salvar: ' + error.message);
    setLoja(nome); $('dlgLoja').close(); toast('Nome atualizado');
  });

  const ts = (v) => Date.parse(v) || 0;
  const fromProd = (r) => ({ id: r.id, nome: r.nome, codigo: r.codigo || '', categoria: r.categoria || '', unidade: r.unidade || 'un', precoVenda: Number(r.preco_venda) || 0, estoqueMin: Number(r.estoque_min) || 0, criadoEm: ts(r.criado_em),
    publicado: !!r.publicado, tamanhos: r.tamanhos || '', cores: r.cores || '', descricao: r.descricao || '', fotoUrl: r.foto_url || '' });
  const fromEnt = (r) => ({ id: r.id, produtoId: r.produto_id, data: r.data, qtd: Number(r.qtd), custoUnit: Number(r.custo_unit), fornecedor: r.fornecedor || '', obs: r.obs || '', criadoEm: ts(r.criado_em) });
  const fromVen = (r) => ({ id: r.id, produtoId: r.produto_id, data: r.data, qtd: Number(r.qtd), precoUnit: Number(r.preco_unit), cliente: r.cliente || '', obs: r.obs || '', criadoEm: ts(r.criado_em) });
  const ok = ({ data, error }) => { if (error) throw error; return data; };
  const toProd = (d) => {
    const r = { nome: d.nome, codigo: d.codigo, categoria: d.categoria, unidade: d.unidade, preco_venda: d.precoVenda, estoque_min: d.estoqueMin };
    if (S.temCatalogo) Object.assign(r, { publicado: !!d.publicado, tamanhos: d.tamanhos || '', cores: d.cores || '', descricao: d.descricao || '', foto_url: d.fotoUrl || '' });
    return r;
  };

  async function fetchAll(table) {
    const out = [];
    for (let from = 0; ; from += 1000) {
      const rows = ok(await sb.from(table).select('*').order('criado_em').order('id').range(from, from + 999));
      out.push(...rows);
      if (rows.length < 1000) return out;
    }
  }
  async function load() {
    const [p, e, v] = await Promise.all([fetchAll('produtos'), fetchAll('entradas'), fetchAll('vendas')]);
    S.produtos = p.map(fromProd); S.entradas = e.map(fromEnt); S.vendas = v.map(fromVen);
    render();
  }
  const api = {
    async addProduto(d) { const r = ok(await sb.from('produtos').insert(toProd(d)).select('id').single()); await load(); return r.id; },
    async updProduto(id, d) { ok(await sb.from('produtos').update(toProd(d)).eq('id', id)); await load(); },
    async addEntrada(d) { ok(await sb.from('entradas').insert({ produto_id: d.produtoId, data: d.data, qtd: d.qtd, custo_unit: d.custoUnit, fornecedor: d.fornecedor, obs: d.obs })); await load(); },
    async addVenda(d) { ok(await sb.from('vendas').insert({ produto_id: d.produtoId, data: d.data, qtd: d.qtd, preco_unit: d.precoUnit, cliente: d.cliente, obs: d.obs })); await load(); },
    async enviarFoto(blob) {
      const path = `${S.uid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      ok(await sb.storage.from('fotos').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false }));
      return sb.storage.from('fotos').getPublicUrl(path).data.publicUrl;
    },
    async del(table, id) { ok(await sb.from(table).delete().eq('id', id)); await load(); },
  };
  S.db = api;

  // ---------- login ----------
  let ativo = null;
  async function entrarNoApp(session) {
    if (ativo === session.user.id) return;
    ativo = session.user.id; S.uid = session.user.id;
    if ($('lojaId')) $('lojaId').textContent = S.uid;
    // o catálogo existe se o catalogo.sql já foi rodado
    S.temCatalogo = !(await sb.from('produtos').select('publicado').limit(1)).error;
    $('auth').hidden = true; $('app').hidden = false; boot.hidden = true;
    $('userEmail').textContent = session.user.email || '';
    const nomeConta = session.user.user_metadata?.estabelecimento || cfg.NOME_ESTABELECIMENTO;
    setLoja(nomeConta);
    if (!nomeConta) setTimeout(abrirLoja, 300);
    $('status').hidden = false; $('status').textContent = 'Carregando seus dados…';
    try {
      await load();
      $('status').hidden = true;
      ['btnNovaVenda', 'btnNovaEntrada', 'btnNovoProduto'].forEach((id) => ($(id).disabled = false));
    } catch (e) {
      console.error(e);
      $('status').textContent = 'Não foi possível carregar os dados. Confira se o arquivo supabase/schema.sql foi executado no seu projeto Supabase.';
    }
  }
  function mostrarLogin() {
    ativo = null; S.produtos = []; S.entradas = []; S.vendas = []; render();
    $('app').hidden = true; boot.hidden = true; $('auth').hidden = false;
  }
  sb.auth.onAuthStateChange((_ev, session) => {
    // roda fora do callback, como recomenda o supabase-js
    setTimeout(() => (session ? entrarNoApp(session) : mostrarLogin()), 0);
  });

  const lErr = (m) => { showErr($('lErro'), m); $('lOk').hidden = true; };
  $('formLogin').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = $('lEmail').value.trim(), senha = $('lSenha').value;
    if (!email || !senha) return lErr('Informe e-mail e senha.');
    $('btnEntrar').disabled = true; lErr('');
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    $('btnEntrar').disabled = false;
    if (error) lErr(/confirm/i.test(error.message) ? 'Confirme seu e-mail pelo link que enviamos antes de entrar.' : 'E-mail ou senha incorretos.');
  });
  $('btnCriar').addEventListener('click', async () => {
    const email = $('lEmail').value.trim(), senha = $('lSenha').value;
    if (!email || senha.length < 6) return lErr('Para criar a conta, informe um e-mail e uma senha com pelo menos 6 caracteres.');
    $('btnCriar').disabled = true; lErr('');
    const { data, error } = await sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: location.origin + location.pathname } });
    $('btnCriar').disabled = false;
    if (error) return lErr(/disabled|not allowed/i.test(error.message) ? 'Novos cadastros estão desativados neste sistema.' : 'Não foi possível criar a conta: ' + error.message);
    if (!data.session) { $('lOk').textContent = 'Conta criada. Abra o e-mail de confirmação e depois entre aqui.'; $('lOk').hidden = false; }
  });
  $('btnSair').addEventListener('click', () => sb.auth.signOut());
})();
