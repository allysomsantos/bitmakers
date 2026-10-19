# Briefing: deixar as páginas mais simples (versão 2 do manual)

As 22 páginas do manual já existem e já estão **reordenadas do mais simples ao mais difícil**.
O professor pediu: *"pra não explodir a cabeça dos alunos"*, **aliviar um pouco a parte extremamente técnica**.
Sua tarefa: **reescrever as páginas que lhe couberem** (JSON + os textos dos SVG) mais simples, mantendo tudo certo.

Leia antes: `BRIEFING.md` (esquema, limites, fatos dos projetos, como verificar). Aqui só mudam o **tom** e o **nível técnico**.

## Ordem e níveis (já aplicados nos nomes dos arquivos e no campo `nivel` do JSON)
| Nível | Nome | Páginas |
|---|---|---|
| 1 | Primeiros passos | 01 Arduino Uno · 02 Protoboard e jumpers · 03 Botão e interruptor · 04 LED · 05 Resistor · 06 Buzzer |
| 2 | O Arduino sente e mostra | 07 LDR · 08 Vibração SW-18010P · 09 FC-37 · 10 HC-SR04 · 11 LCD I2C |
| 3 | Dar força e movimento | 12 Fonte 5 V · 13 Motor 28BYJ-48 · 14 Bomba d'água · 15 ULN2003 · 16 L9110S |
| 4 | Identificar, medir e conversar | 17 Tag NFC · 18 RC522 · 19 Célula de carga · 20 HX711 · 21 HC-06 · 22 INA219 |

O aluno lê as páginas nessa ordem: **você pode apoiar-se no que vem antes** ("já vimos o resistor na página 05") e **nunca
use um conceito que só aparece depois** sem explicar na hora.

## O que muda (regras)
1. **Leitor**: aluno de 12 a 17 anos, primeiro contato. Nível 1 = zero jargão. Nível 4 = ainda é o mais difícil, mas bem mais leve do que hoje.
2. **Linguagem do dia a dia + analogia**: torneira, caminhão-pipa, sinal de trânsito, ônibus, interruptor da sala, eco na quadra.
   Frases curtas, voz ativa, até 20 palavras por frase.
3. **Termos técnicos**: pode manter o nome certo (é o que o aluno vai ler no datasheet), mas **explique em palavras simples na
   primeira vez**: "UID, o número de identidade da tag". Termos que ficam: nomes das peças, V, mA, Ω, 5 V, GND, pino, Serial.
4. **Tirar dos textos** (pode manter na `ligacao`/`pinos` quando for pino de verdade): nome de chip interno (PCF8574, LM393, Darlington,
   ATmega...), nomes de teoria (ponte de Wheatstone, shunt, ponte H, piezoelétrico, extensômetro, diodo de proteção/fly-back),
   unidades difíceis (µs, kHz, MHz, baud, mV/V, bits) e fórmulas com letras (V = R × I vale; Vsaída = Ventrada × R2 ÷ (R1+R2) não).
   Troque por ideia: "bem rápido", "um sinalzinho fraco", "metade da tensão".
5. **`formula`** vira uma **"regra de ouro"**: uma frase simples que o aluno guarda. No máximo UMA conta curtinha e só se ela
   for o coração da peça (Lei de Ohm no resistor/LED; distância = tempo ÷ 58 pode virar "quanto mais demora o eco, mais longe").
6. **`ficha`**: no máximo **4 linhas**, em palavras simples ("Liga em: 5 V", "Alcance: até 4 m", "Cuidado: nunca 5 V"). Sem valores de
   datasheet que o aluno não vai usar.
7. **`passos`**: 4 a 5 passos, até 65 caracteres cada, verbo no começo, em ordem de acontecimento.
8. **`onde_vive`**: 3 itens, coisas que o aluno **conhece** (celular, elevador, geladeira, jogo, carro). Nada de "instrumentação industrial".
9. **`cuidados`**: 3 itens práticos ("o que dá errado e como evitar"), sem teoria.
10. **`desafio`**: ajuste ao nível.
   - Nível 1: observação ou escolha ("o que acontece se...?"), no máximo uma conta de uma operação.
   - Nível 2: uma conta simples ou um raciocínio de 2 passos.
   - Nível 3 e 4: pode ter uma conta, **com dica** na pergunta. A `resposta` explica em uma ou duas frases fáceis.
   A resposta precisa estar CERTA (confira).
11. **No projeto** (`no_projeto`): conte **a história** ("o Rex sobe na balança, o totem descobre quem é...") em vez de lista de parâmetros.
   Mantenha pinos e limites reais do projeto (100 cm / 40 cm, 5 s, etc.) só onde o aluno vai precisar deles.
12. **Não perca conteúdo importante**: o que a peça faz, por que está no projeto, como liga e o que pode dar errado continuam todos na página.
    Só sai a camada "por dentro do componente" que não ajuda o aluno a montar e entender.
13. Honestidade: ressalvas reais continuam (ex.: FC-37 detecta gotas, não a pista; célula 20 kg vs 50 kg; UID pode ser copiado;
    SW-18010P dispara com vibração do motor). Diga de modo simples.
14. Sem emojis, sem sub/sobrescritos Unicode, acentuação correta.

## Limites de tamanho (mais apertados que o BRIEFING.md; menos texto cabe melhor e é mais fácil de ler)
`o_que_e` <= 200 · `pra_que_serve` <= 170 · `onde_vive` 3 itens <= 85 cada · `legenda_peca` <= 60 · `ficha` <= 4 linhas ·
`passos` 4–5 itens <= 65 · `formula` <= 140 · `no_projeto.texto`: 1 projeto <= 300, 2 projetos <= 170 cada · `cuidados` 3 itens <= 85 ·
`desafio` <= 200 · `resposta` <= 170. (Se uma página pedir um pouco mais, pode; o que decide é a verificação de folha.)

## Os desenhos (SVG)
- Abra os dois SVG da peça e **tire o que for jargão ou fórmula** (ex.: "Vsaída = ...", nomes de chip, "24 bits", formas de onda com µs).
  Troque por rótulos simples e **aumente a fonte** dos que ficaram (mínimo 9 unidades).
- Se um desenho "por dentro" for pesado demais para o nível da página, **simplifique o desenho** (menos elementos, setas e blocos
  claros com 3 a 4 etapas numeradas que combinem com os `passos`). Redesenhar do zero é permitido.
- Continue com `viewBox` 300×190 (peça) e 420×200 (funciona), ids de `marker` únicos com prefixo do slug.
- O que ficar no desenho precisa ser verdadeiro.

## Exemplo de antes e depois (HC-SR04, nível 2)
Antes — `passos`: "O sensor dispara 8 apitos de 40 kHz, agudos demais para nós." / `formula`: "distância (cm) = tempo (µs) ÷ 58. O som anda 0,0343 cm por µs e faz ida e volta..."
Depois — `passos`: "O Arduino manda o sensor apitar (um apito que a gente não ouve)." / "O apito bate no objeto e volta como eco." / "O Arduino cronometra quanto tempo o eco demorou." /
`formula` (regra de ouro): "Eco demorou mais = objeto mais longe. Eco rápido = objeto pertinho (como gritar numa quadra e ouvir a resposta)." (a divisão por 58 vira nota curta no `desafio`.)
Antes — `ficha`: Tensão 5 V · Corrente cerca de 15 mA · Alcance 2 cm a 400 cm · Ângulo cerca de 15 graus · Frequência 40 kHz.
Depois — `ficha`: Liga em: 5 V · Alcance: de 2 cm até 4 m · Enxerga: só o que está bem na frente · Pinos: 4.

## Como conferir (igual ao briefing anterior)
`python montar.py --apenas 07-ldr,08-sw-18010p --verificar`  (use os ids das SUAS páginas; folga >= 1 mm)
e depois olhe as páginas em imagem (`saida/previa-...pdf` -> PNG, instruções no BRIEFING.md). Corrija até ficar bom.
Não edite `montar.py`, `estilo.css`, nem páginas de outros colegas.

## O que reportar no final
Lista curta: páginas reescritas, folga de cada uma, e **o que você tirou de importante** (se tirou) ou o que o professor deve conferir.
