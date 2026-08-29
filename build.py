#!/usr/bin/env python3
"""Gera dist/xadrez-kindle.html: o jogo inteiro em UM arquivo.

Um arquivo so e o formato que interessa no Kindle: da para copiar por USB e
abrir direto, sem servidor e sem depender de o navegador buscar arquivos
vizinhos (varios modelos tratam mal caminhos relativos em file://).

Uso: python3 build.py
"""
import os
import re
import sys

RAIZ = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(RAIZ, "dist", "xadrez-kindle.html")


def ler(caminho):
    with open(os.path.join(RAIZ, caminho), encoding="utf-8") as f:
        return f.read()


def main():
    html = ler("index.html")

    def inline_css(m):
        return "<style type=\"text/css\">\n%s\n</style>" % ler(m.group(1))

    def inline_js(m):
        return "<script type=\"text/javascript\">\n%s\n</script>" % ler(m.group(1))

    html = re.sub(r'<link rel="stylesheet" type="text/css" href="([^"]+)" />',
                  inline_css, html)
    html = re.sub(r'<script type="text/javascript" src="([^"]+)"></script>',
                  inline_js, html)

    if "href=" in html.split("<body")[0].replace('http-equiv', '') and ".css" in html:
        print("aviso: sobrou referencia a css externo", file=sys.stderr)
    if 'src="' in html:
        print("erro: sobrou script externo no arquivo final", file=sys.stderr)
        return 1

    os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
    with open(SAIDA, "w", encoding="utf-8") as f:
        f.write(html)

    tam = os.path.getsize(SAIDA)
    print("gerado: dist/xadrez-kindle.html  (%.1f KB)" % (tam / 1024.0))
    return 0


if __name__ == "__main__":
    sys.exit(main())
