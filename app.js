(() => {
  const BORBOLETA = '<svg class="borboleta" viewBox="0 0 64 48" aria-hidden="true"><g class="asas"><path class="asa-a" d="M31 22C27 9 14 1 7 4 0 7 3 18 14 22z"/><path class="asa-a" d="M33 22C37 9 50 1 57 4c7 3 4 14-7 18z"/><path class="asa-b" d="M31 24c-9-1-17 5-15 12 2 6 10 6 15-6z"/><path class="asa-b" d="M33 24c9-1 17 5 15 12-2 6-10 6-15-6z"/></g><rect class="corpo" x="30.6" y="15" width="2.8" height="22" rx="1.4"/><path class="antena" d="M32 16c-1-5-4-9-7-11M32 16c1-5 4-9 7-11" fill="none" stroke-width="1.3" stroke-linecap="round"/></svg>';
  const $ = (id) => document.getElementById(id);
  const cfg = window.LOJA_CONFIG || {};
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lista = (s) => String(s || '').split(/[,;/]/).map((x) => x.trim()).filter(Boolean);
  const NOME = cfg.NOME || 'Vestiti';
  const WHATS = String(cfg.WHATSAPP || '').replace(/\D/g, '');

  // ---------- marca e contatos ----------
  document.title = NOME + ' · Moda feminina';
  $('logoNome').textContent = NOME; $('logoRodape').textContent = NOME;
  if (cfg.SLOGAN) $('slogan').textContent = cfg.SLOGAN;
  if (cfg.INSTAGRAM) {
    const u = 'https://instagram.com/' + encodeURIComponent(cfg.INSTAGRAM.replace(/^@/, ''));
    $('linkInsta').href = u; $('linkInsta').hidden = false;
    $('linkInstaRodape').href = u; $('linkInstaRodape').textContent = '@' + cfg.INSTAGRAM.replace(/^@/, ''); $('linkInstaRodape').hidden = false;
  }
  if (cfg.ENDERECO) { $('enderecoRodape').textContent = cfg.ENDERECO; $('enderecoRodape').hidden = false; }
  const foneFmt = (n) => { const m = n.match(/^55(\d{2})(\d{4,5})(\d{4})$/); return m ? `(${m[1]}) ${m[2]}-${m[3]}` : n; };
  $('linkWhatsRodape').textContent = WHATS ? foneFmt(WHATS) : '';
  $('linkWhatsRodape').href = WHATS ? `https://wa.me/${WHATS}` : '#';
  const wa = (texto) => `https://wa.me/${WHATS}?text=${encodeURIComponent(texto)}`;

  let toastT;
  function toast(m) { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600); }

  // imagem padrão para peça sem foto
  const semFoto = () => {
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 400'><rect width='300' height='400' fill='#ece2f8'/><g transform='translate(86 150) scale(2)' opacity='.75'><path fill='#b99ae3' d='M31 22C27 9 14 1 7 4 0 7 3 18 14 22zM33 22C37 9 50 1 57 4c7 3 4 14-7 18z'/><path fill='#e8b8d8' d='M31 24c-9-1-17 5-15 12 2 6 10 6 15-6zM33 24c9-1 17 5 15 12-2 6-10 6-15-6z'/><rect fill='#7b5ea7' x='30.6' y='15' width='2.8' height='22' rx='1.4'/></g></svg>";
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };
  const fotoDe = (p) => p.foto_url || semFoto(p.nome);

  // ---------- estado ----------
  let PECAS = [], categoria = 'Todas';
  const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  let SACOLA = Array.isArray(lsGet('vestiti-sacola')) ? lsGet('vestiti-sacola') : [];
  const salvarSacola = () => { lsSet('vestiti-sacola', SACOLA); renderSacola(); };

  // ---------- vitrine ----------
  function renderCategorias() {
    const cats = ['Todas', ...[...new Set(PECAS.map((p) => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))];
    $('categorias').innerHTML = cats.length > 1
      ? cats.map((c) => `<button type="button" role="tab" aria-selected="${c === categoria}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')
      : '';
  }
  $('categorias').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; categoria = b.dataset.cat; renderCategorias(); renderGrade(); });
  $('busca').addEventListener('input', renderGrade);
  $('ordem').addEventListener('change', renderGrade);

  function renderGrade() {
    const q = $('busca').value.trim().toLowerCase(), ord = $('ordem').value;
    let ps = PECAS.filter((p) => (categoria === 'Todas' || p.categoria === categoria) && (!q || (p.nome + ' ' + p.categoria + ' ' + p.cores).toLowerCase().includes(q)));
    if (cfg.MOSTRAR_ESGOTADOS === false) ps = ps.filter((p) => p.estoque > 0);
    const cmp = { novos: (a, b) => (b.criado_em || '').localeCompare(a.criado_em || ''), menor: (a, b) => a.preco_venda - b.preco_venda, maior: (a, b) => b.preco_venda - a.preco_venda }[ord];
    ps.sort((a, b) => (b.estoque > 0) - (a.estoque > 0) || cmp(a, b));
    $('estado').innerHTML = !PECAS.length ? BORBOLETA + '<strong>Novidades chegando</strong>Ainda não há peças no catálogo. Volte em breve ou fale com a gente pelo WhatsApp.'
      : !ps.length ? '<strong>Nada encontrado</strong>Tente outra busca ou categoria.' : '';
    $('grade').innerHTML = ps.map((p) => {
      const esg = p.estoque <= 0, ult = !esg && p.estoque <= 2, tams = lista(p.tamanhos);
      return `<button type="button" class="card${esg ? ' esgotado' : ''}" data-id="${esc(p.id)}">
        <div class="foto"><img src="${esc(fotoDe(p))}" alt="${esc(p.nome)}" loading="lazy">${esg ? '<span class="selo">Esgotado</span>' : ult ? '<span class="selo ultimas">Últimas peças</span>' : ''}</div>
        <span class="nome">${esc(p.nome)}</span>
        <span class="linha"><span class="valor">${brl.format(p.preco_venda)}</span>${tams.length ? `<span class="tams">${esc(tams.join(' · '))}</span>` : ''}</span>
      </button>`;
    }).join('');
  }
  $('grade').addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) abrirPeca(c.dataset.id); });

  // ---------- detalhe ----------
  let atual = null, tamSel = '', corSel = '', qtdSel = 1;
  function abrirPeca(id) {
    atual = PECAS.find((p) => p.id === id); if (!atual) return;
    tamSel = ''; corSel = ''; qtdSel = 1;
    const tams = lista(atual.tamanhos), cores = lista(atual.cores);
    if (tams.length === 1) tamSel = tams[0];
    if (cores.length === 1) corSel = cores[0];
    $('pecaImg').src = fotoDe(atual); $('pecaImg').alt = atual.nome;
    $('pecaCat').textContent = atual.categoria || '';
    $('pecaNome').textContent = atual.nome;
    $('pecaPreco').textContent = brl.format(atual.preco_venda);
    $('pecaDesc').textContent = atual.descricao || '';
    const esg = atual.estoque <= 0;
    $('pecaEstoque').hidden = !(esg || atual.estoque <= 2);
    $('pecaEstoque').textContent = esg ? 'Esgotada no momento. Pergunte pelo WhatsApp quando volta.' : `Últimas ${atual.estoque} unidades`;
    $('grupoTam').hidden = !tams.length; $('grupoCor').hidden = !cores.length;
    $('pecaTam').innerHTML = tams.map((t) => `<button type="button" data-v="${esc(t)}" aria-pressed="${t === tamSel}">${esc(t)}</button>`).join('');
    $('pecaCor').innerHTML = cores.map((c) => `<button type="button" data-v="${esc(c)}" aria-pressed="${c === corSel}">${esc(c)}</button>`).join('');
    $('btnAdd').disabled = esg; $('btnAdd').textContent = esg ? 'Esgotada' : 'Adicionar à sacola';
    $('pecaErro').hidden = true;
    atualizarPeca();
    $('dlgPeca').showModal(); $('dlgPeca').scrollTop = 0;
  }
  function msgPeca() {
    const p = atual, partes = [`${qtdSel}x ${p.nome}`];
    if (tamSel) partes.push(`Tam. ${tamSel}`); if (corSel) partes.push(`Cor ${corSel}`);
    return `Olá, ${NOME}! Tenho interesse nesta peça:\n\n• ${partes.join(' · ')} · ${brl.format(p.preco_venda * qtdSel)}\n\nEstá disponível?`;
  }
  function falta() {
    if (!$('grupoTam').hidden && !tamSel) return 'Escolha o tamanho.';
    if (!$('grupoCor').hidden && !corSel) return 'Escolha a cor.';
    return '';
  }
  function atualizarPeca() {
    $('qtdValor').textContent = qtdSel;
    const max = Math.max(1, atual.estoque);
    $('qtdMais').disabled = qtdSel >= max; $('qtdMenos').disabled = qtdSel <= 1;
    $('btnPedirJa').href = WHATS ? wa(msgPeca()) : '#';
    $('btnPedirJa').setAttribute('aria-disabled', String(!WHATS));
  }
  const escolher = (cont, set) => (e) => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    set(b.dataset.v); cont.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    $('pecaErro').hidden = true; atualizarPeca();
  };
  $('pecaTam').addEventListener('click', escolher($('pecaTam'), (v) => (tamSel = v)));
  $('pecaCor').addEventListener('click', escolher($('pecaCor'), (v) => (corSel = v)));
  $('qtdMenos').addEventListener('click', () => { qtdSel = Math.max(1, qtdSel - 1); atualizarPeca(); });
  $('qtdMais').addEventListener('click', () => { qtdSel = Math.min(Math.max(1, atual.estoque), qtdSel + 1); atualizarPeca(); });
  $('btnPedirJa').addEventListener('click', (e) => {
    const f = falta(); if (f) { e.preventDefault(); $('pecaErro').textContent = f; $('pecaErro').hidden = false; }
  });
  $('btnAdd').addEventListener('click', () => {
    const f = falta(); if (f) { $('pecaErro').textContent = f; $('pecaErro').hidden = false; return; }
    const ex = SACOLA.find((i) => i.id === atual.id && i.tam === tamSel && i.cor === corSel);
    const noCarrinho = SACOLA.filter((i) => i.id === atual.id).reduce((s, i) => s + i.qtd, 0);
    if (noCarrinho + qtdSel > atual.estoque) { $('pecaErro').textContent = `Temos ${atual.estoque} unidade(s) desta peça e ${noCarrinho} já está(ão) na sacola.`; $('pecaErro').hidden = false; return; }
    if (ex) ex.qtd += qtdSel; else SACOLA.push({ id: atual.id, tam: tamSel, cor: corSel, qtd: qtdSel });
    salvarSacola(); $('dlgPeca').close(); toast('Adicionado à sacola');
  });

  // ---------- sacola ----------
  function itensSacola() {
    return SACOLA.map((i) => ({ ...i, p: PECAS.find((p) => p.id === i.id) })).filter((i) => i.p);
  }
  function renderSacola() {
    const its = itensSacola(), n = its.reduce((s, i) => s + i.qtd, 0), total = its.reduce((s, i) => s + i.qtd * i.p.preco_venda, 0);
    $('sacolaQtd').textContent = n; $('sacolaQtd').hidden = !n;
    $('sacolaTotal').textContent = brl.format(total);
    $('sacolaPe').hidden = !its.length;
    $('sacolaLista').innerHTML = its.length ? its.map((i, k) => `
      <div class="item">
        <img src="${esc(fotoDe(i.p))}" alt="">
        <div><div class="nm">${esc(i.p.nome)}</div><div class="det">${[i.tam && 'Tam. ' + esc(i.tam), i.cor && 'Cor ' + esc(i.cor)].filter(Boolean).join(' · ')}</div>
          <div class="qtd"><button type="button" data-k="${k}" data-d="-1" aria-label="Diminuir">−</button><output>${i.qtd}</output><button type="button" data-k="${k}" data-d="1" aria-label="Aumentar">+</button></div></div>
        <div class="lado"><strong>${brl.format(i.qtd * i.p.preco_venda)}</strong><button type="button" class="rm" data-rm="${k}">Remover</button></div>
      </div>`).join('')
      : '<div class="vazio">' + BORBOLETA + '<strong>Sua sacola está vazia</strong>Toque numa peça para escolher tamanho e cor.</div>';
    const linhas = its.map((i) => `• ${i.qtd}x ${i.p.nome}${i.tam ? ' · Tam. ' + i.tam : ''}${i.cor ? ' · Cor ' + i.cor : ''} · ${brl.format(i.qtd * i.p.preco_venda)}`);
    const nome = $('clienteNome').value.trim();
    const msg = `Olá, ${NOME}! Quero fazer este pedido:\n\n${linhas.join('\n')}\n\nTotal: ${brl.format(total)}${nome ? `\nNome: ${nome}` : ''}\n\nPode confirmar a disponibilidade?`;
    $('btnFinalizar').href = WHATS && its.length ? wa(msg) : '#';
    $('btnFinalizar').setAttribute('aria-disabled', String(!WHATS || !its.length));
  }
  $('sacolaLista').addEventListener('click', (e) => {
    const its = itensSacola(), b = e.target.closest('button'); if (!b) return;
    if (b.dataset.rm != null) { const it = its[+b.dataset.rm]; SACOLA = SACOLA.filter((x) => !(x.id === it.id && x.tam === it.tam && x.cor === it.cor)); return salvarSacola(); }
    if (b.dataset.d) {
      const it = its[+b.dataset.k], alvo = SACOLA.find((x) => x.id === it.id && x.tam === it.tam && x.cor === it.cor);
      const outros = SACOLA.filter((x) => x.id === it.id && x !== alvo).reduce((s, x) => s + x.qtd, 0);
      const novo = alvo.qtd + Number(b.dataset.d);
      if (novo < 1) return;
      if (novo + outros > it.p.estoque) return toast(`Só temos ${it.p.estoque} unidade(s) desta peça`);
      alvo.qtd = novo; salvarSacola();
    }
  });
  $('clienteNome').addEventListener('input', renderSacola);
  $('btnSacola').addEventListener('click', () => { renderSacola(); $('dlgSacola').showModal(); });
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close(); }));

  // ---------- dados ----------
  function carregando() { $('grade').innerHTML = Array.from({ length: 8 }, () => '<div><div class="esqueleto"></div></div>').join(''); }
  async function iniciar() {
    renderSacola();
    const pronto = window.supabase && cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('SEU-PROJETO') && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes('COLE-AQUI');
    if (!pronto) { $('estado').innerHTML = '<strong>Falta configurar</strong>Preencha SUPABASE_URL e SUPABASE_ANON_KEY no arquivo config.js.'; return; }
    carregando();
    const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    let q = sb.from('catalogo').select('*');
    if (cfg.LOJA_ID && !cfg.LOJA_ID.includes('COLE-AQUI')) q = q.eq('loja_id', cfg.LOJA_ID); // opcional: só precisa se o banco tiver mais de uma loja
    const { data, error } = await q.order('criado_em', { ascending: false }).limit(1000);
    if (error) {
      console.error(error); $('grade').innerHTML = '';
      $('estado').innerHTML = '<strong>Não foi possível carregar as peças</strong>Recarregue a página em instantes. Se continuar, fale com a gente pelo WhatsApp.';
      return;
    }
    PECAS = data.map((r) => ({ ...r, preco_venda: Number(r.preco_venda) || 0, estoque: Number(r.estoque) || 0, categoria: r.categoria || '', cores: r.cores || '' }));
    // limpa da sacola o que saiu do catálogo
    SACOLA = SACOLA.filter((i) => PECAS.some((p) => p.id === i.id && p.estoque > 0)); salvarSacola();
    renderCategorias(); renderGrade();
  }
  iniciar();
})();
