# Ligações do Amicão (montagem real)

Abra o `index.html` desta pasta para ver todos os desenhos juntos, ou os `.svg` um por um. Para mudar um desenho, edite `gerar_ligacoes.py` e rode `python gerar_ligacoes.py`.

| Desenho | Etapa |
|---|---|
| `0-ligacao-completa.svg` | tudo junto: Arduino, protoboard de 400 pontos (só o GND comum), protoboard de 170 pontos (todo o 5V, da fonte separada) e o segundo Arduino do RFID (I2C) |
| `1-balanca-hx711.svg` | 4 células de 20 kg (4 fios cada) + HX711 (A0, A1) |
| `2-rfid-rc522.svg` | RC522 no Arduino do leitor (D9 a D13, 3.3V); o principal só fala com ele por I2C (A4, A5, GND) |
| `3-bomba-rele.svg` | bomba d'água com módulo relé (D3) |
| `4-motor-de-passo.svg` | 28BYJ-48 + ULN2003 (D4 a D7) |
| `5-alimentacao.svg` | fonte 12V, Arduino e LM2596 |

O Bluetooth HM-10 segue o desenho do Anjos da Estrada, com **uma diferença**: no Amicão o fio que vai ao RXD (com o divisor 1k/2k) sai do **A3**, não do D3. O D3 é da bomba. O TXD do HM-10 vai no D2, igual ao B2.

## Balança com 4 células

O tutorial da UsinaInfo usa **uma** célula de 5 kg com 4 fios: vermelho em E+, preto em E−, verde em A−, branco em A+. As suas são 4 células de 20 kg com os mesmos 4 fios, então o desenho liga as quatro **em paralelo**: todos os vermelhos juntos em E+, todos os pretos em E−, todos os verdes em A− e todos os brancos em A+. O HX711 enxerga uma célula só, com capacidade somada (até 80 kg).

- As cores dependem do fabricante. Se o peso sair negativo, troque os fios A+ e A−.
- Essa ligação não corrige diferença entre as células: o peso pode variar um pouco conforme o cachorro pisa mais perto de um canto. Teste com o mesmo peso no centro e nos cantos antes de apresentar.
- A seta gravada em cada célula deve apontar para baixo, e o centro da célula precisa ficar livre (use espaçadores). As 4 precisam estar na mesma altura, com a plataforma rígida em cima.
- Depois de montar, calibre de novo (seção "Calibrando a balança" do README do projeto).

## Bomba com relé

Sem sensor de nível: a bomba liga junto com a ração, quando uma tag cadastrada é lida, por `TEMPO_BOMBA` (calibre pelo tamanho do pote). Só repete depois de `INTERVALO_AGUA`, para não transbordar.

- O D8 não é mais usado.
- O módulo usado (1 canal, SRD-05VDC-SL-C, header IN/GND/VCC, transistor, sem optoacoplador) liga com `HIGH`, e o sketch já está assim. Se o relé ligar sozinho quando o Arduino liga (LED vermelho aceso), o seu liga com `LOW`: troque `NIVEL_BOMBA_LIGADA`.
- O diodo 1N4007 fica em paralelo com a bomba, com a faixa no lado do `+`.

## Fonte de 5V separada

Tudo que é 5V vai na fonte separada (2A ou mais): `+` do ULN2003, VCC e COM do relé, retorno da bomba e VCC do HX711 e VCC do HM-10 (só se o módulo tiver regulador, "3.3V-6V"). O RC522 fica no 3,3V do Arduino do leitor (segundo Arduino, USB próprio); no principal, nem o 5V nem o 3,3V são usados. O GND da fonte vai no GND do Arduino. Nunca ligue o +5V da fonte no pino 5V do Arduino. Veja `5-alimentacao.svg`.
