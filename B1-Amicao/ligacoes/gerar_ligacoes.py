# Gera os diagramas de ligacao do Amicao (B1) em SVG.
# Uso: python gerar_ligacoes.py   (cria os .svg nesta mesma pasta)
# Para mudar um desenho, edite as coordenadas aqui e rode de novo.
import os
from xml.sax.saxutils import escape

PASTA = os.path.dirname(os.path.abspath(__file__))
FUNDO = "#141414"
FONTE = "'Segoe UI', Arial, sans-serif"

COR = dict(
    vermelho="#e5484d", cinza="#8a8880", azul="#3b82f6", roxo="#8b6fdc",
    verde="#1fa37a", branco="#f2f0e6", preto="#101010", laranja="#e8913a",
    amarelo="#e8c93d", rosa="#ec7fb0",
)

# (preenchimento, borda, titulo, pinos)
ESTILO = dict(
    arduino=("#47453f", "#6e6c63", "#e8e6dc", "#b5b3a8"),
    modulo=("#0a5240", "#2a9d78", "#8ee3bf", "#6fd6ae"),
    azul=("#0a3d6e", "#3b82f6", "#a9cdf7", "#7fb2ee"),
    ambar=("#5c3a0a", "#c98a2b", "#f5c46b", "#e6b050"),
    celula=("#2f3438", "#7d8b96", "#d5dde3", "#aab6bf"),
    cartao=("#1d1d1d", "#3a3a3a", "#cfcdc2", "#a5a398"),
)


class Svg:
    def __init__(self, largura, altura):
        self.w, self.h = largura, altura
        self.p = []
        self.segs = []

    def retangulo(self, x, y, w, h, fill, stroke, rx=14, sw=1.5, extra=""):
        self.p.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" '
                      f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>')

    def texto(self, x, y, s, tam=22, cor="#e8e6dc", ancora="start", peso="400", extra=""):
        self.p.append(f'<text x="{x}" y="{y}" font-size="{tam}" fill="{cor}" '
                      f'text-anchor="{ancora}" font-weight="{peso}" {extra}>{escape(s)}</text>')

    def fio(self, pontos, cor, largura=5):
        pts = " ".join(f"{x},{y}" for x, y in pontos)
        if cor == COR["preto"]:  # fio preto: contorno claro para aparecer no fundo escuro
            self.p.append(f'<polyline points="{pts}" fill="none" stroke="#d0d0d0" stroke-width="{largura+4}" '
                          f'stroke-linejoin="round" stroke-linecap="round"/>')
        self.p.append(f'<polyline points="{pts}" fill="none" stroke="{cor}" stroke-width="{largura}" '
                      f'stroke-linejoin="round" stroke-linecap="round"/>')

    def fio_com_pulo(self, x0, x1, y, cor, pulos):
        """Fio horizontal que pula por cima dos fios verticais em 'pulos'."""
        d = f"M {x0} {y}"
        sentido = 1 if x1 > x0 else -1
        for xp in sorted(pulos, reverse=(sentido < 0)):
            d += f" L {xp - 9*sentido} {y} a 9 9 0 0 {1 if sentido > 0 else 0} {18*sentido} 0"
        d += f" L {x1} {y}"
        if cor == COR["preto"]:
            self.p.append(f'<path d="{d}" fill="none" stroke="#d0d0d0" stroke-width="9" stroke-linecap="round"/>')
        self.p.append(f'<path d="{d}" fill="none" stroke="{cor}" stroke-width="5" stroke-linecap="round"/>')

    def ponto(self, x, y, cor, r=7):
        extra = ' stroke="#9a9a9a" stroke-width="2"' if cor == COR["preto"] else ""
        self.p.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{cor}"{extra}/>')

    def caixa(self, x, y, w, h, tipo, titulo, esq=(), dir=(), rodape=None, cor_rodape=None):
        fill, borda, ctit, cpino = ESTILO[tipo]
        self.retangulo(x, y, w, h, fill, borda)
        self.texto(x + w / 2, y + 44, titulo, 28, ctit, "middle", "600")
        for nome, py in esq:
            self.texto(x + 22, py + 7, nome, 22, cpino)
        for nome, py in dir:
            self.texto(x + w - 22, py + 7, nome, 22, cpino, "end")
        if rodape:
            self.texto(x + w / 2, y + h - 22, rodape, 18, cor_rodape or cpino, "middle")

    # ---- roteador com pulos automaticos (usado no desenho completo) ----
    def registrar(self, x1, y1, x2, y2, net):
        self.segs.append((min(x1, x2), min(y1, y2), max(x1, x2), max(y1, y2), net))

    def fio_auto(self, pontos, cor, net, largura=5):
        """Fio ortogonal que pula sozinho por cima de fios de OUTRA rede (net)."""
        d = f"M {pontos[0][0]} {pontos[0][1]}"
        novos = []
        for (xa, ya), (xb, yb) in zip(pontos, pontos[1:]):
            if xa == xb and ya == yb:
                continue
            cruz = []
            for sx1, sy1, sx2, sy2, snet in self.segs:
                if snet == net:
                    continue
                if ya == yb and sx1 == sx2:          # meu trecho horizontal x vertical existente
                    if min(xa, xb) + 12 < sx1 < max(xa, xb) - 12 and sy1 < ya < sy2:
                        cruz.append(sx1)
                elif xa == xb and sy1 == sy2:        # meu trecho vertical x horizontal existente
                    if min(ya, yb) + 12 < sy1 < max(ya, yb) - 12 and sx1 < xa < sx2:
                        cruz.append(sy1)
            if ya == yb:
                sentido = 1 if xb > xa else -1
                for x in sorted(cruz, reverse=(sentido < 0)):
                    d += f" L {x - 9*sentido} {ya} a 9 9 0 0 {1 if sentido > 0 else 0} {18*sentido} 0"
            else:
                sentido = 1 if yb > ya else -1
                for y in sorted(cruz, reverse=(sentido < 0)):
                    d += f" L {xa} {y - 9*sentido} a 9 9 0 0 {1 if sentido > 0 else 0} 0 {18*sentido}"
            d += f" L {xb} {yb}"
            novos.append((min(xa, xb), min(ya, yb), max(xa, xb), max(ya, yb), net))
        if cor == COR["preto"]:
            self.p.append(f'<path d="{d}" fill="none" stroke="#d0d0d0" stroke-width="{largura+4}" '
                          f'stroke-linejoin="round" stroke-linecap="round"/>')
        self.p.append(f'<path d="{d}" fill="none" stroke="{cor}" stroke-width="{largura}" '
                      f'stroke-linejoin="round" stroke-linecap="round"/>')
        self.segs += novos

    def caixa_livre(self, x, y, w, h, tipo, titulo, esq=(), dir=(), baixo=(), rodape=None, cor_rodape=None):
        """Como caixa(), mas aceita pinos na borda de baixo: baixo = [(nome, x)]."""
        self.caixa(x, y, w, h, tipo, titulo, esq, dir, rodape, cor_rodape)
        for nome, px in baixo:
            self.texto(px, y + h - 14, nome, 17, ESTILO[tipo][3], "middle")

    def resistor(self, cx, cy, rotulo, vertical=False):
        w, h = (28, 52) if vertical else (60, 28)
        self.retangulo(cx - w / 2, cy - h / 2, w, h, "#5c3a0a", "#c98a2b", rx=6, sw=1.5)
        self.texto(cx, cy + 6, rotulo, 17, "#f5c46b", "middle", "600")

    def salvar(self, nome):
        corpo = "\n".join(self.p)
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" '
               f'width="{self.w}" height="{self.h}" font-family="{FONTE}">\n'
               f'<rect width="{self.w}" height="{self.h}" fill="{FUNDO}"/>\n{corpo}\n</svg>\n')
        with open(os.path.join(PASTA, nome), "w", encoding="utf-8") as f:
            f.write(svg)
        print("gerado", nome)


def pinos(nomes, y0=130, passo=80):
    return [(n, y0 + i * passo) for i, n in enumerate(nomes)]


AVISO = "#ff9a9a"
ALERTA = "#f5b25c"

# ---------------------------------------------------------------- 1. balanca
def balanca():
    s = Svg(1330, 1340)
    s.caixa(30, 40, 225, 400, "arduino", "Arduino Uno",
            dir=[("GND", 210), ("A1", 290), ("A0", 370)])
    s.caixa(470, 40, 240, 400, "modulo", "HX711",
            esq=[("VCC", 130), ("GND", 210), ("DT", 290), ("SCK", 370)],
            dir=[("E+", 130), ("E−", 210), ("A−", 290), ("A+", 370)],
            rodape="B− e B+ ficam soltos")
    for y, c in [(210, "cinza"), (290, "verde"), (370, "roxo")]:
        s.fio([(255, y), (470, y)], COR[c])
    s.fio([(470, 130), (400, 130)], COR["vermelho"])
    s.texto(390, 137, "5V da fonte", 20, "#e8e6dc", "end")

    # barramentos: cada um junta o mesmo fio das 4 celulas (todas ligadas iguais)
    barra = {"A+": (800, 370, COR["branco"]), "A−": (850, 290, COR["verde"]),
             "E−": (900, 210, COR["preto"]), "E+": (950, 130, COR["vermelho"])}
    topos = [470, 680, 890, 1100]
    fios_celula = [("vermelho", "E+"), ("preto", "E−"), ("verde", "A−"), ("branco", "A+")]
    fim = {k: 0 for k in barra}
    fios = []
    for top in topos:
        for j, (cor_fio, dest) in enumerate(fios_celula):
            y = top + 64 + j * 30
            fios.append((y, dest, COR[cor_fio]))
            fim[dest] = max(fim[dest], y)
    for nome, (bx, y_ini, cor) in barra.items():
        s.fio([(710, y_ini), (bx, y_ini), (bx, fim[nome])], cor)
    for y, dest, cor in fios:
        bx = barra[dest][0]
        pulos = [b[0] for n, b in barra.items() if n != dest and bx < b[0] < 1050
                 and b[1] < y < fim[n]]
        s.fio_com_pulo(1050, bx, y, cor, pulos)
        s.ponto(bx, y, barra[dest][2])

    for i, top in enumerate(topos):
        s.caixa(1050, top, 250, 190, "celula", f"Célula {i+1} · 20 kg",
                esq=[("vermelho", top + 64), ("preto", top + 94),
                     ("verde", top + 124), ("branco", top + 154)])

    s.texto(1000, 110, "Cor do barramento:", 20, "#cfcdc2", peso="600")
    for k, (n, c) in enumerate([("E+", "vermelho"), ("E−", "preto"), ("A−", "verde"), ("A+", "branco")]):
        yy = 150 + k * 34
        s.fio([(1000, yy), (1050, yy)], COR[c])
        s.texto(1065, yy + 7, f"{n} do HX711", 20, "#cfcdc2")
    s.texto(1000, 320, "As 4 células ligam iguais, em paralelo:", 19, "#9bd3b5")
    s.texto(1000, 346, "fio da mesma cor no mesmo ponto.", 19, "#9bd3b5")
    s.texto(1000, 386, "Peso negativo? Troque A+ com A−.", 19, AVISO)
    s.salvar("1-balanca-hx711.svg")


# ---------------------------------------------------------------- 2. rfid
def rfid():
    s = Svg(1330, 830)
    ard = [("D10", 130), ("D13", 210), ("D11", 290), ("D12", 370), ("GND", 530), ("D9", 610), ("3.3V", 690)]
    mod = [("SDA", 130), ("SCK", 210), ("MOSI", 290), ("MISO", 370), ("IRQ", 450),
           ("GND", 530), ("RST", 610), ("3.3V", 690)]
    s.caixa(30, 40, 225, 740, "arduino", "Arduino Uno", dir=ard)
    s.caixa(560, 40, 300, 740, "modulo", "RC522", esq=mod,
            rodape="só 3.3V — nunca 5V!", cor_rodape=AVISO)
    for y, c in [(130, "verde"), (210, "roxo"), (290, "azul"), (370, "amarelo"),
                 (530, "cinza"), (610, "rosa"), (690, "laranja")]:
        s.fio([(255, y), (560, y)], COR[c])
    s.texto(407, 457, "IRQ não é ligado", 19, "#a5a398", "middle")
    s.retangulo(980, 280, 300, 200, ESTILO["cartao"][0], ESTILO["cartao"][1])
    s.texto(1130, 330, "Tag NFC da coleira", 24, "#e8e6dc", "middle", "600")
    s.texto(1130, 375, "encostar a 2–5 cm", 20, "#cfcdc2", "middle")
    s.texto(1130, 405, "da antena do leitor", 20, "#cfcdc2", "middle")
    s.texto(1130, 450, "(o RC522 lê bem de pertinho)", 17, "#a5a398", "middle")
    s.salvar("2-rfid-rc522.svg")


# ---------------------------------------------------------------- 3. bomba + rele
def bomba():
    s = Svg(1530, 590)
    s.caixa(30, 40, 225, 250, "arduino", "Arduino Uno", dir=[("D3", 130), ("GND", 210)])
    s.caixa(520, 40, 300, 360, "modulo", "Módulo relé",
            esq=[("IN", 130), ("GND", 210), ("VCC", 290)],
            dir=[("NC", 130), ("NO", 210), ("COM", 290)],
            rodape="1 canal, 5V")
    s.fio([(255, 130), (520, 130)], COR["verde"])
    s.fio([(255, 210), (520, 210)], COR["cinza"])
    # VCC do rele
    s.fio([(520, 290), (440, 290)], COR["vermelho"])
    s.texto(430, 297, "5V (fonte separada)", 20, "#e8e6dc", "end")
    s.texto(840, 137, "NC fica solto", 17, "#a5a398")
    # COM recebe 5V
    s.fio([(820, 290), (880, 290)], COR["vermelho"])
    s.texto(892, 297, "5V", 20, "#e8e6dc")
    # NO -> bomba +
    s.caixa(1260, 130, 240, 300, "azul", "Mini bomba",
            esq=[("+", 210), ("−", 370)], rodape="d'água, 5V")
    s.fio([(820, 210), (1260, 210)], COR["vermelho"])
    s.fio([(900, 370), (1260, 370)], COR["cinza"])
    s.texto(888, 377, "GND", 20, "#e8e6dc", "end")
    # diodo em paralelo com a bomba
    s.fio([(1068, 210), (1068, 250)], COR["vermelho"])
    s.fio([(1068, 330), (1068, 370)], COR["cinza"])
    s.retangulo(1050, 250, 36, 80, "#2a2a2a", "#999999", rx=6)
    s.retangulo(1050, 256, 36, 9, "#e8e6dc", "#e8e6dc", rx=2)
    s.ponto(1068, 210, COR["vermelho"])
    s.ponto(1068, 370, COR["cinza"])
    s.texto(1100, 290, "diodo 1N4007", 19, "#e8e6dc")
    s.texto(1100, 316, "faixa no lado do +", 17, "#a5a398")
    s.texto(30, 470, "Este módulo relé (3 pinos: IN, GND, VCC, com transistor) liga com sinal HIGH, como o código já faz.", 20, ALERTA)
    s.texto(30, 500, "Se o relé ligar sozinho ao ligar o Arduino, o seu liga com LOW: troque NIVEL_BOMBA_LIGADA no sketch.", 20, ALERTA)
    s.texto(30, 530, "O D8 não é mais usado.", 20, "#a5a398")
    s.salvar("3-bomba-rele.svg")


# ---------------------------------------------------------------- 4. motor
def motor():
    s = Svg(1370, 820)
    s.caixa(30, 40, 225, 520, "arduino", "Arduino Uno",
            dir=[("D4", 130), ("D5", 210), ("D6", 290), ("D7", 370), ("GND", 530)])
    s.caixa(560, 40, 300, 670, "ambar", "ULN2003",
            esq=[("IN1", 130), ("IN2", 210), ("IN3", 290), ("IN4", 370), ("−", 530), ("+", 610)],
            rodape="driver do motor")
    for y, c in [(130, "azul"), (210, "verde"), (290, "amarelo"), (370, "roxo"), (530, "cinza")]:
        s.fio([(255, y), (560, y)], COR[c])
    s.fio([(560, 610), (440, 610)], COR["vermelho"])
    s.texto(430, 617, "5V (fonte separada)", 20, "#e8e6dc", "end")
    s.caixa(1060, 190, 280, 300, "azul", "Motor 28BYJ-48", rodape="5 fios, conector branco")
    for k, c in enumerate(["azul", "rosa", "amarelo", "laranja", "vermelho"]):
        y = 270 + k * 24
        s.fio([(860, y), (1060, y)], COR[c], 4)
    s.texto(960, 245, "conector branco de 5 pinos", 17, "#a5a398", "middle")
    s.texto(960, 255 + 5 * 24 + 22, "encaixa de um jeito só", 17, "#a5a398", "middle")
    s.texto(30, 755, "Teste na bancada: o + pode ir no 5V do Arduino (USB no PC, motor sem carga).", 19, ALERTA)
    s.texto(30, 785, "Montagem final: 5V da fonte separada, com o GND ligado no GND do Arduino.", 19, "#a5a398")
    s.salvar("4-motor-de-passo.svg")


# ---------------------------------------------------------------- 6. alimentacao
def alimentacao():
    s = Svg(1500, 1480)
    s.caixa(30, 40, 250, 230, "cartao", "Fonte 5V separada",
            dir=[("GND", 130), ("+5V", 210)], rodape="2A ou mais")
    # cargas (x=600): tudo que o Arduino nao aguenta
    s.caixa(600, 40, 280, 150, "arduino", "Arduino Uno", esq=[("GND", 130)],
            rodape="alimentado à parte (USB ou jack)")
    s.caixa(600, 230, 280, 240, "ambar", "ULN2003 (motor)", esq=[("−", 320), ("+", 400)])
    s.caixa(600, 510, 280, 250, "modulo", "Módulo relé", esq=[("VCC", 600), ("COM", 680)])
    s.caixa(600, 800, 280, 170, "azul", "Bomba d'água", esq=[("+ (vem do NO do relé)", 856), ("−", 890)])
    s.caixa(600, 1010, 280, 190, "modulo", "HX711", esq=[("VCC", 1100), ("GND", 1150)])
    s.caixa(600, 1240, 280, 190, "azul", "Bluetooth HM-10", esq=[("VCC", 1330), ("GND", 1380)])
    xg, x5 = 460, 400
    # barramento de GND (cinza) e de 5V (vermelho)
    s.fio([(280, 130), (xg, 130), (xg, 1380)], COR["cinza"])
    s.fio([(280, 210), (x5, 210), (x5, 1330)], COR["vermelho"])
    for y in (130, 320, 890, 1150, 1380):
        s.fio([(xg, y), (600, y)], COR["cinza"])
        s.ponto(xg, y, COR["cinza"])
    for y in (400, 600, 680, 1100, 1330):
        s.fio_com_pulo(x5, 600, y, COR["vermelho"], [xg])
        s.ponto(x5, y, COR["vermelho"])
    # cartao de avisos
    s.retangulo(960, 40, 500, 400, ESTILO["cartao"][0], ESTILO["cartao"][1])
    linhas = [("Tudo que é 5V fica na fonte separada:", "#e8e6dc", 600),
              ("• motor de passo (ULN2003)", "#cfcdc2", 400),
              ("• relé e bomba", "#cfcdc2", 400),
              ("• HX711 (balança)", "#cfcdc2", 400),
              ("• HM-10 (Bluetooth)", "#cfcdc2", 400),
              ("", "", 0),
              ("No 3,3V do Arduino fica só:", "#e8e6dc", 600),
              ("• RC522", "#cfcdc2", 400),
              ("", "", 0),
              ("O GND é um só: liga o GND da fonte", "#e8e6dc", 600),
              ("no GND do Arduino.", "#e8e6dc", 600)]
    for k, (t, c, p) in enumerate(linhas):
        if t:
            s.texto(985, 82 + k * 32, t, 20, c, peso=str(p))
    s.texto(985, 430, "Nunca ligue o +5V da fonte no pino 5V do Arduino.", 19, AVISO)
    s.salvar("5-alimentacao.svg")


# ---------------------------------------------------------------- 0. ligacao completa
def completo():
    s = Svg(1900, 3000)
    R = COR
    c5v, c33, cgnd = R["vermelho"], R["laranja"], R["cinza"]

    # ---------- posicoes (tudo calculado a partir de Y1 para nao errar na mao) ----------
    Y1 = 330
    Y2 = Y1 + 350          # rele e bomba
    Y4 = Y2 + 370          # Arduino do leitor + RC522
    Y5 = Y4 + 480          # HM-10
    Y6 = Y5 + 340          # HX711
    X_COMP, W_COMP = 520, 300
    X_MOTOR = 940
    X_MINI = 1300                      # protoboard 170 pontos
    XB5, XBG = 1350, 1430              # faixa de 5V dedicado e faixa de GND da protoboard 170
    X_400 = 1650                       # protoboard 400 pontos
    XG = 1700                          # trilho de GND da protoboard 400
    X_DIR = X_COMP + W_COMP            # borda direita das caixas

    def py(y0, i):                     # y do i-esimo pino de uma caixa que comeca em y0
        return y0 + 80 + 50 * i

    # ---------- protoboards (corpo, desenhadas primeiro) ----------
    y_fim_400 = Y6 + 170
    s.retangulo(X_400 + 25, 70, 50, y_fim_400 - 70, "#6e1f1f", "#c0392b", rx=16, sw=2)
    s.texto(X_400 + 50, 54, "Protoboard 400 pontos", 22, "#e8e6dc", "middle", "600")
    for x, cor_f, cor_b, nome in [(XG, "#2b2b2b", "#9a9a9a", "GND")]:
        s.retangulo(x - 15, 105, 30, y_fim_400 - 125, cor_f, cor_b, rx=8, sw=2)
        s.texto(x, 98, nome, 15, cor_b, "middle", "600")
    y_fim_mini = Y2 + 350
    s.retangulo(X_MINI, Y1 + 150, 180, y_fim_mini - Y1 - 150, "#6e1f1f", "#c0392b", rx=16, sw=2)
    s.texto(X_MINI + 90, y_fim_mini + 28, "Protoboard 170 pontos", 20, "#e8e6dc", "middle", "600")
    s.texto(X_MINI + 90, y_fim_mini + 54, "todo o 5V: motor, relé, bomba, HX711, HM-10", 14, "#a5a398", "middle")
    # a faixa de 5V tem so 5 furos: sao duas faixas (A e B) ligadas por um jumper
    ya_fim, yb_ini = Y2 + 235, Y2 + 255
    s.retangulo(XB5 - 18, Y1 + 160, 36, ya_fim - Y1 - 160, "#5c1a1a", c5v, rx=8, sw=2)
    s.retangulo(XB5 - 18, yb_ini, 36, y_fim_mini - 10 - yb_ini, "#5c1a1a", c5v, rx=8, sw=2)
    s.retangulo(XBG - 18, Y1 + 160, 36, y_fim_mini - Y1 - 170, "#2b2b2b", "#9a9a9a", rx=8, sw=2)
    s.texto(XB5, Y1 + 186, "5V", 13, c5v, "middle", "600")
    s.texto(XBG, Y1 + 186, "GND", 13, "#9a9a9a", "middle", "600")
    # as faixas e os trilhos contam como fios de uma rede so: quem cruza por cima pula
    s.registrar(XG, 105, XG, y_fim_400 - 20, "GND")
    s.registrar(XB5, Y1 + 160, XB5, ya_fim, "5V")
    s.registrar(XB5, yb_ini, XB5, y_fim_mini - 10, "5V")
    s.registrar(XBG, Y1 + 160, XBG, y_fim_mini - 10, "GND")

    # ---------- caixas ----------
    s.caixa(X_COMP, Y1, W_COMP, 310, "ambar", "ULN2003",
            esq=[(f"IN{i+1}", py(Y1, i)) for i in range(4)],
            dir=[("−", Y1 + 210), ("+", Y1 + 260)], rodape="driver do motor")
    s.caixa(X_MOTOR, Y1, 220, 190, "azul", "Motor 28BYJ-48", rodape="conector de 5 fios")
    s.caixa_livre(X_MINI, Y1, 180, 110, "cartao", "Fonte 5V (2A)", baixo=[("+", XB5), ("−", XBG)])
    s.caixa(X_COMP, Y2, W_COMP, 330, "modulo", "Módulo relé", esq=[("IN", py(Y2, 0))],
            dir=[("NO", py(Y2, 0)), ("COM", Y2 + 170), ("VCC", Y2 + 220), ("GND", Y2 + 270)])
    s.caixa(X_MOTOR, Y2, 220, 150, "azul", "Mini bomba", esq=[("+", py(Y2, 0))], dir=[("−", py(Y2, 0))])
    # diodo 1N4007 nos terminais da bomba (faixa no lado do +)
    s.retangulo(X_MOTOR + 70, Y2 + 100, 80, 18, "#2a2a2a", "#999999", rx=4)
    s.retangulo(X_MOTOR + 70, Y2 + 100, 12, 18, "#e8e6dc", "#e8e6dc", rx=2)
    s.texto(X_MOTOR + 110, Y2 + 138, "diodo 1N4007", 15, "#7fb2ee", "middle")

    s.caixa(X_COMP, Y4, W_COMP, 440, "arduino", "Arduino do leitor",
            esq=[("A4 (SDA)", py(Y4, 0)), ("A5 (SCL)", py(Y4, 1)), ("GND", py(Y4, 2))],
            dir=[("D10", py(Y4, 0)), ("D13", py(Y4, 1)), ("D11", py(Y4, 2)), ("D12", py(Y4, 3)),
                 ("D9", py(Y4, 4)), ("3.3V", py(Y4, 5)), ("GND", py(Y4, 6))],
            rodape="USB próprio")
    s.caixa(X_MOTOR, Y4, 220, 440, "modulo", "RC522",
            esq=[("SDA", py(Y4, 0)), ("SCK", py(Y4, 1)), ("MOSI", py(Y4, 2)), ("MISO", py(Y4, 3)),
                 ("RST", py(Y4, 4)), ("3.3V", py(Y4, 5)), ("GND", py(Y4, 6))],
            rodape="só 3.3V, nunca 5V", cor_rodape=AVISO)
    s.caixa(X_COMP, Y5, W_COMP, 190, "azul", "Bluetooth HM-10",
            esq=[("TXD", py(Y5, 0)), ("RXD", py(Y5, 1))], dir=[("VCC", py(Y5, 0)), ("GND", py(Y5, 1))])
    xe = [560, 620, 680, 740]          # pinos E+, E−, A−, A+ na borda de baixo do HX711
    s.caixa_livre(X_COMP, Y6, W_COMP, 190, "modulo", "HX711",
                  esq=[("DT", py(Y6, 0)), ("SCK", py(Y6, 1))], dir=[("VCC", py(Y6, 0)), ("GND", py(Y6, 1))],
                  baixo=list(zip(["E+", "E−", "A−", "A+"], xe)))

    # ---------- Arduino (altura calculada pelo ultimo pino) ----------
    sinais = [  # (rotulo no Arduino, y, cor do fio)
        ("D4", py(Y1, 0), "azul"), ("D5", py(Y1, 1), "verde"), ("D6", py(Y1, 2), "amarelo"), ("D7", py(Y1, 3), "roxo"),
        ("D3", py(Y2, 0), "verde"),
        ("A4", py(Y4, 0), "azul"), ("A5", py(Y4, 1), "roxo"),
        ("D2", py(Y5, 0), "laranja"), ("A3", py(Y5, 1), "rosa"),
        ("A1", py(Y6, 0), "verde"), ("A0", py(Y6, 1), "roxo"),
    ]
    h_ard = py(Y6, 1) + 60 - 40
    s.caixa(30, 40, 225, h_ard, "arduino", "Arduino Uno",
            dir=[("GND", 190)] + [(n, y) for n, y, _ in sinais] + [("GND", py(Y4, 2))])
    s.texto(142, 40 + 70, "alimentado por USB ou jack", 16, ESTILO["arduino"][3], "middle")

    # ---------- fios de energia do Arduino para a protoboard 400 ----------
    s.fio_auto([(255, 190), (XG, 190)], cgnd, "GND")
    for y, x_t, cor in [(190, XG, cgnd)]:
        s.ponto(x_t, y, cor)

    # ---------- sinais Arduino -> caixas (retos, sem cruzar) ----------
    for nome, y, cor in sinais:
        if nome != "A3":
            s.fio_auto([(255, y), (X_COMP, y)], R[cor], "sig_" + nome)

    # ---------- divisor de tensao do HM-10 (A3 -> RXD) ----------
    yr = py(Y5, 1)
    s.fio_auto([(255, yr), (450, yr), (X_COMP, yr)], R["rosa"], "sig_A3")
    s.resistor(350, yr, "1k")
    s.ponto(450, yr, R["rosa"])
    lane = yr + 160
    s.fio_auto([(450, yr), (450, lane), (XG, lane)], cgnd, "GND")
    s.resistor(450, yr + 45, "1k", vertical=True)
    s.resistor(450, yr + 115, "1k", vertical=True)
    s.ponto(XG, lane, cgnd)
    s.texto(480, lane - 12, "divisor: 2 resistores de 1k em série até o GND", 15, "#a5a398")

    # ---------- energia: caixas -> protoboard 400 ----------
    def para_trilho(y, x_trilho, cor, net):
        s.fio_auto([(X_DIR, y), (x_trilho, y)], cor, net)
        s.ponto(x_trilho, y, cor)

    # GND comum entre o Arduino principal e o do leitor (3 fios no total: SDA, SCL e GND)
    s.fio_auto([(255, py(Y4, 2)), (X_COMP, py(Y4, 2))], cgnd, "GND")
    # fios do leitor ate o RC522 (retos)
    for i, cor in enumerate(["verde", "roxo", "azul", "amarelo", "rosa", "laranja", "cinza"]):
        net = "GND" if cor == "cinza" else f"rc{i}"
        s.fio_auto([(X_DIR, py(Y4, i)), (X_MOTOR, py(Y4, i))], R[cor], net)
    para_trilho(py(Y5, 1), XG, cgnd, "GND")
    para_trilho(py(Y6, 1), XG, cgnd, "GND")

    # ---------- motor: 5 fios da ULN2003 ate o motor ----------
    for k, cor in enumerate(["azul", "rosa", "amarelo", "laranja", "vermelho"]):
        y = Y1 + 85 + 20 * k
        s.fio_auto([(X_DIR, y), (X_MOTOR, y)], R[cor], f"motor{k}", 4)

    # ---------- protoboard 170: 5V dedicado e GND ----------
    def para_mini(y, x_faixa, cor, net, x_ini=X_DIR):
        s.fio_auto([(x_ini, y), (x_faixa, y)], cor, net)
        s.ponto(x_faixa, y, cor)

    para_mini(Y1 + 210, XBG, cgnd, "GND")                          # ULN2003 -
    para_mini(Y1 + 260, XB5, c5v, "5V")                            # ULN2003 +
    para_mini(Y2 + 170, XB5, c5v, "5V")                            # rele COM
    para_mini(Y2 + 220, XB5, c5v, "5V")                            # rele VCC
    para_mini(Y2 + 270, XBG, cgnd, "GND")                          # rele GND
    para_mini(py(Y2, 0), XBG, cgnd, "GND", x_ini=X_MOTOR + 220)    # bomba -
    s.fio_auto([(X_DIR, py(Y2, 0)), (X_MOTOR, py(Y2, 0))], c5v, "bomba_mais")   # NO do rele -> bomba +
    # HX711: o VCC vem da faixa de 5V da protoboard 170 (fonte separada), nao do Arduino
    y_hm, y_tap_hm = py(Y5, 0), Y2 + 295          # HM-10 VCC -> faixa B
    s.fio_auto([(X_DIR, y_hm), (1230, y_hm), (1230, y_tap_hm), (XB5, y_tap_hm)], c5v, "5V")
    s.ponto(XB5, y_tap_hm, c5v)
    y_vcc, y_tap = py(Y6, 0), Y2 + 322            # HX711 VCC -> faixa B
    s.fio_auto([(X_DIR, y_vcc), (1270, y_vcc), (1270, y_tap), (XB5, y_tap)], c5v, "5V")
    s.ponto(XB5, y_tap, c5v)
    # jumper entre a faixa A e a faixa B
    s.fio_auto([(XB5, ya_fim), (XB5 - 30, ya_fim), (XB5 - 30, yb_ini), (XB5, yb_ini)], c5v, "5V")
    s.ponto(XB5, ya_fim, c5v)
    s.ponto(XB5, yb_ini, c5v)
    s.texto(XB5 - 40, (ya_fim + yb_ini) / 2 + 5, "jumper", 13, "#e8e6dc", "end")
    # fonte -> faixas
    s.fio_auto([(XB5, Y1 + 110), (XB5, Y1 + 160)], c5v, "5V")
    s.fio_auto([(XBG, Y1 + 110), (XBG, Y1 + 160)], cgnd, "GND")
    # ponte de GND comum entre as duas protoboards
    y_ponte = Y1 + 330
    s.fio_auto([(XBG, y_ponte), (XG, y_ponte)], cgnd, "GND")
    s.ponto(XBG, y_ponte, cgnd)
    s.ponto(XG, y_ponte, cgnd)
    s.texto((XBG + XG) / 2 + 20, y_ponte - 12, "GND comum", 17, "#cfcdc2", "middle", "600")

    # ---------- celulas de carga ----------
    yb = Y6 + 190
    linhas = {"A+": yb + 50, "A−": yb + 86, "E−": yb + 122, "E+": yb + 158}
    cor_no = {"E+": R["vermelho"], "E−": R["preto"], "A−": R["verde"], "A+": R["branco"]}
    ordem_celula = [("vermelho", "E+"), ("preto", "E−"), ("verde", "A−"), ("branco", "A+")]
    nomes_no = [n for _, n in ordem_celula]
    topo_cel = yb + 210
    celulas_x = [640, 920, 1200, 1480]

    def x_pino(cx, j):
        return cx + 40 + 55 * j

    xhx = dict(zip(["E+", "E−", "A−", "A+"], xe))
    for no, ylin in linhas.items():     # barramentos primeiro: as celulas pulam por cima
        xs = [xhx[no]] + [x_pino(cx, nomes_no.index(no)) for cx in celulas_x]
        s.fio_auto([(xhx[no], Y6 + 190), (xhx[no], ylin), (max(xs), ylin)], cor_no[no], no)
    rotulo_fio = {"vermelho": "verm.", "preto": "preto", "verde": "verde", "branco": "branco"}
    for i, cx in enumerate(celulas_x):
        s.retangulo(cx, topo_cel, 250, 120, ESTILO["celula"][0], ESTILO["celula"][1])
        s.texto(cx + 125, topo_cel + 85, f"Célula {i+1} · 20 kg", 24, ESTILO["celula"][2], "middle", "600")
        for j, (nome_fio, no) in enumerate(ordem_celula):
            x = x_pino(cx, j)
            s.texto(x, topo_cel + 28, rotulo_fio[nome_fio], 14, ESTILO["celula"][3], "middle")
            s.fio_auto([(x, topo_cel), (x, linhas[no])], cor_no[no], no)
            s.ponto(x, linhas[no], cor_no[no])
    for no, x in xhx.items():
        s.ponto(x, Y6 + 190, cor_no[no], 6)

    # ---------- avisos ----------
    ny = topo_cel + 120 + 60
    avisos = [
        ("Protoboard 400 pontos: só o GND comum. Os pinos 5V e 3,3V do Arduino principal não são usados.", "#cfcdc2"),
        ("O RC522 fica num segundo Arduino (leitor-rfid, USB próprio) que fala com o principal por I2C: A4 com A4, A5 com A5 e GND com GND. Nunca ligue 5V com 5V.", "#cfcdc2"),
        ("Protoboard 170 pontos: todo o 5V vem da fonte separada (motor, relé, bomba, HX711 e HM-10). Cada faixa tem 5 furos: o 5V usa duas faixas ligadas por um jumper.", "#cfcdc2"),
        ("A ponte de GND comum entre as duas protoboards é obrigatória. Nunca ligue o +5V da fonte no 5V do Arduino.", AVISO),
        ("Relé de 3 pinos com transistor: liga com HIGH. Se ligar sozinho ao ligar o Arduino, troque NIVEL_BOMBA_LIGADA. Teste a bomba sem água.", ALERTA),
        ("4 células de 20 kg em paralelo: todos os fios da mesma cor vão no mesmo ponto (E+, E−, A−, A+). Peso negativo? Troque A+ com A−.", "#cfcdc2"),
        ("HM-10 no 5V (só se o módulo tiver regulador, 3.3V-6V). Os pinos de dados continuam 3,3V: divisor A3 → 1k → RXD, RXD → 1k → 1k → GND. TXD direto no D2.", "#cfcdc2"),
    ]
    for k, (t, c) in enumerate(avisos):
        s.texto(30, ny + k * 32, t, 19, c)
    s.h = ny + len(avisos) * 32 + 20
    s.salvar("0-ligacao-completa.svg")


if __name__ == "__main__":
    completo(); balanca(); rfid(); bomba(); motor(); alimentacao()
