/* =========================================================================
   engine.js - motor de xadrez completo (regras oficiais)
   Escrito em ES5 puro, sem dependencias, pensado para navegadores antigos
   (Kindle usa um WebKit de ~2012: nada de let/const/arrow/Map/typed arrays).

   Representacao 0x88: tabuleiro de 128 casas, a8 = 0 ... h1 = 119.
   Uma casa e valida quando (sq & 0x88) === 0.
   Peca = tipo (1..6) + 8 para as pretas.  tipo = p & 7 | cor = p >> 3
   ========================================================================= */
var Engine = (function () {
  'use strict';

  var PEAO = 1, CAVALO = 2, BISPO = 3, TORRE = 4, DAMA = 5, REI = 6;
  var BRANCA = 0, PRETA = 1;
  var VAZIO = 0;

  var OFF_CAVALO = [-33, -31, -18, -14, 14, 18, 31, 33];
  var OFF_BISPO  = [-17, -15, 15, 17];
  var OFF_TORRE  = [-16, -1, 1, 16];
  var OFF_REI    = [-17, -16, -15, -1, 1, 15, 16, 17];

  /* bits do lance: from(0-7) to(8-15) promo(16-18) flags(19-23) */
  var F_CAPTURA = 1 << 19;
  var F_EP      = 1 << 20;
  var F_ROQUE_R = 1 << 21;   /* roque curto (lado do rei)  */
  var F_ROQUE_D = 1 << 22;   /* roque longo (lado da dama) */
  var F_DUPLO   = 1 << 23;

  /* direitos de roque */
  var C_BR = 1, C_BD = 2, C_PR = 4, C_PD = 8;

  function criarLance(de, para, promo, flags) {
    return de | (para << 8) | ((promo || 0) << 16) | (flags || 0);
  }
  function lanceDe(m)    { return m & 0xff; }
  function lancePara(m)  { return (m >> 8) & 0xff; }
  function lancePromo(m) { return (m >> 16) & 7; }

  function tipoDe(p)  { return p & 7; }
  function corDe(p)   { return p >> 3; }
  function fazPeca(tipo, cor) { return tipo + (cor << 3); }

  function fileDe(sq) { return sq & 15; }
  function rankDe(sq) { return sq >> 4; }          /* 0 = 8a fileira */
  function foraDoTabuleiro(sq) { return (sq & 0x88) !== 0; }

  function sqParaAlg(sq) {
    return String.fromCharCode(97 + fileDe(sq)) + (8 - rankDe(sq));
  }
  function algParaSq(s) {
    var f = s.charCodeAt(0) - 97;
    var r = 8 - parseInt(s.charAt(1), 10);
    return r * 16 + f;
  }

  /* ---------------------------------------------------------------- Jogo */

  function Jogo() {
    this.tab = new Array(128);
    this.girar = false;
    this.reiniciar();
  }

  Jogo.prototype.reiniciar = function () {
    this.carregarFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  };

  Jogo.prototype.limpar = function () {
    for (var i = 0; i < 128; i++) this.tab[i] = VAZIO;
    this.vez = BRANCA;
    this.roque = 0;
    this.ep = -1;                /* casa de en passant ou -1 */
    this.meioLance = 0;          /* regra dos 50 lances */
    this.lanceCheio = 1;
    this.reiSq = [-1, -1];
    this.pilha = [];             /* undo */
    this.historico = [];         /* {san, lance, fenAntes} */
    this.posicoes = {};          /* repeticao tripla */
  };

  var LETRA_FEN = { p: PEAO, n: CAVALO, b: BISPO, r: TORRE, q: DAMA, k: REI };
  var FEN_LETRA = { 1: 'p', 2: 'n', 3: 'b', 4: 'r', 5: 'q', 6: 'k' };

  Jogo.prototype.carregarFen = function (fen) {
    this.limpar();
    var partes = fen.split(/\s+/);
    var linhas = partes[0].split('/');
    for (var r = 0; r < 8; r++) {
      var f = 0, linha = linhas[r];
      for (var i = 0; i < linha.length; i++) {
        var c = linha.charAt(i);
        if (c >= '1' && c <= '8') {
          f += parseInt(c, 10);
        } else {
          var cor = (c === c.toUpperCase()) ? BRANCA : PRETA;
          var tipo = LETRA_FEN[c.toLowerCase()];
          var sq = r * 16 + f;
          this.tab[sq] = fazPeca(tipo, cor);
          if (tipo === REI) this.reiSq[cor] = sq;
          f++;
        }
      }
    }
    this.vez = (partes[1] === 'b') ? PRETA : BRANCA;
    var roque = partes[2] || '-';
    if (roque.indexOf('K') >= 0) this.roque |= C_BR;
    if (roque.indexOf('Q') >= 0) this.roque |= C_BD;
    if (roque.indexOf('k') >= 0) this.roque |= C_PR;
    if (roque.indexOf('q') >= 0) this.roque |= C_PD;
    this.ep = (partes[3] && partes[3] !== '-') ? algParaSq(partes[3]) : -1;
    this.meioLance = partes[4] ? parseInt(partes[4], 10) : 0;
    this.lanceCheio = partes[5] ? parseInt(partes[5], 10) : 1;
    this.fenInicial = fen;
    this.contarPosicao(1);
    return true;
  };

  Jogo.prototype.fen = function () {
    var s = '', vazias, sq, p;
    for (var r = 0; r < 8; r++) {
      vazias = 0;
      for (var f = 0; f < 8; f++) {
        sq = r * 16 + f;
        p = this.tab[sq];
        if (p === VAZIO) { vazias++; continue; }
        if (vazias) { s += vazias; vazias = 0; }
        var letra = FEN_LETRA[tipoDe(p)];
        s += (corDe(p) === BRANCA) ? letra.toUpperCase() : letra;
      }
      if (vazias) s += vazias;
      if (r < 7) s += '/';
    }
    var roque = '';
    if (this.roque & C_BR) roque += 'K';
    if (this.roque & C_BD) roque += 'Q';
    if (this.roque & C_PR) roque += 'k';
    if (this.roque & C_PD) roque += 'q';
    if (!roque) roque = '-';
    return s + ' ' + (this.vez === BRANCA ? 'w' : 'b') + ' ' + roque + ' ' +
      (this.ep >= 0 ? sqParaAlg(this.ep) : '-') + ' ' +
      this.meioLance + ' ' + this.lanceCheio;
  };

  /* chave de posicao para repeticao tripla (sem contadores) */
  Jogo.prototype.chave = function () {
    var f = this.fen().split(' ');
    return f[0] + ' ' + f[1] + ' ' + f[2] + ' ' + f[3];
  };
  Jogo.prototype.contarPosicao = function (delta) {
    var k = this.chave();
    var n = (this.posicoes[k] || 0) + delta;
    if (n <= 0) delete this.posicoes[k]; else this.posicoes[k] = n;
  };

  /* --------------------------------------------------------- ataques */

  /* A casa sq esta atacada por alguma peca da cor `cor`? */
  Jogo.prototype.atacada = function (sq, cor) {
    var i, alvo, p, dir, t;

    /* peoes: um peao branco em sq+15/sq+17 ataca sq */
    var dirPeao = (cor === BRANCA) ? 16 : -16;
    var e = sq + dirPeao - 1, d = sq + dirPeao + 1;
    if (!foraDoTabuleiro(e)) {
      p = this.tab[e];
      if (p && corDe(p) === cor && tipoDe(p) === PEAO) return true;
    }
    if (!foraDoTabuleiro(d)) {
      p = this.tab[d];
      if (p && corDe(p) === cor && tipoDe(p) === PEAO) return true;
    }

    for (i = 0; i < 8; i++) {                       /* cavalos */
      alvo = sq + OFF_CAVALO[i];
      if (foraDoTabuleiro(alvo)) continue;
      p = this.tab[alvo];
      if (p && corDe(p) === cor && tipoDe(p) === CAVALO) return true;
    }
    for (i = 0; i < 8; i++) {                       /* rei */
      alvo = sq + OFF_REI[i];
      if (foraDoTabuleiro(alvo)) continue;
      p = this.tab[alvo];
      if (p && corDe(p) === cor && tipoDe(p) === REI) return true;
    }
    for (i = 0; i < 4; i++) {                       /* bispo / dama */
      dir = OFF_BISPO[i]; alvo = sq + dir;
      while (!foraDoTabuleiro(alvo)) {
        p = this.tab[alvo];
        if (p) {
          if (corDe(p) === cor) { t = tipoDe(p); if (t === BISPO || t === DAMA) return true; }
          break;
        }
        alvo += dir;
      }
    }
    for (i = 0; i < 4; i++) {                       /* torre / dama */
      dir = OFF_TORRE[i]; alvo = sq + dir;
      while (!foraDoTabuleiro(alvo)) {
        p = this.tab[alvo];
        if (p) {
          if (corDe(p) === cor) { t = tipoDe(p); if (t === TORRE || t === DAMA) return true; }
          break;
        }
        alvo += dir;
      }
    }
    return false;
  };

  Jogo.prototype.emXeque = function (cor) {
    if (cor === undefined) cor = this.vez;
    var rs = this.reiSq[cor];
    if (rs < 0) return false;
    return this.atacada(rs, cor ^ 1);
  };

  /* ------------------------------------------------------- geracao */

  /* gera pseudo-legais; se soCapturas, apenas capturas/promocoes */
  Jogo.prototype.gerarPseudo = function (soCapturas) {
    var lances = [];
    var cor = this.vez, adv = cor ^ 1;
    var sq, p, tipo, i, dir, alvo, alvoP;

    for (var r = 0; r < 8; r++) {
      for (var f = 0; f < 8; f++) {
        sq = r * 16 + f;
        p = this.tab[sq];
        if (!p || corDe(p) !== cor) continue;
        tipo = tipoDe(p);

        if (tipo === PEAO) {
          var frente = (cor === BRANCA) ? -16 : 16;
          var rankInicial = (cor === BRANCA) ? 6 : 1;
          var rankPromo = (cor === BRANCA) ? 0 : 7;

          alvo = sq + frente;
          if (!foraDoTabuleiro(alvo) && !this.tab[alvo]) {
            if (rankDe(alvo) === rankPromo) {
              lances.push(criarLance(sq, alvo, DAMA, 0));
              if (!soCapturas) {
                lances.push(criarLance(sq, alvo, TORRE, 0));
                lances.push(criarLance(sq, alvo, BISPO, 0));
                lances.push(criarLance(sq, alvo, CAVALO, 0));
              }
            } else if (!soCapturas) {
              lances.push(criarLance(sq, alvo, 0, 0));
              var duplo = sq + 2 * frente;
              if (rankDe(sq) === rankInicial && !this.tab[duplo]) {
                lances.push(criarLance(sq, duplo, 0, F_DUPLO));
              }
            }
          }
          for (i = -1; i <= 1; i += 2) {
            alvo = sq + frente + i;
            if (foraDoTabuleiro(alvo)) continue;
            alvoP = this.tab[alvo];
            if (alvoP && corDe(alvoP) === adv) {
              if (rankDe(alvo) === rankPromo) {
                lances.push(criarLance(sq, alvo, DAMA, F_CAPTURA));
                if (!soCapturas) {
                  lances.push(criarLance(sq, alvo, TORRE, F_CAPTURA));
                  lances.push(criarLance(sq, alvo, BISPO, F_CAPTURA));
                  lances.push(criarLance(sq, alvo, CAVALO, F_CAPTURA));
                }
              } else {
                lances.push(criarLance(sq, alvo, 0, F_CAPTURA));
              }
            } else if (!alvoP && alvo === this.ep) {
              lances.push(criarLance(sq, alvo, 0, F_CAPTURA | F_EP));
            }
          }
          continue;
        }

        if (tipo === CAVALO || tipo === REI) {
          var offs = (tipo === CAVALO) ? OFF_CAVALO : OFF_REI;
          for (i = 0; i < 8; i++) {
            alvo = sq + offs[i];
            if (foraDoTabuleiro(alvo)) continue;
            alvoP = this.tab[alvo];
            if (!alvoP) {
              if (!soCapturas) lances.push(criarLance(sq, alvo, 0, 0));
            } else if (corDe(alvoP) === adv) {
              lances.push(criarLance(sq, alvo, 0, F_CAPTURA));
            }
          }
          continue;
        }

        /* deslizantes */
        var dirs = (tipo === BISPO) ? OFF_BISPO : (tipo === TORRE) ? OFF_TORRE : OFF_REI;
        var ndirs = (tipo === DAMA) ? 8 : 4;
        for (i = 0; i < ndirs; i++) {
          dir = dirs[i]; alvo = sq + dir;
          while (!foraDoTabuleiro(alvo)) {
            alvoP = this.tab[alvo];
            if (!alvoP) {
              if (!soCapturas) lances.push(criarLance(sq, alvo, 0, 0));
            } else {
              if (corDe(alvoP) === adv) lances.push(criarLance(sq, alvo, 0, F_CAPTURA));
              break;
            }
            alvo += dir;
          }
        }
      }
    }

    /* roques */
    if (!soCapturas) {
      var base = (cor === BRANCA) ? 112 : 0;
      var kSq = base + 4;
      if (this.tab[kSq] === fazPeca(REI, cor) && !this.atacada(kSq, adv)) {
        var podeR = (cor === BRANCA) ? (this.roque & C_BR) : (this.roque & C_PR);
        var podeD = (cor === BRANCA) ? (this.roque & C_BD) : (this.roque & C_PD);
        if (podeR && !this.tab[kSq + 1] && !this.tab[kSq + 2] &&
            this.tab[base + 7] === fazPeca(TORRE, cor) &&
            !this.atacada(kSq + 1, adv) && !this.atacada(kSq + 2, adv)) {
          lances.push(criarLance(kSq, kSq + 2, 0, F_ROQUE_R));
        }
        if (podeD && !this.tab[kSq - 1] && !this.tab[kSq - 2] && !this.tab[kSq - 3] &&
            this.tab[base] === fazPeca(TORRE, cor) &&
            !this.atacada(kSq - 1, adv) && !this.atacada(kSq - 2, adv)) {
          lances.push(criarLance(kSq, kSq - 2, 0, F_ROQUE_D));
        }
      }
    }
    return lances;
  };

  Jogo.prototype.gerarLegais = function (soCapturas) {
    var pseudo = this.gerarPseudo(soCapturas);
    var legais = [];
    for (var i = 0; i < pseudo.length; i++) {
      if (this.executar(pseudo[i])) {
        this.desfazerInterno();
        legais.push(pseudo[i]);
      }
    }
    return legais;
  };

  /* lances legais que partem de uma casa (para a interface) */
  Jogo.prototype.lancesDe = function (sq) {
    var todos = this.gerarLegais(false), saida = [];
    for (var i = 0; i < todos.length; i++) {
      if (lanceDe(todos[i]) === sq) saida.push(todos[i]);
    }
    return saida;
  };

  /* ------------------------------------------------- executar/desfazer */

  /* executa sem validar legalidade; devolve false (e ja desfaz nada) se
     o lance deixa o proprio rei em xeque -- nesse caso o chamador
     deve chamar desfazerInterno() apenas quando retornar true. */
  Jogo.prototype.executar = function (m) {
    var de = lanceDe(m), para = lancePara(m), promo = lancePromo(m);
    var p = this.tab[de], cor = corDe(p), adv = cor ^ 1;
    var capturada = this.tab[para];
    var epCapSq = -1;

    this.pilha.push({
      m: m, capturada: capturada, roque: this.roque, ep: this.ep,
      meio: this.meioLance, cheio: this.lanceCheio,
      reiB: this.reiSq[0], reiP: this.reiSq[1]
    });

    if (m & F_EP) {
      epCapSq = para + ((cor === BRANCA) ? 16 : -16);
      capturada = this.tab[epCapSq];
      this.pilha[this.pilha.length - 1].capturada = capturada;
      this.pilha[this.pilha.length - 1].epCapSq = epCapSq;
      this.tab[epCapSq] = VAZIO;
    }

    this.tab[para] = promo ? fazPeca(promo, cor) : p;
    this.tab[de] = VAZIO;

    if (tipoDe(p) === REI) {
      this.reiSq[cor] = para;
      if (m & F_ROQUE_R) { this.tab[para - 1] = this.tab[para + 1]; this.tab[para + 1] = VAZIO; }
      if (m & F_ROQUE_D) { this.tab[para + 1] = this.tab[para - 2]; this.tab[para - 2] = VAZIO; }
      this.roque &= (cor === BRANCA) ? ~(C_BR | C_BD) : ~(C_PR | C_PD);
    }

    /* torre saiu ou foi capturada -> perde direito */
    if (de === 112 || para === 112) this.roque &= ~C_BD;
    if (de === 119 || para === 119) this.roque &= ~C_BR;
    if (de === 0   || para === 0)   this.roque &= ~C_PD;
    if (de === 7   || para === 7)   this.roque &= ~C_PR;

    this.ep = (m & F_DUPLO) ? (de + ((cor === BRANCA) ? -16 : 16)) : -1;

    if (tipoDe(p) === PEAO || capturada) this.meioLance = 0; else this.meioLance++;
    if (cor === PRETA) this.lanceCheio++;
    this.vez = adv;

    if (this.atacada(this.reiSq[cor], adv)) {   /* ilegal */
      this.desfazerInterno();
      return false;
    }
    return true;
  };

  Jogo.prototype.desfazerInterno = function () {
    var u = this.pilha.pop();
    if (!u) return null;
    var m = u.m, de = lanceDe(m), para = lancePara(m);
    var p = this.tab[para], cor = corDe(p);

    this.tab[de] = lancePromo(m) ? fazPeca(PEAO, cor) : p;
    this.tab[para] = VAZIO;

    if (m & F_EP) {
      this.tab[u.epCapSq] = u.capturada;
    } else if (u.capturada) {
      this.tab[para] = u.capturada;
    }

    if (m & F_ROQUE_R) { this.tab[para + 1] = this.tab[para - 1]; this.tab[para - 1] = VAZIO; }
    if (m & F_ROQUE_D) { this.tab[para - 2] = this.tab[para + 1]; this.tab[para + 1] = VAZIO; }

    this.roque = u.roque;
    this.ep = u.ep;
    this.meioLance = u.meio;
    this.lanceCheio = u.cheio;
    this.reiSq[0] = u.reiB;
    this.reiSq[1] = u.reiP;
    this.vez = cor;
    return m;
  };

  /* jogada "de verdade": registra SAN e historico */
  Jogo.prototype.jogar = function (m) {
    var san = this.san(m);
    var fenAntes = this.fen();
    if (!this.executar(m)) return null;
    this.contarPosicao(1);
    this.historico.push({ m: m, san: san, fenAntes: fenAntes });
    return san;
  };

  Jogo.prototype.desfazer = function () {
    if (!this.historico.length) return null;
    this.contarPosicao(-1);
    this.historico.pop();
    return this.desfazerInterno();
  };

  /* --------------------------------------------------------- notacao */

  /* notacao algebrica em portugues: R D T B C (peao sem letra) */
  var SAN_LETRA = { 2: 'C', 3: 'B', 4: 'T', 5: 'D', 6: 'R' };

  Jogo.prototype.san = function (m) {
    if (m & F_ROQUE_R) return this.sufixo(m, 'O-O');
    if (m & F_ROQUE_D) return this.sufixo(m, 'O-O-O');

    var de = lanceDe(m), para = lancePara(m);
    var p = this.tab[de], tipo = tipoDe(p);
    var captura = (m & F_CAPTURA) !== 0;
    var s;

    if (tipo === PEAO) {
      s = captura ? (String.fromCharCode(97 + fileDe(de)) + 'x') : '';
      s += sqParaAlg(para);
      if (lancePromo(m)) s += '=' + SAN_LETRA[lancePromo(m)];
      return this.sufixo(m, s);
    }

    /* desambiguacao */
    var iguais = [], todos = this.gerarLegais(false), i, o;
    for (i = 0; i < todos.length; i++) {
      o = todos[i];
      if (o !== m && lancePara(o) === para && this.tab[lanceDe(o)] === p) iguais.push(o);
    }
    var desamb = '';
    if (iguais.length) {
      var mesmaFile = false, mesmaRank = false;
      for (i = 0; i < iguais.length; i++) {
        if (fileDe(lanceDe(iguais[i])) === fileDe(de)) mesmaFile = true;
        if (rankDe(lanceDe(iguais[i])) === rankDe(de)) mesmaRank = true;
      }
      if (!mesmaFile) desamb = String.fromCharCode(97 + fileDe(de));
      else if (!mesmaRank) desamb = '' + (8 - rankDe(de));
      else desamb = sqParaAlg(de);
    }
    s = SAN_LETRA[tipo] + desamb + (captura ? 'x' : '') + sqParaAlg(para);
    return this.sufixo(m, s);
  };

  Jogo.prototype.sufixo = function (m, s) {
    if (!this.executar(m)) return s;
    var xeque = this.emXeque(this.vez);
    var semLances = this.gerarLegais(false).length === 0;
    this.desfazerInterno();
    if (xeque) return s + (semLances ? '#' : '+');
    return s;
  };

  /* ------------------------------------------------------- fim de jogo */

  /* devolve null (jogo em andamento) ou {tipo, texto} */
  Jogo.prototype.situacao = function () {
    var legais = this.gerarLegais(false);
    if (!legais.length) {
      if (this.emXeque(this.vez)) {
        return { tipo: 'mate', vencedor: this.vez ^ 1,
                 texto: 'Xeque-mate! ' + (this.vez === BRANCA ? 'Pretas' : 'Brancas') + ' vencem.' };
      }
      return { tipo: 'afogamento', texto: 'Empate por afogamento.' };
    }
    if (this.meioLance >= 100) return { tipo: 'regra50', texto: 'Empate pela regra dos 50 lances.' };
    if (this.posicoes[this.chave()] >= 3) return { tipo: 'repeticao', texto: 'Empate por repeticao tripla.' };
    if (this.materialInsuficiente()) return { tipo: 'material', texto: 'Empate por material insuficiente.' };
    return null;
  };

  Jogo.prototype.materialInsuficiente = function () {
    var pecas = [], bispos = [];
    for (var r = 0; r < 8; r++) {
      for (var f = 0; f < 8; f++) {
        var sq = r * 16 + f, p = this.tab[sq];
        if (!p) continue;
        var t = tipoDe(p);
        if (t === PEAO || t === TORRE || t === DAMA) return false;
        if (t !== REI) {
          pecas.push(t);
          if (t === BISPO) bispos.push((r + f) & 1);
        }
      }
    }
    if (pecas.length === 0) return true;                   /* R vs R */
    if (pecas.length === 1) return true;                   /* R+B ou R+C */
    if (pecas.length === 2 && bispos.length === 2 && bispos[0] === bispos[1]) return true;
    return false;
  };

  /* ------------------------------------------------------------ perft */

  Jogo.prototype.perft = function (prof) {
    if (prof === 0) return 1;
    var lances = this.gerarPseudo(false), total = 0;
    for (var i = 0; i < lances.length; i++) {
      if (this.executar(lances[i])) {
        total += this.perft(prof - 1);
        this.desfazerInterno();
      }
    }
    return total;
  };

  return {
    Jogo: Jogo,
    PEAO: PEAO, CAVALO: CAVALO, BISPO: BISPO, TORRE: TORRE, DAMA: DAMA, REI: REI,
    BRANCA: BRANCA, PRETA: PRETA, VAZIO: VAZIO,
    F_CAPTURA: F_CAPTURA, F_EP: F_EP, F_ROQUE_R: F_ROQUE_R, F_ROQUE_D: F_ROQUE_D, F_DUPLO: F_DUPLO,
    criarLance: criarLance, lanceDe: lanceDe, lancePara: lancePara, lancePromo: lancePromo,
    tipoDe: tipoDe, corDe: corDe, fazPeca: fazPeca,
    fileDe: fileDe, rankDe: rankDe, foraDoTabuleiro: foraDoTabuleiro,
    sqParaAlg: sqParaAlg, algParaSq: algParaSq
  };
})();
