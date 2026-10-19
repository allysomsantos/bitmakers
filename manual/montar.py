# -*- coding: utf-8 -*-
"""
Monta o Manual de Componentes BITMAKERS.

Como funciona:
  componentes/NN-nome.json   -> textos de cada pagina
  figuras/NN-nome-peca.svg   -> desenho da peca
  figuras/NN-nome-funciona.svg -> desenho de como ela funciona por dentro
  estilo.css                 -> visual das paginas A4

Uso (de dentro da pasta manual):
  python montar.py            monta saida/manual.html e saida/manual-bitmakers.pdf
  python montar.py --so-html  so o HTML (sem chamar o Chrome)
  python montar.py --apenas 03-resistor,04-led
                              previa so dessas pecas (saida/previa-03_04.pdf), sem capa
  python montar.py --apenas 03-resistor --verificar
                              diz se a peca cabe em 1 pagina (precisa do pymupdf)
"""
import html
import json
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).parent
SAIDA = RAIZ / "saida"

CATEGORIAS = {
    "sensor":       ("Sensor",        "#1a73e8"),
    "atuador":      ("Atuador",       "#d9640a"),
    "comunicacao":  ("Comunicação",   "#8e44c8"),
    "energia":      ("Energia",       "#c62828"),
    "interface":    ("Interface",     "#188038"),
    "controle":     ("Controle",      "#37474f"),
    "montagem":     ("Montagem",      "#6d4c41"),
}
NIVEIS = {
    1: ("Primeiros passos", "Peças que você liga e já vê acontecer. Comece por aqui."),
    2: ("O Arduino sente e mostra", "Sensores que percebem o mundo e uma tela para contar o que foi sentido."),
    3: ("Dar força e movimento", "Energia, motor e bomba: o Arduino mexendo em coisas de verdade."),
    4: ("Identificar, medir e conversar", "Peças que leem tags, medem peso e corrente e falam com o tablet."),
}
PROJETOS = {
    "B1": ("B1 · Amicão", "#2e7d32"),
    "B2": ("B2 · Anjos da Estrada", "#1565c0"),
}
CORES_FIO = {
    "vermelho": "#d93025", "preto": "#202124", "laranja": "#f29900", "verde": "#188038",
    "azul": "#1a73e8", "amarelo": "#e2a600", "roxo": "#9334e6", "branco": "#9aa0a6",
    "marrom": "#8d5524", "cinza": "#6b7280", "rosa": "#e91e8c",
}
CHROMES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def esc(texto):
    return html.escape(str(texto), quote=False)


def ler_svg(caminho):
    """Le um .svg e tira o cabecalho xml pra poder colocar dentro do HTML."""
    if not caminho.exists():
        return ""
    texto = caminho.read_text(encoding="utf-8-sig")
    if texto.lstrip().startswith("<?xml"):
        texto = texto.split("?>", 1)[1]
    return texto.strip()


def svg_ligacao(nome_peca, linhas, nome_placa="Arduino Uno"):
    """
    Desenha os fios da peca (esquerda) ate o Arduino (direita).
    linhas = [[pino da peca, pino do Arduino, cor do fio], ...]
    """
    altura_linha = 22
    topo = 24
    altura = topo + altura_linha * len(linhas) + 8
    x_peca, x_placa = 92, 186
    partes = [f'<svg viewBox="0 0 300 {altura}" xmlns="http://www.w3.org/2000/svg" '
              f'font-family="Segoe UI, Arial, sans-serif">']
    # caixas
    caixa_h = altura_linha * len(linhas) + 8
    partes.append(f'<rect x="2" y="{topo - 4}" width="{x_peca - 2}" height="{caixa_h}" rx="6" '
                  f'fill="#e3f2fd" stroke="#1a73e8" stroke-width="1.5"/>')
    partes.append(f'<rect x="{x_placa}" y="{topo - 4}" width="108" height="{caixa_h}" rx="6" '
                  f'fill="#e0f2f1" stroke="#00796b" stroke-width="1.5"/>')
    partes.append(f'<text x="{x_peca / 2}" y="14" font-size="9.5" font-weight="700" fill="#1a73e8" '
                  f'text-anchor="middle">{esc(nome_peca)}</text>')
    partes.append(f'<text x="{x_placa + 54}" y="14" font-size="9.5" font-weight="700" fill="#00796b" '
                  f'text-anchor="middle">{esc(nome_placa)}</text>')
    for i, (pino_peca, pino_ard, cor) in enumerate(linhas):
        y = topo + 7 + i * altura_linha
        hexcor = CORES_FIO.get(cor, "#555")
        partes.append(f'<line x1="{x_peca}" y1="{y}" x2="{x_placa}" y2="{y}" stroke="{hexcor}" '
                      f'stroke-width="3.2" stroke-linecap="round"/>')
        partes.append(f'<circle cx="{x_peca}" cy="{y}" r="3.6" fill="{hexcor}"/>')
        partes.append(f'<circle cx="{x_placa}" cy="{y}" r="3.6" fill="{hexcor}"/>')
        partes.append(f'<text x="{x_peca - 8}" y="{y + 3.5}" font-size="9.5" font-weight="600" '
                      f'fill="#0d3c75" text-anchor="end">{esc(pino_peca)}</text>')
        partes.append(f'<text x="{x_placa + 9}" y="{y + 3.5}" font-size="9.5" font-weight="600" '
                      f'fill="#004d40">{esc(pino_ard)}</text>')
        meio = (x_peca + x_placa) / 2
        partes.append(f'<rect x="{meio - 21}" y="{y - 6}" width="42" height="12" rx="6" fill="#fff" '
                      f'opacity=".92"/>')
        partes.append(f'<text x="{meio}" y="{y + 3}" font-size="7.6" fill="{hexcor}" font-weight="700" '
                      f'text-anchor="middle">{esc(cor)}</text>')
    partes.append("</svg>")
    return "".join(partes)


def bloco_projeto(chave, dados, nome_peca):
    nome, cor = PROJETOS[chave]
    pinos = "".join(f"<tr><td>{esc(a)}</td><td>{esc(b)}</td></tr>" for a, b in dados.get("pinos", []))
    tabela = f'<table class="pinos">{pinos}</table>' if pinos else ""
    figura = ""
    if dados.get("ligacao"):
        destino = dados.get("ligacao_destino", "Arduino Uno")
        figura = f'<div class="fio">{svg_ligacao(nome_peca, dados["ligacao"], destino)}</div>'
    classe = "corpo-proj" if figura else "corpo-proj sem-fio"
    return (
        f'<div class="proj" style="--c:{cor}">'
        f'<span class="tag">{esc(nome)}</span>'
        f'<div class="{classe}"><div><p>{esc(dados["texto"])}</p>{tabela}</div>{figura}</div>'
        f'</div>'
    )


def lista(itens):
    return "<ul>" + "".join(f"<li>{esc(i)}</li>" for i in itens) + "</ul>"


def pagina(c, numero, total):
    rotulo_cat, cor = CATEGORIAS[c["categoria"]]
    selos = "".join(
        f'<span class="selo" style="--c:{PROJETOS[p][1]}">{esc(PROJETOS[p][0])}</span>' for p in c["projetos"]
    )
    ficha = "".join(f"<tr><td>{esc(k)}</td><td>{esc(v)}</td></tr>" for k, v in c["ficha"].items())
    fig_peca = ler_svg(RAIZ / "figuras" / f'{c["id"]}-peca.svg')
    fig_func = ler_svg(RAIZ / "figuras" / f'{c["id"]}-funciona.svg')
    projetos = "".join(bloco_projeto(p, c["no_projeto"][p], c["nome_curto"]) for p in c["projetos"])
    classe_proj = "dois" if len(c["projetos"]) == 2 else ""
    nivel = c.get("nivel", 1)
    bolinhas = "●" * nivel + "○" * (4 - nivel)
    return f"""
<section class="pagina" style="--cor:{cor}">
  <div class="topo">
    <div class="num">{numero:02d}</div>
    <div class="titulo">
      <div class="etiqueta-cat">{esc(rotulo_cat)} &nbsp;·&nbsp; Nível {nivel} de 4 &nbsp;{bolinhas}</div>
      <h1>{esc(c["nome"])}</h1>
      <p>{esc(c["apelido"])}</p>
    </div>
    <div class="selos">{selos}</div>
  </div>

  <div class="grade2">
    <div class="coluna">
      <div class="cartao"><h2>O que é</h2><p>{esc(c["o_que_e"])}</p></div>
      <div class="cartao"><h2>Pra que serve</h2><p>{esc(c["pra_que_serve"])}</p></div>
      <div class="cartao"><h2>Onde ele vive</h2>{lista(c["onde_vive"])}</div>
    </div>
    <div class="coluna">
      <div class="cartao destaque figura">{fig_peca}<div class="legenda-fig">{esc(c["legenda_peca"])}</div></div>
      <div class="cartao"><h2>Ficha técnica</h2><table class="ficha">{ficha}</table></div>
    </div>
  </div>

  <div class="cartao"><h2>Como funciona por dentro</h2>
    <div class="funciona">
      <div class="figura">{fig_func}</div>
      <div>
        <ol>{"".join(f"<li>{esc(p)}</li>" for p in c["passos"])}</ol>
        <div class="formula">{esc(c["formula"])}</div>
      </div>
    </div>
  </div>

  <div class="projetos {classe_proj}">{projetos}</div>

  <div class="rodape">
    <div class="cartao cuidado"><h2>Cuidados e erros comuns</h2>{lista(c["cuidados"])}</div>
    <div class="cartao desafio"><h2>Desafio</h2><p>{esc(c["desafio"])}</p>
      <div class="resposta">Resposta: {esc(c["resposta"])}</div></div>
  </div>
  <div class="pe"><span>BITMAKERS · Manual de componentes</span><span>{numero} / {total}</span></div>
</section>"""


def capa(total):
    return f"""
<section class="pagina capa">
  <h1>Manual de<br>Componentes</h1>
  <p>Uma página por peça, do mais simples ao mais avançado: o que ela é, pra que serve, onde ela vive no mundo e como a usamos nos nossos protótipos.</p>
  <p>{total} componentes · 2 projetos · Arduino Uno</p>
  <div class="faixa">
    <div class="caixa"><b>B1 · Amicão</b>Totem comedouro e bebedouro que reconhece cada cachorro de rua pela coleira, pesa e manda os dados pro tablet.</div>
    <div class="caixa"><b>B2 · Anjos da Estrada</b>Kit de sensores de baixo custo pra caminhões antigos: ponto cego, setas, chuva, luz e impacto.</div>
  </div>
  <p style="margin-top:12mm;font-size:10pt;opacity:.9">BITMAKERS · Futebol de Rua</p>
</section>"""


def indice(componentes):
    linhas = []
    nivel_atual = None
    for n, c in enumerate(componentes, 1):
        rotulo, cor = CATEGORIAS[c["categoria"]]
        nivel = c.get("nivel", 1)
        if nivel != nivel_atual:
            nivel_atual = nivel
            titulo, descricao = NIVEIS[nivel]
            linhas.append(
                f'<tr class="nivel"><td colspan="2"><span class="bolas">{"●" * nivel}{"○" * (4 - nivel)}</span>'
                f'<b>Nível {nivel} · {esc(titulo)}</b><br><span class="desc">{esc(descricao)}</span></td></tr>'
            )
        selos = "".join(
            f'<span class="mini" style="background:{PROJETOS[p][1]}">{p}</span>' for p in c["projetos"]
        )
        linhas.append(
            f'<tr><td class="n">{n:02d}</td><td><span class="ponto" style="background:{cor}"></span>'
            f'<b>{esc(c["nome"])}</b> {selos}'
            f' <span class="ap">· {esc(c["apelido"])}</span></td></tr>'
        )
    como_ler = (
        '<div class="como-ler"><b>Como ler este manual</b>'
        '<p>As páginas vão do mais simples ao mais avançado. Cada uma segue a mesma ordem: '
        '<b>O que é</b>, <b>Pra que serve</b>, <b>Onde ele vive</b>, <b>Como funciona</b>, '
        '<b>No projeto</b> (B1 ou B2), <b>Cuidados</b> e um <b>Desafio</b> com resposta. '
        'Não precisa decorar nada: leia, tente o desafio e volte quando precisar.</p></div>'
    )
    return (f'<section class="pagina indice"><h1>Índice</h1>{como_ler}'
            f'<table>{"".join(linhas)}</table></section>')


def imprimir(arq_html, pdf):
    chrome = next((c for c in CHROMES if Path(c).exists()), None)
    if not chrome:
        sys.exit("Nao achei Chrome nem Edge pra gerar o PDF.")
    subprocess.run([
        chrome, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
        f"--print-to-pdf={pdf}", arq_html.as_uri(),
    ], check=True, capture_output=True, timeout=180)


SCRIPT_MEDIR = """<script>
window.addEventListener('load', function () {
  document.querySelectorAll('.pagina').forEach(function (p) {
    var filhos = Array.prototype.slice.call(p.children);
    var ultimo = filhos[filhos.length - 1].getBoundingClientRect().bottom;
    var base = p.getBoundingClientRect().top + p.clientHeight;
    // quanto sobra (em px) entre o fim do conteudo e o fim da pagina; negativo = estourou
    p.setAttribute('data-sobra', Math.round(base - ultimo));
    var maior = 0;
    p.querySelectorAll('*').forEach(function (e) {
      var b = e.getBoundingClientRect().bottom;
      if (b > maior) maior = b;
    });
    p.setAttribute('data-fundo', Math.round(base - maior));
  });
});
</script>"""


def verificar_estouro(arq_html, componentes):
    """
    A pagina tem altura fixa e corta o que passa. Aqui o Chrome mede, na propria pagina,
    quanto sobra entre o ultimo elemento e o fim da pagina. Negativo = estourou.
    """
    import re
    chrome = next((c for c in CHROMES if Path(c).exists()), None)
    saida = subprocess.run([
        chrome, "--headless=new", "--disable-gpu", "--virtual-time-budget=4000",
        "--dump-dom", arq_html.as_uri(),
    ], check=True, capture_output=True, timeout=180).stdout.decode("utf-8", "replace")
    medidas = re.findall(r'data-sobra="(-?\d+)"[^>]*data-fundo="(-?\d+)"', saida)
    ok = True
    for c, (sobra, fundo) in zip(componentes, medidas):
        sobra, fundo = int(sobra), int(fundo)
        mm = sobra * 25.4 / 96
        # fundo < 0: algum elemento passou do fim da pagina (foi cortado)
        if fundo < 0:
            ok = False
            print(f"  ESTOUROU {c['id']}: passa {abs(fundo) * 25.4 / 96:.1f} mm do fim da pagina (corte texto ou figura)")
        else:
            print(f"  ok       {c['id']}  (folga {mm:.1f} mm)")
    if len(medidas) != len(componentes):
        print(f"  ?? medi {len(medidas)} paginas, esperava {len(componentes)}")
        ok = False
    return ok


def montar(so_html=False, apenas=None, verificar=False):
    SAIDA.mkdir(exist_ok=True)
    componentes = []
    for arq in sorted((RAIZ / "componentes").glob("*.json")):
        if apenas and arq.stem not in apenas:
            continue
        dados = json.loads(arq.read_text(encoding="utf-8-sig"))
        dados["id"] = arq.stem
        componentes.append(dados)
    total = len(componentes)
    css = (RAIZ / "estilo.css").read_text(encoding="utf-8-sig")
    if apenas:
        # previa de poucos componentes: sem capa e sem indice
        corpo = "".join(pagina(c, n, total) for n, c in enumerate(componentes, 1))
        nome = "previa-" + "_".join(a.split("-")[0] for a in apenas)
    else:
        corpo = capa(total) + indice(componentes) + "".join(
            pagina(c, n, total) for n, c in enumerate(componentes, 1)
        )
        nome = "manual"
    script = SCRIPT_MEDIR if verificar else ""
    documento = (f'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
                 f'<title>Manual de Componentes BITMAKERS</title><style>{css}</style></head>'
                 f'<body>{corpo}{script}</body></html>')
    arq_html = SAIDA / f"{nome}.html"
    arq_html.write_text(documento, encoding="utf-8")
    print(f"HTML: {arq_html}  ({total} componentes)")
    if so_html:
        return
    if verificar:
        # mede no Chrome e tambem gera o PDF pra voce olhar
        if not verificar_estouro(arq_html, componentes):
            imprimir(arq_html, SAIDA / f"{nome}.pdf")
            sys.exit(1)
    pdf = SAIDA / (f"{nome}.pdf" if nome != "manual" else "manual-bitmakers.pdf")
    imprimir(arq_html, pdf)
    print(f"PDF:  {pdf}")


if __name__ == "__main__":
    argumentos = sys.argv[1:]
    apenas = None
    if "--apenas" in argumentos:
        apenas = argumentos[argumentos.index("--apenas") + 1].split(",")
    montar(so_html="--so-html" in argumentos, apenas=apenas, verificar="--verificar" in argumentos)
