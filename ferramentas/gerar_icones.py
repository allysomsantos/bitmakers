"""Gera os icones PNG dos dois apps, so com a biblioteca padrao do Python.
Uso (na raiz do repositorio):  python -I ferramentas/gerar_icones.py
"""
import struct
import zlib


def escrever_png(caminho, lado, cor_do_pixel):
    linhas = bytearray()
    for y in range(lado):
        linhas.append(0)  # filtro "nenhum" da linha
        for x in range(lado):
            linhas.extend(cor_do_pixel(x / lado, y / lado))

    def bloco(tipo, dados):
        corpo = struct.pack('>I', len(dados)) + tipo + dados
        return corpo + struct.pack('>I', zlib.crc32(tipo + dados) & 0xFFFFFFFF)

    cabecalho = struct.pack('>IIBBBBB', lado, lado, 8, 2, 0, 0, 0)  # 8 bits, RGB
    png = b'\x89PNG\r\n\x1a\n' + bloco(b'IHDR', cabecalho) + bloco(b'IDAT', zlib.compress(bytes(linhas), 9)) + bloco(b'IEND', b'')
    with open(caminho, 'wb') as arquivo:
        arquivo.write(png)


def dentro_do_circulo(x, y, cx, cy, raio):
    return (x - cx) ** 2 + (y - cy) ** 2 <= raio ** 2


def dentro_do_retangulo(x, y, x0, y0, x1, y1):
    return x0 <= x <= x1 and y0 <= y <= y1


def pixel_amicao(x, y):
    """Patinha branca sobre fundo verde."""
    branco, verde = (255, 255, 255), (47, 125, 79)
    almofada = dentro_do_circulo(x, y, 0.5, 0.64, 0.2)
    dedos = any(dentro_do_circulo(x, y, cx, cy, 0.09) for cx, cy in [(0.28, 0.42), (0.42, 0.3), (0.58, 0.3), (0.72, 0.42)])
    return branco if almofada or dedos else verde


def pixel_anjos(x, y):
    """Caminhao visto de cima, sobre fundo azul escuro."""
    fundo, cabine, carroceria = (30, 41, 59), (245, 158, 11), (226, 232, 240)
    if dentro_do_retangulo(x, y, 0.36, 0.2, 0.64, 0.38):
        return cabine
    if dentro_do_retangulo(x, y, 0.33, 0.4, 0.67, 0.8):
        return carroceria
    return fundo


if __name__ == '__main__':
    for lado in (192, 512):
        escrever_png(f'B1-Amicao/app/icone-{lado}.png', lado, pixel_amicao)
        escrever_png(f'B2-AnjosDaEstrada/app/icone-{lado}.png', lado, pixel_anjos)
    print('icones gerados')
