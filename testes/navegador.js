/* Testes de interface em um navegador de verdade (Chromium via Playwright).
   Precisa do playwright instalado:  npm i playwright
   Uso:  node testes/navegador.js            (testa index.html)
         node testes/navegador.js dist       (testa o arquivo unico gerado)

   Cobre o caminho que o dedo do jogador percorre: tocar, promover, rocar,
   capturar en passant, terminar a partida, e caber na tela sem rolagem
   nos tamanhos de tela dos Kindles. */
var path = require('path');
var raiz = path.join(__dirname, '..');
var alvo = (process.argv[2] === 'dist')
  ? path.join(raiz, 'dist/xadrez-kindle.html')
  : path.join(raiz, 'index.html');
var URL = 'file://' + alvo;

var chromium;
try {
  chromium = require('playwright').chromium;
} catch (e) {
  console.log('playwright nao instalado. rode: npm i playwright');
  process.exit(0);
}

var TELAS = [
  ['Kindle basico 600x800', 600, 800],
  ['Paperwhite 758x1024', 758, 1024],
  ['Scribe 860x1150', 860, 1150],
  ['tela pequena 480x640', 480, 640],
  ['paisagem 1024x758', 1024, 758]
];

var falhas = 0;
function conferir(ok, msg) {
  if (!ok) falhas++;
  console.log((ok ? '  ok  ' : 'FALHA ') + msg);
}

(async function () {
  console.log('testando ' + path.relative(raiz, alvo) + '\n');
  /* usa um Chromium ja presente na maquina quando existir (o ambiente de
     desenvolvimento traz um em /opt/pw-browsers); senao deixa o proprio
     playwright escolher o que ele instalou, que e o caso no CI */
  var fs = require('fs');
  var executavel = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
  var opcoes = fs.existsSync(executavel) ? { executablePath: executavel } : {};
  var navegador = await chromium.launch(opcoes);
  var ctx = await navegador.newContext({ viewport: { width: 600, height: 800 }, hasTouch: true });
  var pagina = await ctx.newPage();
  var erros = [];
  pagina.on('pageerror', function (e) { erros.push(e.message); });
  await pagina.goto(URL);
  await pagina.waitForTimeout(300);

  var casa = function (alg) {
    var f = alg.charCodeAt(0) - 97, r = 8 - parseInt(alg.charAt(1), 10);
    return r * 8 + f;
  };
  async function tocar(alg) {
    await pagina.locator('#c' + casa(alg)).click();
    await pagina.waitForTimeout(90);
  }
  async function carregar(fen) {
    await pagina.locator('#bMenu').click(); await pagina.waitForTimeout(150);
    await pagina.locator('#fenCaixa').fill(fen);
    await pagina.locator('#fCarregar').click(); await pagina.waitForTimeout(250);
  }
  var lances = function () { return pagina.locator('#lances').innerText(); };
  var status = function () { return pagina.locator('#status').innerText(); };

  /* dois jogadores: o teste controla os dois lados */
  await pagina.locator('#bMenu').click(); await pagina.waitForTimeout(150);
  await pagina.locator('#mDois').click(); await pagina.waitForTimeout(200);
  await pagina.locator('#fechar').click(); await pagina.waitForTimeout(150);

  await carregar('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  await tocar('a7'); await tocar('a8');
  conferir(await pagina.locator('#modal').isVisible(), 'dialogo de promocao aparece');
  await pagina.locator('#promo4').click(); await pagina.waitForTimeout(200);
  conferir((await lances()).indexOf('a8=T') >= 0, 'promocao escolhida vira torre');

  await carregar('4k3/8/8/8/8/8/8/4K2R w K - 0 1');
  await tocar('e1'); await tocar('g1');
  conferir((await lances()).indexOf('O-O') >= 0, 'roque curto');

  await carregar('4k3/8/8/8/4pP2/8/8/4K3 b - f3 0 1');
  await tocar('e4'); await tocar('f3');
  conferir((await lances()).indexOf('exf3') >= 0, 'captura en passant');

  await carregar('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1');
  await tocar('a1'); await tocar('a8');
  conferir((await status()).indexOf('Xeque-mate') >= 0, 'xeque-mate encerra a partida');

  await carregar('7k/5Q2/8/8/8/8/8/6K1 w - - 0 1');
  await tocar('f7'); await tocar('g6');
  conferir((await status()).indexOf('afogamento') >= 0, 'afogamento vira empate');

  await carregar('4k3/8/8/8/8/8/4R3/4K3 b - - 0 1');
  await tocar('e8'); await tocar('e7');
  conferir((await lances()).indexOf('Re7') < 0, 'rei nao entra em casa atacada');

  await carregar('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  await tocar('d2'); await tocar('d4');
  await pagina.reload(); await pagina.waitForTimeout(600);
  conferir((await lances()).indexOf('d4') >= 0, 'partida continua depois de recarregar');
  await ctx.close();

  console.log('\ncabe na tela sem rolagem:');
  for (var i = 0; i < TELAS.length; i++) {
    var t = TELAS[i];
    var c = await navegador.newContext({ viewport: { width: t[1], height: t[2] }, hasTouch: true });
    var p = await c.newPage();
    p.on('pageerror', function (e) { erros.push(e.message); });
    await p.goto(URL);
    await p.waitForTimeout(300);
    var r = await p.evaluate(function () {
      return {
        alt: document.body.scrollHeight, larg: document.body.scrollWidth,
        cel: document.getElementById('c0').offsetWidth
      };
    });
    conferir(r.alt <= t[2] + 1 && r.larg <= t[1] + 1,
      t[0] + ': casa de ' + r.cel + 'px, conteudo ' + r.larg + 'x' + r.alt);
    await c.close();
  }

  conferir(erros.length === 0, 'nenhum erro de javascript' + (erros.length ? ': ' + erros.join(' | ') : ''));
  await navegador.close();
  console.log(falhas ? '\n' + falhas + ' FALHA(S)' : '\nTODOS OS TESTES PASSARAM');
  process.exit(falhas ? 1 : 0);
})();
