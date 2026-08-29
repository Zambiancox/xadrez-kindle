/* Testes do motor - rodam so com node, sem dependencias:
     node testes/motor.js
   1) perft: conta as folhas da arvore de lances em posicoes padrao e
      compara com os numeros publicados (pega roque, en passant,
      promocao e cravada de uma vez so);
   2) taticas simples: a IA precisa achar mate em 1 e capturas obvias;
   3) partida da IA contra ela mesma, validando cada lance. */
var fs = require('fs');
var path = require('path');
var raiz = path.join(__dirname, '..');
eval(fs.readFileSync(path.join(raiz, 'js/engine.js'), 'utf8'));
eval(fs.readFileSync(path.join(raiz, 'js/ai.js'), 'utf8'));

var falhas = 0;
function conferir(ok, msg) {
  if (!ok) falhas++;
  console.log((ok ? '  ok  ' : 'FALHA ') + msg);
}

/* ---------------------------------------------------------------- perft */
console.log('perft (contagem de lances)');
var POSICOES = [
  ['inicial',  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902, 197281]],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['posicao 3','8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['posicao 4','r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['posicao 5','rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
  ['posicao 6','r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079]]
];
POSICOES.forEach(function (caso) {
  var j = new Engine.Jogo();
  j.carregarFen(caso[1]);
  caso[2].forEach(function (esperado, i) {
    var r = j.perft(i + 1);
    conferir(r === esperado, caso[0] + ' profundidade ' + (i + 1) + ': ' + r + ' (esperado ' + esperado + ')');
  });
});

/* ------------------------------------------------------------- taticas */
var TATICAS = [
  ['mate em 1 na coluna', '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', 'Ta8#'],
  ['mate do pastor',      'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4', 'Dxf7#'],
  ['pegar a dama de graca','rnb1kbnr/pppp1ppp/8/4p3/6q1/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 3', 'fxg4'],
  ['fugir do mate',       '5rk1/5ppp/8/8/8/8/8/R5K1 b - - 0 1', null]
];
console.log('\ntaticas (a IA precisa achar o lance certo)');
var iTatica = 0;
(function proximaTatica() {
  if (iTatica >= TATICAS.length) { partidaCompleta(); return; }
  var caso = TATICAS[iTatica++];
  var j = new Engine.Jogo();
  j.carregarFen(caso[1]);
  IA.pensar(j, 3, function (lance, info) {
    var san = j.san(lance);
    if (caso[2] === null) {
      conferir(!!lance, caso[0] + ': devolveu um lance legal (' + san + ')');
    } else {
      conferir(san.indexOf(caso[2]) === 0,
        caso[0] + ': jogou ' + san + ' (esperado ' + caso[2] + ') prof=' + info.prof + ' ' + info.ms + 'ms');
    }
    proximaTatica();
  });
})();

/* ------------------------------------------------ partida da IA sozinha */
function partidaCompleta() {
  console.log('\npartida IA x IA (validando cada lance)');
  var j = new Engine.Jogo(), n = 0, problemas = 0;
  (function passo() {
    var sit = j.situacao();
    if (sit || n >= 60) {
      conferir(problemas === 0, 'nenhum lance ilegal em ' + n + ' lances');
      conferir(j.pilha.length === j.historico.length, 'pilha de desfazer coerente');
      /* desfazer tudo tem que voltar exatamente a posicao inicial */
      while (j.historico.length) j.desfazer();
      conferir(j.fen() === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        'desfazer tudo volta a posicao inicial');
      console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTODOS OS TESTES PASSARAM');
      process.exit(falhas ? 1 : 0);
    }
    IA.pensar(j, 1, function (m) {
      var legais = j.gerarLegais(false), ok = false;
      for (var k = 0; k < legais.length; k++) if (legais[k] === m) ok = true;
      if (!ok) { problemas++; console.log('  lance ilegal devolvido pela IA!'); }
      j.jogar(m);
      n++;
      passo();
    });
  })();
}
