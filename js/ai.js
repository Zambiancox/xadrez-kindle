/* =========================================================================
   ai.js - adversario do computador
   Negamax + poda alfa-beta + busca de quiescencia, com aprofundamento
   iterativo limitado por TEMPO (nao por profundidade): a CPU do Kindle e
   lenta e imprevisivel, entao a busca se ajusta sozinha ao aparelho.
   Cada profundidade roda em um tick de setTimeout separado para o
   navegador nao exibir o aviso de "script demorando muito".
   ========================================================================= */
var IA = (function () {
  'use strict';

  var E = Engine;
  var INF = 1000000, MATE = 900000;

  var VALOR = [0, 100, 320, 330, 500, 900, 20000];

  /* tabelas posicionais, vistas pelas brancas, linha 0 = 8a fileira */
  var PST_PEAO = [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0];
  var PST_CAVALO = [
   -50,-40,-30,-30,-30,-30,-40,-50,
   -40,-20,  0,  0,  0,  0,-20,-40,
   -30,  0, 10, 15, 15, 10,  0,-30,
   -30,  5, 15, 20, 20, 15,  5,-30,
   -30,  0, 15, 20, 20, 15,  0,-30,
   -30,  5, 10, 15, 15, 10,  5,-30,
   -40,-20,  0,  5,  5,  0,-20,-40,
   -50,-40,-30,-30,-30,-30,-40,-50];
  var PST_BISPO = [
   -20,-10,-10,-10,-10,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5, 10, 10,  5,  0,-10,
   -10,  5,  5, 10, 10,  5,  5,-10,
   -10,  0, 10, 10, 10, 10,  0,-10,
   -10, 10, 10, 10, 10, 10, 10,-10,
   -10,  5,  0,  0,  0,  0,  5,-10,
   -20,-10,-10,-10,-10,-10,-10,-20];
  var PST_TORRE = [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0];
  var PST_DAMA = [
   -20,-10,-10, -5, -5,-10,-10,-20,
   -10,  0,  0,  0,  0,  0,  0,-10,
   -10,  0,  5,  5,  5,  5,  0,-10,
    -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
   -10,  5,  5,  5,  5,  5,  0,-10,
   -10,  0,  5,  0,  0,  0,  0,-10,
   -20,-10,-10, -5, -5,-10,-10,-20];
  var PST_REI_MEIO = [
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -30,-40,-40,-50,-50,-40,-40,-30,
   -20,-30,-30,-40,-40,-30,-30,-20,
   -10,-20,-20,-20,-20,-20,-20,-10,
    20, 20,  0,  0,  0,  0, 20, 20,
    20, 30, 10,  0,  0, 10, 30, 20];
  var PST_REI_FIM = [
   -50,-40,-30,-20,-20,-30,-40,-50,
   -30,-20,-10,  0,  0,-10,-20,-30,
   -30,-10, 20, 30, 30, 20,-10,-30,
   -30,-10, 30, 40, 40, 30,-10,-30,
   -30,-10, 30, 40, 40, 30,-10,-30,
   -30,-10, 20, 30, 30, 20,-10,-30,
   -30,-30,  0,  0,  0,  0,-30,-30,
   -50,-30,-30,-30,-30,-30,-30,-50];

  var PST = [null, PST_PEAO, PST_CAVALO, PST_BISPO, PST_TORRE, PST_DAMA, null];

  /* -------------------------------------------------------- avaliacao */

  function avaliar(jogo) {
    var tab = jogo.tab;
    var pontos = [0, 0];
    var material = [0, 0];
    var bispos = [0, 0];
    var peoesCol = [[0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0]];
    var pecas = 0;
    var i, r, f, sq, p, cor, tipo;

    for (r = 0; r < 8; r++) {
      for (f = 0; f < 8; f++) {
        sq = r * 16 + f;
        p = tab[sq];
        if (!p) continue;
        cor = E.corDe(p); tipo = E.tipoDe(p);
        material[cor] += VALOR[tipo];
        if (tipo !== E.PEAO && tipo !== E.REI) pecas++;
        if (tipo === E.BISPO) bispos[cor]++;
        if (tipo === E.PEAO) peoesCol[cor][f]++;
        if (tipo !== E.REI) {
          var idx = (cor === E.BRANCA) ? (r * 8 + f) : ((7 - r) * 8 + f);
          pontos[cor] += PST[tipo][idx];
        }
      }
    }

    /* fase: com poucas pecas o rei deve marchar para o centro */
    var fimDeJogo = (pecas <= 6);
    for (cor = 0; cor < 2; cor++) {
      sq = jogo.reiSq[cor];
      if (sq >= 0) {
        r = sq >> 4; f = sq & 7;
        var ki = (cor === E.BRANCA) ? (r * 8 + f) : ((7 - r) * 8 + f);
        pontos[cor] += fimDeJogo ? PST_REI_FIM[ki] : PST_REI_MEIO[ki];
      }
      if (bispos[cor] >= 2) pontos[cor] += 30;              /* par de bispos */
      for (f = 0; f < 8; f++) {                             /* peoes */
        var n = peoesCol[cor][f];
        if (n > 1) pontos[cor] -= 18 * (n - 1);             /* dobrados */
        if (n > 0) {
          var esq = (f > 0) ? peoesCol[cor][f - 1] : 0;
          var dir = (f < 7) ? peoesCol[cor][f + 1] : 0;
          if (!esq && !dir) pontos[cor] -= 16;              /* isolado */
        }
      }
    }

    var total = (material[E.BRANCA] + pontos[E.BRANCA]) -
                (material[E.PRETA] + pontos[E.PRETA]);
    return (jogo.vez === E.BRANCA) ? total : -total;
  }

  /* ------------------------------------------------------- ordenacao */

  var killers = [];

  function pontuarLance(jogo, m, prof, melhorAnterior) {
    if (m === melhorAnterior) return 1000000;
    var para = E.lancePara(m);
    if (m & E.F_CAPTURA) {
      var vitima = jogo.tab[para];
      var vv = vitima ? VALOR[E.tipoDe(vitima)] : 100;      /* en passant */
      var agressor = VALOR[E.tipoDe(jogo.tab[E.lanceDe(m)])];
      return 100000 + vv * 10 - agressor;
    }
    if (E.lancePromo(m)) return 90000 + VALOR[E.lancePromo(m)];
    if (killers[prof] && killers[prof][0] === m) return 80000;
    if (killers[prof] && killers[prof][1] === m) return 79000;
    return 0;
  }

  function ordenar(jogo, lances, prof, melhorAnterior) {
    var i, n = lances.length, notas = new Array(n);
    for (i = 0; i < n; i++) notas[i] = pontuarLance(jogo, lances[i], prof, melhorAnterior);
    /* insercao: listas pequenas, evita alocar objetos para o sort */
    for (i = 1; i < n; i++) {
      var lm = lances[i], ln = notas[i], j = i - 1;
      while (j >= 0 && notas[j] < ln) {
        lances[j + 1] = lances[j]; notas[j + 1] = notas[j]; j--;
      }
      lances[j + 1] = lm; notas[j + 1] = ln;
    }
  }

  /* ----------------------------------------------------------- busca */

  function Busca(jogo, limiteMs) {
    this.jogo = jogo;
    this.fim = (new Date()).getTime() + limiteMs;
    this.nos = 0;
    this.estourou = false;
  }

  Busca.prototype.tempoAcabou = function () {
    if (this.estourou) return true;
    if ((this.nos & 1023) === 0 && (new Date()).getTime() > this.fim) this.estourou = true;
    return this.estourou;
  };

  Busca.prototype.quiescencia = function (alfa, beta) {
    this.nos++;
    if (this.tempoAcabou()) return alfa;

    var estatico = avaliar(this.jogo);
    if (estatico >= beta) return beta;
    if (estatico > alfa) alfa = estatico;

    var lances = this.jogo.gerarPseudo(true);
    ordenar(this.jogo, lances, 0, 0);
    for (var i = 0; i < lances.length; i++) {
      if (!this.jogo.executar(lances[i])) continue;
      var v = -this.quiescencia(-beta, -alfa);
      this.jogo.desfazerInterno();
      if (this.estourou) return alfa;
      if (v >= beta) return beta;
      if (v > alfa) alfa = v;
    }
    return alfa;
  };

  Busca.prototype.negamax = function (prof, alfa, beta, ply) {
    this.nos++;
    if (this.tempoAcabou()) return alfa;

    if (ply > 0 && this.jogo.meioLance >= 100) return 0;   /* regra dos 50 */
    if (prof <= 0) return this.quiescencia(alfa, beta);

    var emXeque = this.jogo.emXeque(this.jogo.vez);
    if (emXeque) prof++;                                    /* extensao de xeque */

    var lances = this.jogo.gerarPseudo(false);
    ordenar(this.jogo, lances, ply, 0);

    var legais = 0, melhor = alfa, i, v;
    for (i = 0; i < lances.length; i++) {
      if (!this.jogo.executar(lances[i])) continue;
      legais++;
      v = -this.negamax(prof - 1, -beta, -melhor, ply + 1);
      this.jogo.desfazerInterno();
      if (this.estourou) return melhor;
      if (v > melhor) {
        melhor = v;
        if (melhor >= beta) {
          if (!(lances[i] & E.F_CAPTURA)) {                 /* killer move */
            if (!killers[ply]) killers[ply] = [0, 0];
            if (killers[ply][0] !== lances[i]) {
              killers[ply][1] = killers[ply][0];
              killers[ply][0] = lances[i];
            }
          }
          return beta;
        }
      }
    }

    if (!legais) return emXeque ? (-MATE + ply) : 0;        /* mate ou afogamento */
    return melhor;
  };

  /* Busca na raiz, entregue em FATIAS.
     O navegador do Kindle reclama ("script demorando muito") quando o
     JavaScript segura a linha principal por muitos segundos. Entao a raiz
     analisa lances ate encher uma fatia de tempo curta, devolve o controle
     ao navegador com setTimeout e retoma de onde parou. */
  var FATIA_MS = 600;

  Busca.prototype.raizFatiada = function (prof, lances, melhorAnterior, aoFim) {
    ordenar(this.jogo, lances, 0, melhorAnterior);
    var self = this, i = 0, resultado = [], alfa = -INF;

    function fatia() {
      var limite = (new Date()).getTime() + FATIA_MS;
      while (i < lances.length) {
        if (!self.jogo.executar(lances[i])) { i++; continue; }
        var v = -self.negamax(prof - 1, -INF, -alfa, 1);
        self.jogo.desfazerInterno();
        if (self.estourou) { aoFim(null); return; }
        resultado.push({ m: lances[i], nota: v });
        if (v > alfa) alfa = v;
        i++;
        if ((new Date()).getTime() > limite) break;
      }
      if (i < lances.length) { setTimeout(fatia, 1); return; }
      resultado.sort(function (a, b) { return b.nota - a.nota; });
      aoFim(resultado);
    }
    fatia();
  };

  /* -------------------------------------------------------- niveis */

  var NIVEIS = {
    1: { profMax: 2, tempo: 400,  ruido: 90 },   /* Facil    */
    2: { profMax: 4, tempo: 1500, ruido: 12 },   /* Medio    */
    3: { profMax: 6, tempo: 4000, ruido: 0  },   /* Dificil  */
    4: { profMax: 8, tempo: 9000, ruido: 0  }    /* Mestre   */
  };

  /* Escolhe entre os lances quase-empatados, para o nivel facil nao
     repetir sempre a mesma partida (e errar de vez em quando). */
  function escolher(resultado, ruido) {
    if (!resultado || !resultado.length) return 0;
    if (!ruido) return resultado[0].m;
    var teto = resultado[0].nota - ruido, candidatos = [];
    for (var i = 0; i < resultado.length; i++) {
      if (resultado[i].nota >= teto) candidatos.push(resultado[i].m);
    }
    return candidatos[Math.floor(Math.random() * candidatos.length)];
  }

  /* API assincrona: nao trava a interface do Kindle.
     aoTerminar(lance, info) */
  function pensar(jogo, nivel, aoTerminar, aoProgredir) {
    var cfg = (typeof nivel === 'object' && nivel) ? nivel : (NIVEIS[nivel] || NIVEIS[2]);
    var lances = jogo.gerarLegais(false);

    if (!lances.length) { aoTerminar(0, null); return; }
    if (lances.length === 1) { aoTerminar(lances[0], { prof: 0, nos: 0 }); return; }

    killers = [];
    var busca = new Busca(jogo, cfg.tempo);
    var melhorLista = null, prof = 1, inicio = (new Date()).getTime();

    function passo() {
      busca.raizFatiada(prof, lances, melhorLista ? melhorLista[0].m : 0, function (r) {
        if (r) {
          melhorLista = r;
          if (aoProgredir) aoProgredir(prof, r[0].nota);
        }
        var achouMate = melhorLista && Math.abs(melhorLista[0].nota) > MATE - 100;
        if (busca.estourou || prof >= cfg.profMax || achouMate) {
          aoTerminar(escolher(melhorLista, cfg.ruido), {
            prof: prof, nos: busca.nos, ms: (new Date()).getTime() - inicio,
            nota: melhorLista ? melhorLista[0].nota : 0
          });
          return;
        }
        prof++;
        setTimeout(passo, 1);   /* devolve o controle ao navegador */
      });
    }
    setTimeout(passo, 1);
  }

  /* dica rapida para o jogador humano: mesma busca, orcamento curto */
  function dica(jogo, aoTerminar) {
    pensar(jogo, { profMax: 4, tempo: 1500, ruido: 0 }, function (m) { aoTerminar(m); });
  }

  return { pensar: pensar, dica: dica, avaliar: avaliar, VALOR: VALOR, NIVEIS: NIVEIS };
})();
