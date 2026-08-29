/* =========================================================================
   pecas.js - o desenho das pecas
   Desenhadas em SVG para saírem iguais em qualquer aparelho: a fonte do
   Kindle muda de modelo para modelo e nem sempre traz os simbolos de
   xadrez, entao depender dela e depender da sorte.
   Cada peca tem duas partes: "corpo" (formas preenchidas) e "traco"
   (linhas de dentro). Na peca branca o corpo e branco e as linhas pretas;
   na preta o corpo e preto e as linhas brancas, senao a peca vira uma
   mancha unica na tela de tinta eletronica.
   Sistema de coordenadas: 45x45, com a peca ocupando de y=5 a y=39.
   ========================================================================= */
var Pecas = (function () {
  'use strict';

  /* base comum: o "pe" em que quase todas as pecas se apoiam */
  var BASE = 'M9.5 39.5h26v-4l-2.5-2h-21l-2.5 2z';

  var DESENHO = {
    /* peao */
    1: {
      corpo: 'M22.5 8.5a5.2 5.2 0 0 1 3.1 9.4c2.7 1.6 4.4 4.2 4.4 7 0 2.6-1.3 4.8-3 6.1h-8C17.3 29.7 16 27.5 16 24.9c0-2.8 1.7-5.4 4.4-7a5.2 5.2 0 0 1 2.1-9.4z' +
             'M13.5 31h18l1.5 2.5h-21z' + BASE,
      traco: ''
    },
    /* cavalo */
    2: {
      corpo: 'M15 33.5c-1-4.5 0-8 2.2-11 1.6-2.2 2-3.8 1.3-5.6l-3.2 3.2-2.6-1.8c-.4-2.6 1.2-5.1 3.8-7.1l3.2-2.4.9-3.8 2.7 2.7c5.2.6 9.7 3.3 12.2 7.9 2 3.7 2.7 8.2 2.7 13.4v4.5z' +
             'M13 33.5h20l1.5 2.5h-23z' + BASE,
      traco: 'M16.5 15.8l-2 2.4'
    },
    /* bispo */
    3: {
      corpo: 'M22.5 5.2a2.7 2.7 0 0 1 0 5.4 2.7 2.7 0 0 1 0-5.4z' +
             'M22.5 10.8c4.8 1.8 8.3 6.4 8.3 11 0 3.6-2.4 6.2-5.1 7.7h-6.4c-2.7-1.5-5.1-4.1-5.1-7.7 0-4.6 3.5-9.2 8.3-11z' +
             'M14 29.5h17l1.5 2.5h-20zM12.5 33.5h20l1.5 2h-23z' + BASE,
      traco: 'M20 21.5l5-5.5'
    },
    /* torre */
    4: {
      corpo: 'M11 9.5h4.6v3h4.6v-3h4.6v3h4.6v-3H34v7.5H11z' +
             'M14.2 17h16.6l-1.2 13.5h-14.2z' +
             'M12 30.5h21l1.5 3h-24z' + BASE,
      traco: 'M14.8 21h15.4M14.4 26h16.2'
    },
    /* dama */
    5: {
      corpo: 'M8.5 8.6a2.3 2.3 0 0 1 0 4.6 2.3 2.3 0 0 1 0-4.6z' +
             'M15.6 6a2.3 2.3 0 0 1 0 4.6 2.3 2.3 0 0 1 0-4.6z' +
             'M22.5 4.8a2.6 2.6 0 0 1 0 5.2 2.6 2.6 0 0 1 0-5.2z' +
             'M29.4 6a2.3 2.3 0 0 1 0 4.6 2.3 2.3 0 0 1 0-4.6z' +
             'M36.5 8.6a2.3 2.3 0 0 1 0 4.6 2.3 2.3 0 0 1 0-4.6z' +
             'M9 13.8l3.6 15.2h19.8L36 13.8l-6.2 8.4-2.4-10.4-2.6 10.2-2.3-11.2-2.3 11.2-2.6-10.2-2.4 10.4z' +
             'M12 29h21l1.2 2.6h-23.4zM11 33.5h23l1 2h-25z' + BASE,
      traco: 'M13.4 31.5h18.2'
    },
    /* rei
       A cruz e parte do corpo, nao um traco: na peca preta os tracos sao
       brancos, e um traco branco fora da silhueta sumiria na casa clara. */
    6: {
      corpo: 'M20.6 4h3.8v3.2h3.2V11h-3.2v2.5h-3.8V11h-3.2V7.2h3.2z' +
             'M22.5 11.5c1.2 0 2.2.6 2.8 1.6 3.2-1.7 7-.5 8.6 2.7 1.6 3.2.4 7-2.3 9.1L28 27.5H17l-3.6-2.6c-2.7-2.1-3.9-5.9-2.3-9.1 1.6-3.2 5.4-4.4 8.6-2.7.6-1 1.6-1.6 2.8-1.6z' +
             'M14 27.5h17l1.5 2.6h-20zM12.5 32h20l1.5 2h-23z' + BASE,
      traco: 'M22.5 15.5v9M18 20h9'
    }
  };

  /* Este navegador desenha SVG? O do Kindle desenha, mas nos modelos mais
     antigos nao da para confiar - dai a alternativa em letras. */
  function suportaSvg() {
    try {
      return !!(document.createElementNS &&
        document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGRect);
    } catch (e) {
      return false;
    }
  }

  /* html de uma peca; cor 0 = brancas, 1 = pretas */
  function svg(tipo, cor, tamanho) {
    var d = DESENHO[tipo];
    if (!d) return '';
    var preenche = cor ? '#000' : '#fff';
    var linha = cor ? '#fff' : '#000';
    /* o viewBox e maior que o desenho de proposito: sobra uma margem em
       volta, senao as pecas de casas vizinhas ficam se encostando */
    var s = '<svg class="pecaSvg" width="' + tamanho + '" height="' + tamanho +
      '" viewBox="-3 -3 51 51">';
    s += '<path d="' + d.corpo + '" fill="' + preenche +
      '" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/>';
    if (d.traco) {
      s += '<path d="' + d.traco + '" fill="none" stroke="' + linha +
        '" stroke-width="1.6" stroke-linecap="round"/>';
    }
    if (tipo === 2) {   /* o olho do cavalo */
      s += '<circle cx="19.2" cy="14.4" r="1.5" fill="' + linha + '"/>';
    }
    return s + '</svg>';
  }

  return { svg: svg, suportaSvg: suportaSvg, TIPOS: [1, 2, 3, 4, 5, 6] };
})();
