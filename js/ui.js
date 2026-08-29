/* =========================================================================
   ui.js - interface do jogo
   Tudo que depende do tamanho da tela e calculado aqui em pixels e aplicado
   como estilo em linha, porque o navegador do Kindle nao aceita vw/vh nem
   flexbox. Cada casa so e redesenhada quando o que ela mostra muda: no
   e-ink, repintar sem necessidade custa um piscar de tela.
   ========================================================================= */
(function () {
  'use strict';

  var E = Engine;
  var jogo = new E.Jogo();

  var cfg = {
    modo: 'cpu',        /* 'cpu' | 'dois'                  */
    nivel: 2,           /* 1..4                            */
    humano: E.BRANCA,   /* cor do jogador no modo cpu      */
    estilo: 'auto',     /* 'auto' | 'sim' | 'let'          */
    dicas: true,        /* marcar lances possiveis         */
    coords: true
  };

  var est = {
    sel: -1,            /* casa selecionada                */
    destinos: [],       /* lances legais a partir de sel   */
    pensando: false,
    fim: null,
    girado: false,
    ultimoDe: -1, ultimoPara: -1,
    cursor: 96,         /* navegacao por teclado (e1)      */
    usaCursor: false,
    promo: null
  };

  var dim = {};                 /* medidas calculadas             */
  var celulas = [];             /* referencia aos <div> das casas */
  var pintado = [];             /* assinatura do que ja esta na tela */
  var htmlPeca = {};            /* html pronto de cada peca       */
  var htmlMarca = {};
  var usaSimbolos = false;

  var SIMBOLO = { 1: '♙', 2: '♘', 3: '♗', 4: '♖', 5: '♕', 6: '♔',
                  9: '♟', 10: '♞', 11: '♝', 12: '♜', 13: '♛', 14: '♚' };
  var LETRA = { 1: 'P', 2: 'C', 3: 'B', 4: 'T', 5: 'D', 6: 'R' };
  var NOME_NIVEL = { 1: 'Facil', 2: 'Medio', 3: 'Dificil', 4: 'Mestre' };

  function $(id) { return document.getElementById(id); }

  /* ----------------------------------------------------- deteccao de fonte
     Muitos Kindles nao trazem os simbolos de xadrez na fonte do sistema.
     Mede-se a largura de um glifo de xadrez contra a de um caractere que
     com certeza nao existe: se derem igual, os dois viraram "caixinha". */
  function temSimbolosDeXadrez() {
    var d = document.createElement('div');
    d.style.position = 'absolute';
    d.style.left = '-9999px';
    d.style.top = '0';
    d.style.fontSize = '80px';
    d.style.fontFamily = '"DejaVu Sans", "Arial Unicode MS", sans-serif';
    d.style.whiteSpace = 'nowrap';
    document.body.appendChild(d);
    d.innerHTML = '♚';
    var a = d.offsetWidth;
    d.innerHTML = '￾';
    var b = d.offsetWidth;
    d.innerHTML = '♔';
    var c = d.offsetWidth;
    document.body.removeChild(d);
    return a > 0 && a !== b && c !== b;
  }

  /* --------------------------------------------------------------- layout */

  function medirTela() {
    var w = document.documentElement.clientWidth || window.innerWidth || 600;
    var h = document.documentElement.clientHeight || window.innerHeight || 800;
    return { w: w, h: h };
  }

  var BOTOES = ['bNovo', 'bDesfazer', 'bDica', 'bGirar', 'bMenu'];

  function calcularLayout() {
    var t = medirTela();
    var paisagem = t.w > t.h + 40;
    var btnH = 40;
    var lado, painel, colunas, linhasBtn;

    if (paisagem) {
      lado = Math.min(t.h - 18, t.w - 210);
      painel = t.w - lado - 20;
      colunas = (painel >= 340) ? 5 : (painel >= 210) ? 3 : 2;
    } else {
      /* o espaco vertical e disputado: topo + botoes + historico */
      colunas = (t.w >= 420) ? 5 : 3;
      linhasBtn = Math.ceil(5 / colunas);
      lado = Math.min(t.w - 10, t.h - (46 + linhasBtn * (btnH + 4) + 46));
      painel = lado;
    }
    lado = Math.max(160, lado);
    var cel = Math.floor(lado / 8);
    lado = cel * 8;
    linhasBtn = Math.ceil(5 / colunas);

    var largDisp = Math.min(painel, paisagem ? painel : lado);
    var largBtn = Math.floor((largDisp - colunas * 4) / colunas);
    if (largBtn < 58) { colunas = Math.max(2, colunas - 2); largBtn = Math.floor((largDisp - colunas * 4) / colunas); }

    dim = {
      tela: t, paisagem: paisagem, cel: cel, lado: lado,
      fontePeca: Math.floor(cel * 0.74),
      fonteLetra: Math.floor(cel * 0.46),
      ponto: Math.max(8, Math.floor(cel * 0.26)),
      painel: painel, btnH: btnH, largBtn: largBtn,
      colunas: colunas, linhasBtn: Math.ceil(5 / colunas)
    };
  }

  function aplicarLayout() {
    var app = $('app'), quadro = $('quadro');
    app.style.width = (dim.paisagem ? dim.tela.w : (dim.lado + 6)) + 'px';
    quadro.style.width = dim.lado + 'px';
    quadro.style.height = dim.lado + 'px';

    if (dim.paisagem) {
      quadro.style.cssFloat = 'left';
      quadro.style.margin = '4px 8px 0 0';
      $('topo').style.width = (dim.painel - 12) + 'px';
      $('topo').style.cssFloat = 'right';
      $('lado').style.cssFloat = 'right';
      $('lado').style.width = (dim.painel - 12) + 'px';
    } else {
      quadro.style.cssFloat = 'none';
      quadro.style.margin = '4px auto 0 auto';
      $('topo').style.cssFloat = 'none';
      $('topo').style.width = 'auto';
      $('lado').style.cssFloat = 'none';
      $('lado').style.width = 'auto';
    }

    for (var i = 0; i < BOTOES.length; i++) {
      var b = $(BOTOES[i]);
      b.style.width = dim.largBtn + 'px';
      b.style.height = dim.btnH + 'px';
      b.style.lineHeight = (dim.btnH - 4) + 'px';
      b.style.fontSize = (dim.largBtn < 76 ? 13 : 15) + 'px';
    }
    /* floats nao esticam o pai sozinhos no WebKit antigo: altura na mao */
    app.style.height = (dim.paisagem ? Math.max(dim.lado + 14, 200) : 0) + 'px';
    if (!dim.paisagem) app.style.height = 'auto';
    prepararHtml();
  }

  /* Monta antes do tempo os pedacos de html usados nas casas, para que
     redesenhar seja apenas trocar strings. */
  function prepararHtml() {
    var cel = dim.cel, i;
    htmlPeca = {};
    var chaves = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14];
    for (i = 0; i < chaves.length; i++) {
      var p = chaves[i], cor = E.corDe(p), tipo = E.tipoDe(p);
      if (usaSimbolos) {
        htmlPeca[p] = '<span class="peca sim" style="font-size:' + dim.fontePeca +
          'px;line-height:' + cel + 'px">' + SIMBOLO[p] + '</span>';
      } else {
        var d = cel - 8;
        htmlPeca[p] = '<span class="peca let ' + (cor === E.BRANCA ? 'letB' : 'letP') +
          '" style="width:' + (d - 4) + 'px;height:' + (d - 4) + 'px;margin:4px auto;font-size:' +
          dim.fonteLetra + 'px;line-height:' + (d - 4) + 'px">' + LETRA[tipo] + '</span>';
      }
    }
    var pt = dim.ponto;
    htmlMarca.ponto = '<div class="marca" style="width:' + pt + 'px;height:' + pt +
      'px;margin-left:' + (-pt / 2) + 'px;margin-top:' + (-pt / 2) + 'px"></div>';
    htmlMarca.anel = '<div class="anel" style="width:' + (cel - 10) + 'px;height:' +
      (cel - 10) + 'px"></div>';
    htmlMarca.sel = '<div class="selBorda" style="width:' + (cel - 8) + 'px;height:' +
      (cel - 8) + 'px"></div>';
    htmlMarca.ultimo = '<div class="ultimo" style="width:' + (cel - 4) + 'px;height:' +
      (cel - 4) + 'px"></div>';
    htmlMarca.xeque = '<div class="xeque" style="width:' + (cel - 8) + 'px;height:' +
      (cel - 8) + 'px"></div>';
    htmlMarca.cursor = '<div class="selBorda" style="width:' + (cel - 8) + 'px;height:' +
      (cel - 8) + 'px;border-style:dotted"></div>';
  }

  /* --------------------------------------------------------- tabuleiro */

  /* posicao visual (0..63) -> casa 0x88, considerando o giro */
  function visualParaSq(v) {
    var lin = Math.floor(v / 8), col = v % 8;
    if (est.girado) { lin = 7 - lin; col = 7 - col; }
    return lin * 16 + col;
  }

  function construirTabuleiro() {
    var html = ['<table id="tab"><tbody>'];
    for (var lin = 0; lin < 8; lin++) {
      html.push('<tr>');
      for (var col = 0; col < 8; col++) {
        var v = lin * 8 + col;
        html.push('<td><div id="c' + v + '" style="width:' + dim.cel + 'px;height:' +
          dim.cel + 'px;position:relative"></div></td>');
      }
      html.push('</tr>');
    }
    html.push('</tbody></table>');
    $('quadro').innerHTML = html.join('');
    celulas = [];
    pintado = [];
    for (var i = 0; i < 64; i++) { celulas[i] = $('c' + i); pintado[i] = null; }
    ligarToque($('quadro'), aoTocarTabuleiro);
  }

  function ehDestino(sq) {
    for (var i = 0; i < est.destinos.length; i++) {
      if (E.lancePara(est.destinos[i]) === sq) return est.destinos[i];
    }
    return 0;
  }

  function pintarTudo(forcar) {
    var reiEmXeque = -1;
    if (!est.fim && jogo.emXeque(jogo.vez)) reiEmXeque = jogo.reiSq[jogo.vez];

    for (var v = 0; v < 64; v++) {
      var sq = visualParaSq(v);
      var lin = Math.floor(v / 8), col = v % 8;
      var p = jogo.tab[sq];
      var dest = ehDestino(sq);
      var flags =
        (est.sel === sq ? 1 : 0) |
        ((dest && cfg.dicas) ? ((dest & E.F_CAPTURA) ? 4 : 2) : 0) |
        ((sq === est.ultimoDe || sq === est.ultimoPara) ? 8 : 0) |
        (sq === reiEmXeque ? 16 : 0) |
        ((est.usaCursor && sq === est.cursor) ? 32 : 0);

      var assinatura = p + '|' + flags + '|' + (cfg.coords ? 1 : 0) + '|' + dim.cel + '|' + (usaSimbolos ? 1 : 0);
      if (!forcar && pintado[v] === assinatura) continue;
      pintado[v] = assinatura;

      var s = '';
      if (flags & 8) s += htmlMarca.ultimo;
      if (flags & 16) s += htmlMarca.xeque;
      if (p) s += htmlPeca[p];
      if (flags & 1) s += htmlMarca.sel;
      if (flags & 32) s += htmlMarca.cursor;
      if (flags & 2) s += htmlMarca.ponto;
      if (flags & 4) s += htmlMarca.anel;
      if (cfg.coords) {
        if (lin === 7) s += '<span class="coord coordF">' +
          String.fromCharCode(97 + E.fileDe(sq)) + '</span>';
        if (col === 7) s += '<span class="coord coordR">' + (8 - E.rankDe(sq)) + '</span>';
      }
      var el = celulas[v];
      el.className = ((lin + col) % 2 === 0) ? 'clara' : 'escura';
      el.innerHTML = s;
    }
  }

  /* ------------------------------------------------------------- textos */

  function nomeCor(c) { return c === E.BRANCA ? 'brancas' : 'pretas'; }

  function atualizarStatus() {
    var st = $('status'), det = $('detalhe');
    if (est.fim) {
      st.innerHTML = est.fim.texto;
      det.innerHTML = 'Toque em "Novo" para outra partida.';
      return;
    }
    if (est.pensando) {
      st.innerHTML = 'Pensando...';
      det.innerHTML = 'Nivel ' + NOME_NIVEL[cfg.nivel] + ' - aguarde';
      return;
    }
    var xeque = jogo.emXeque(jogo.vez) ? '  XEQUE!' : '';
    if (cfg.modo === 'cpu') {
      st.innerHTML = (jogo.vez === cfg.humano ? 'Sua vez' : 'Vez do computador') +
        ' (' + nomeCor(jogo.vez) + ')' + xeque;
    } else {
      st.innerHTML = 'Vez das ' + nomeCor(jogo.vez) + xeque;
    }
    var n = jogo.historico.length;
    det.innerHTML = 'Lance ' + jogo.lanceCheio + (n ? '  -  ultimo: ' + jogo.historico[n - 1].san : '');
  }

  function atualizarInfo() {
    /* material capturado */
    var cont = {}, i, p;
    for (i = 0; i < 128; i++) {
      if (i & 0x88) continue;
      p = jogo.tab[i];
      if (p) cont[p] = (cont[p] || 0) + 1;
    }
    var inicio = { 1: 8, 2: 2, 3: 2, 4: 2, 5: 1, 9: 8, 10: 2, 11: 2, 12: 2, 13: 1 };
    var faltaB = '', faltaP = '', saldo = 0;
    var ordem = [5, 4, 3, 2, 1];
    for (i = 0; i < ordem.length; i++) {
      var t = ordem[i];
      var nB = inicio[t] - (cont[t] || 0);
      var nP = inicio[t + 8] - (cont[t + 8] || 0);
      while (nB-- > 0) { faltaB += usaSimbolos ? SIMBOLO[t] : LETRA[t]; saldo -= IA.VALOR[t]; }
      while (nP-- > 0) { faltaP += usaSimbolos ? SIMBOLO[t + 8] : LETRA[t]; saldo += IA.VALOR[t]; }
    }
    var texto = '';
    if (faltaP) texto += 'Brancas comeram: ' + faltaP + '  ';
    if (faltaB) texto += 'Pretas comeram: ' + faltaB;
    if (saldo !== 0) {
      texto += '  (' + (saldo > 0 ? '+' : '') + Math.round(saldo / 100 * 10) / 10 + ')';
    }
    $('capturas').innerHTML = texto || '&nbsp;';

    /* ultimos lances */
    var h = jogo.historico, linhas = [], comeco = Math.max(0, h.length - 12);
    if (comeco % 2 === 1) comeco--;
    for (i = comeco; i < h.length; i += 2) {
      var num = Math.floor(i / 2) + 1;
      var par = '<b>' + num + '.</b> ' + h[i].san;
      if (h[i + 1]) par += ' ' + h[i + 1].san;
      linhas.push(par);
    }
    $('lances').innerHTML = linhas.length ? linhas.join(' &nbsp; ') : '<b>Nenhum lance ainda.</b>';
  }

  function atualizarBotoes() {
    var podeDesfazer = jogo.historico.length > 0 && !est.pensando;
    $('bDesfazer').className = 'btn' + (podeDesfazer ? '' : ' apagado');
    var podeDica = !est.fim && !est.pensando && (cfg.modo === 'dois' || jogo.vez === cfg.humano);
    $('bDica').className = 'btn' + (podeDica ? '' : ' apagado');
  }

  function atualizarTudo(forcar) {
    pintarTudo(forcar);
    atualizarStatus();
    atualizarInfo();
    atualizarBotoes();
  }

  /* --------------------------------------------------------- interacao */

  /* O navegador do Kindle as vezes entrega touchstart, as vezes so click.
     Registramos os dois e ignoramos o click que vem logo apos um toque. */
  var ultimoToque = 0;
  function ligarToque(el, fn) {
    if ('ontouchstart' in window || window.Touch) {
      el.ontouchstart = function (ev) {
        ultimoToque = (new Date()).getTime();
        var alvo = ev.target || ev.srcElement;
        if (ev.preventDefault) ev.preventDefault();
        fn(alvo, ev);
        return false;
      };
    }
    el.onclick = function (ev) {
      if ((new Date()).getTime() - ultimoToque < 700) return false;
      ev = ev || window.event;
      var alvo = ev.target || ev.srcElement;
      fn(alvo, ev);
      return false;
    };
  }

  function visualDoAlvo(alvo) {
    /* sobe pelos pais ate achar a div da casa (c0..c63) */
    var n = alvo, prof = 0;
    while (n && prof++ < 6) {
      if (n.id && n.id.charAt(0) === 'c' && n.id.length <= 3) {
        var v = parseInt(n.id.substring(1), 10);
        if (v >= 0 && v <= 63) return v;
      }
      n = n.parentNode;
    }
    return -1;
  }

  function aoTocarTabuleiro(alvo) {
    if (est.pensando || est.fim || est.promo) return;
    if (cfg.modo === 'cpu' && jogo.vez !== cfg.humano) return;
    var v = visualDoAlvo(alvo);
    if (v < 0) return;
    est.usaCursor = false;
    selecionarCasa(visualParaSq(v));
  }

  function selecionarCasa(sq) {
    var lance = ehDestino(sq);
    if (lance) { tentarJogar(lance); return; }

    var p = jogo.tab[sq];
    if (p && E.corDe(p) === jogo.vez) {
      est.sel = sq;
      est.destinos = jogo.lancesDe(sq);
      pintarTudo(false);
      return;
    }
    est.sel = -1;
    est.destinos = [];
    pintarTudo(false);
  }

  function tentarJogar(lance) {
    var de = E.lanceDe(lance), para = E.lancePara(lance);
    /* promocao: pergunta a peca quando ha mais de uma opcao para o destino */
    if (E.lancePromo(lance)) {
      var opcoes = [];
      for (var i = 0; i < est.destinos.length; i++) {
        if (E.lancePara(est.destinos[i]) === para && E.lancePromo(est.destinos[i])) {
          opcoes.push(est.destinos[i]);
        }
      }
      if (opcoes.length > 1) { abrirPromocao(opcoes); return; }
    }
    aplicar(lance);
  }

  function aplicar(lance) {
    est.ultimoDe = E.lanceDe(lance);
    est.ultimoPara = E.lancePara(lance);
    jogo.jogar(lance);
    est.sel = -1;
    est.destinos = [];
    est.fim = jogo.situacao();
    atualizarTudo(false);
    salvar();
    if (!est.fim && cfg.modo === 'cpu' && jogo.vez !== cfg.humano) {
      est.pensando = true;
      atualizarStatus();
      atualizarBotoes();
      /* deixa o navegador desenhar o lance humano antes de ocupar a CPU */
      setTimeout(jogarComputador, 60);
    }
  }

  function jogarComputador() {
    IA.pensar(jogo, cfg.nivel, function (lance) {
      est.pensando = false;
      if (!lance) { est.fim = jogo.situacao(); atualizarTudo(false); return; }
      est.ultimoDe = E.lanceDe(lance);
      est.ultimoPara = E.lancePara(lance);
      jogo.jogar(lance);
      est.fim = jogo.situacao();
      atualizarTudo(false);
      salvar();
    });
  }

  /* ------------------------------------------------------------ modais */

  function abrirModal(html) {
    var m = $('modal'), veu = $('veu');
    m.innerHTML = html;
    veu.style.display = 'block';
    veu.style.height = Math.max(dim.tela.h, $('app').offsetHeight) + 'px';
    m.style.display = 'block';
    var larg = Math.min(dim.tela.w - 40, 380);
    m.style.width = larg + 'px';
    m.style.left = Math.max(6, Math.floor((dim.tela.w - larg - 26) / 2)) + 'px';
    m.style.top = '20px';
  }

  function fecharModal() {
    $('modal').style.display = 'none';
    $('veu').style.display = 'none';
    est.promo = null;
    atualizarTudo(true);
  }

  function abrirPromocao(opcoes) {
    est.promo = opcoes;
    var nomes = { 5: 'Dama', 4: 'Torre', 3: 'Bispo', 2: 'Cavalo' };
    var ordem = [5, 4, 3, 2], html = '<h2>Promover o peao</h2><div class="linha">';
    for (var i = 0; i < ordem.length; i++) {
      var t = ordem[i];
      html += '<div class="opt" id="promo' + t + '" style="font-size:17px;padding:12px 14px">' +
        nomes[t] + '</div>';
    }
    html += '</div>';
    abrirModal(html);
    for (i = 0; i < ordem.length; i++) {
      (function (tipo) {
        ligarToque($('promo' + tipo), function () {
          var lista = est.promo;
          fecharModal();
          for (var k = 0; k < lista.length; k++) {
            if (E.lancePromo(lista[k]) === tipo) { aplicar(lista[k]); return; }
          }
        });
      })(ordem[i]);
    }
  }

  function opcao(id, rotulo, ligado) {
    return '<div class="opt' + (ligado ? ' on' : '') + '" id="' + id + '">' + rotulo + '</div>';
  }

  function abrirMenu() {
    var h = '<h2>Opcoes</h2>';
    h += '<div class="linha"><div class="rot">Adversario</div>' +
      opcao('mCpu', 'Computador', cfg.modo === 'cpu') +
      opcao('mDois', 'Dois jogadores', cfg.modo === 'dois') + '</div>';
    h += '<div class="linha"><div class="rot">Nivel do computador</div>' +
      opcao('n1', 'Facil', cfg.nivel === 1) + opcao('n2', 'Medio', cfg.nivel === 2) +
      opcao('n3', 'Dificil', cfg.nivel === 3) + opcao('n4', 'Mestre', cfg.nivel === 4) + '</div>';
    h += '<div class="linha"><div class="rot">Voce joga de</div>' +
      opcao('cB', 'Brancas', cfg.humano === E.BRANCA) +
      opcao('cP', 'Pretas', cfg.humano === E.PRETA) + '</div>';
    h += '<div class="linha"><div class="rot">Desenho das pecas</div>' +
      opcao('eSim', 'Simbolos', usaSimbolos) + opcao('eLet', 'Letras', !usaSimbolos) + '</div>';
    h += '<div class="linha"><div class="rot">Ajudas</div>' +
      opcao('aDicas', 'Marcar lances', cfg.dicas) +
      opcao('aCoord', 'Coordenadas', cfg.coords) + '</div>';
    h += '<div class="linha"><div class="rot">Tela</div>' +
      opcao('aLimpar', 'Limpar fantasmas', false) + '</div>';
    h += '<div class="linha"><div class="rot">Posicao (FEN)</div>' +
      '<input id="fenCaixa" value="' + jogo.fen() + '" />' +
      '<div style="margin-top:6px">' + opcao('fCarregar', 'Carregar FEN', false) + '</div></div>';
    h += '<div class="linha" style="border-top:2px solid #000;padding-top:8px">' +
      '<div class="opt" id="fechar" style="font-size:16px;padding:11px 16px">Voltar ao jogo</div></div>';
    abrirModal(h);

    var acoes = {
      mCpu:  function () { cfg.modo = 'cpu'; reabrir(); verificarVez(); },
      mDois: function () { cfg.modo = 'dois'; reabrir(); },
      n1: function () { cfg.nivel = 1; reabrir(); },
      n2: function () { cfg.nivel = 2; reabrir(); },
      n3: function () { cfg.nivel = 3; reabrir(); },
      n4: function () { cfg.nivel = 4; reabrir(); },
      cB: function () { cfg.humano = E.BRANCA; est.girado = false; reabrir(); verificarVez(); },
      cP: function () { cfg.humano = E.PRETA; est.girado = true; reabrir(); verificarVez(); },
      eSim: function () { usaSimbolos = true; cfg.estilo = 'sim'; prepararHtml(); reabrir(); },
      eLet: function () { usaSimbolos = false; cfg.estilo = 'let'; prepararHtml(); reabrir(); },
      aDicas: function () { cfg.dicas = !cfg.dicas; reabrir(); },
      aCoord: function () { cfg.coords = !cfg.coords; reabrir(); },
      aLimpar: function () { fecharModal(); limparFantasmas(); },
      fCarregar: function () {
        var v = $('fenCaixa').value;
        try {
          var teste = new E.Jogo();
          teste.carregarFen(v);
          if (teste.reiSq[0] < 0 || teste.reiSq[1] < 0) throw 'sem rei';
          jogo.carregarFen(v);
          est.sel = -1; est.destinos = []; est.ultimoDe = -1; est.ultimoPara = -1;
          est.fim = jogo.situacao();
          fecharModal(); salvar(); verificarVez();
        } catch (e) {
          $('fenCaixa').value = 'FEN invalido - tente de novo';
        }
      },
      fechar: function () { fecharModal(); }
    };
    for (var id in acoes) {
      if (!acoes.hasOwnProperty(id)) continue;
      if ($(id)) (function (fn) { ligarToque($(id), function () { fn(); }); })(acoes[id]);
    }
    function reabrir() { salvarConfig(); fecharModal(); abrirMenu(); }
  }

  /* Truque de e-ink: piscar preto/branco força a tela a se limpar por
     inteiro e apaga o "fantasma" das pecas antigas. */
  function limparFantasmas() {
    var b = document.body;
    b.style.background = '#000';
    setTimeout(function () {
      b.style.background = '#fff';
      setTimeout(function () { atualizarTudo(true); }, 60);
    }, 180);
  }

  /* ------------------------------------------------------------- acoes */

  function novoJogo() {
    jogo.reiniciar();
    est.sel = -1; est.destinos = []; est.fim = null;
    est.ultimoDe = -1; est.ultimoPara = -1; est.pensando = false;
    est.girado = (cfg.modo === 'cpu' && cfg.humano === E.PRETA);
    atualizarTudo(true);
    salvar();
    verificarVez();
  }

  function desfazer() {
    if (est.pensando || !jogo.historico.length) return;
    jogo.desfazer();
    if (cfg.modo === 'cpu' && jogo.vez !== cfg.humano && jogo.historico.length) jogo.desfazer();
    est.sel = -1; est.destinos = []; est.fim = null;
    var h = jogo.historico;
    if (h.length) {
      est.ultimoDe = E.lanceDe(h[h.length - 1].m);
      est.ultimoPara = E.lancePara(h[h.length - 1].m);
    } else { est.ultimoDe = -1; est.ultimoPara = -1; }
    atualizarTudo(false);
    salvar();
  }

  function pedirDica() {
    if (est.pensando || est.fim) return;
    if (cfg.modo === 'cpu' && jogo.vez !== cfg.humano) return;
    est.pensando = true;
    atualizarStatus();
    setTimeout(function () {
      IA.dica(jogo, function (lance) {
        est.pensando = false;
        if (lance) {
          est.sel = E.lanceDe(lance);
          est.destinos = [lance];
          cfg.dicas = true;      /* a dica precisa ficar visivel */
        }
        atualizarTudo(false);
      });
    }, 40);
  }

  function girar() {
    est.girado = !est.girado;
    atualizarTudo(true);
  }

  function verificarVez() {
    est.fim = jogo.situacao();
    atualizarTudo(false);
    if (!est.fim && cfg.modo === 'cpu' && jogo.vez !== cfg.humano && !est.pensando) {
      est.pensando = true;
      atualizarStatus();
      setTimeout(jogarComputador, 60);
    }
  }

  /* ---------------------------------------------------- teclado (5-way) */

  function aoTeclar(ev) {
    ev = ev || window.event;
    var k = ev.keyCode;
    if ($('modal').style.display === 'block') {
      if (k === 27) fecharModal();
      return;
    }
    var lin = E.rankDe(est.cursor), col = E.fileDe(est.cursor), moveu = false;
    var dl = est.girado ? -1 : 1, dc = est.girado ? -1 : 1;
    if (k === 38) { lin -= dl; moveu = true; }        /* cima     */
    else if (k === 40) { lin += dl; moveu = true; }   /* baixo    */
    else if (k === 37) { col -= dc; moveu = true; }   /* esquerda */
    else if (k === 39) { col += dc; moveu = true; }   /* direita  */
    else if (k === 13 || k === 32) {                  /* enter/espaco */
      est.usaCursor = true;
      selecionarCasa(est.cursor);
      if (ev.preventDefault) ev.preventDefault();
      return false;
    }
    else if (k === 78) { novoJogo(); return; }        /* n */
    else if (k === 85) { desfazer(); return; }        /* u */
    else if (k === 72) { pedirDica(); return; }       /* h */
    else if (k === 70) { girar(); return; }           /* f */
    else if (k === 77) { abrirMenu(); return; }       /* m */

    if (moveu) {
      if (lin < 0) lin = 0; if (lin > 7) lin = 7;
      if (col < 0) col = 0; if (col > 7) col = 7;
      est.cursor = lin * 16 + col;
      est.usaCursor = true;
      pintarTudo(false);
      if (ev.preventDefault) ev.preventDefault();
      return false;
    }
  }

  /* ------------------------------------------------- salvar / restaurar */

  var CHAVE = 'xadrezKindle.v1';

  function salvarConfig() {
    try {
      localStorage.setItem(CHAVE + '.cfg', cfg.modo + ',' + cfg.nivel + ',' + cfg.humano + ',' +
        (usaSimbolos ? 1 : 0) + ',' + (cfg.dicas ? 1 : 0) + ',' + (cfg.coords ? 1 : 0));
    } catch (e) {}
  }

  function salvar() {
    try {
      var lances = [];
      for (var i = 0; i < jogo.historico.length; i++) lances.push(jogo.historico[i].m);
      localStorage.setItem(CHAVE, jogo.fenInicial + '|' + lances.join(','));
      salvarConfig();
    } catch (e) {}
  }

  function restaurar() {
    var dados = null, c = null;
    try {
      dados = localStorage.getItem(CHAVE);
      c = localStorage.getItem(CHAVE + '.cfg');
    } catch (e) { return false; }

    if (c) {
      var pc = c.split(',');
      cfg.modo = pc[0] === 'dois' ? 'dois' : 'cpu';
      cfg.nivel = parseInt(pc[1], 10) || 2;
      cfg.humano = parseInt(pc[2], 10) === 1 ? E.PRETA : E.BRANCA;
      if (pc[3] !== undefined) { usaSimbolos = pc[3] === '1'; cfg.estilo = usaSimbolos ? 'sim' : 'let'; }
      if (pc[4] !== undefined) cfg.dicas = pc[4] === '1';
      if (pc[5] !== undefined) cfg.coords = pc[5] === '1';
      est.girado = (cfg.modo === 'cpu' && cfg.humano === E.PRETA);
    }
    if (!dados) return false;

    var partes = dados.split('|');
    try {
      jogo.carregarFen(partes[0]);
      if (partes[1]) {
        var lances = partes[1].split(',');
        for (var i = 0; i < lances.length; i++) {
          var m = parseInt(lances[i], 10);
          if (!m) continue;
          var legais = jogo.gerarLegais(false), achou = false;
          for (var k = 0; k < legais.length; k++) if (legais[k] === m) achou = true;
          if (!achou) break;
          jogo.jogar(m);
          est.ultimoDe = E.lanceDe(m); est.ultimoPara = E.lancePara(m);
        }
      }
      return true;
    } catch (e) {
      jogo.reiniciar();
      return false;
    }
  }

  /* -------------------------------------------------------------- inicio */

  function iniciar() {
    usaSimbolos = temSimbolosDeXadrez();
    restaurar();
    if (cfg.estilo === 'sim') usaSimbolos = true;
    if (cfg.estilo === 'let') usaSimbolos = false;

    calcularLayout();
    aplicarLayout();
    construirTabuleiro();

    ligarToque($('bNovo'), function () { novoJogo(); });
    ligarToque($('bDesfazer'), function () { desfazer(); });
    ligarToque($('bDica'), function () { pedirDica(); });
    ligarToque($('bGirar'), function () { girar(); });
    ligarToque($('bMenu'), function () { abrirMenu(); });

    if (document.addEventListener) document.addEventListener('keydown', aoTeclar, false);
    else document.onkeydown = aoTeclar;

    /* rotacao de tela / mudanca de zoom */
    window.onresize = function () {
      var antes = dim.cel;
      calcularLayout();
      aplicarLayout();
      if (dim.cel !== antes) construirTabuleiro();
      atualizarTudo(true);
    };

    est.fim = jogo.situacao();
    atualizarTudo(true);
    verificarVez();
  }

  if (window.addEventListener) window.addEventListener('load', iniciar, false);
  else window.onload = iniciar;
})();
