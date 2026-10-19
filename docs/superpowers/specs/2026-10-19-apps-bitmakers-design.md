# Apps BITMAKERS — design (B1 Amicão e B2 Anjos da Estrada)

Data: 2026-10-19. Status: implementado na branch `feat/apps-bitmakers` (apps e firmwares). Esta spec foi atualizada no fim com o que a implementação refinou. Ver a seção 7 para o que **não** foi testado.

## 1. Objetivo e escopo

Dois apps para tablet Android, um por projeto, **entregues prontos** aos alunos. Os alunos não editam o app (não faz parte do plano de ensino); eles montam o hardware.

- **B1 Amicão**: cadastrar tags dos cachorros, ver histórico de visitas e peso, alerta de perda de peso.
- **B2 Anjos da Estrada**: painel do motorista com sensores em tempo real, caminhão desenhado, alertas sonoros e visuais, **sem histórico**.

Inclui também o **ajuste mínimo dos dois `.ino`** para falar o protocolo novo (HM-10, JSON, EEPROM no B1; 4 sensores, INA219 e chaves no B2). O ajuste do firmware é a última etapa. Os dois sketches compilam; a simulação no Wokwi **não foi executada** (ver seção 7).

Fora de escopo: nuvem, notificação push, vários tablets, alerta "sumiu", resumo do dia, nível de ração/pote, histórico no B2, edição do app pelos alunos.

## 2. Decisões que mudam o hardware (registradas aqui)

| Item | Decisão |
|---|---|
| Rádio | **HM-10 (BLE)** nos dois projetos, no lugar do HC-06. HC-06 é Bluetooth Classic e não conecta em web app. |
| B1 tag desconhecida | **Ignorada em silêncio** fora do modo cadastro. |
| B2 impacto e pouca luz | **Removidos** (sem SW-18010P, sem LDR). |
| B2 buzzer | **Removido**. Som sai pelo tablet. |
| B2 proximidade | **4 HC-SR04**: frente esq/dir, trás esq/dir. Substitui o ponto cego lateral. |
| B2 lâmpadas | **2 chaves que travam** + 2 LEDs, cada LED atrás de um **INA219** (0x40 e 0x41). Plano B se faltar pino: 1 lâmpada. |
| B2 distâncias | Atenção ≤ 15 cm, crítico < 5 cm (escala de protótipo; no caminhão real, ×10). |
| B1 peso | Pelúcia com pesos diferentes e a mesma tag, só para demonstrar o alerta. |

Lista de compras resultante do B2: 4 HC-SR04, 2 INA219, 2 chaves, 2 LEDs, 1 LED de alerta, 1 FC-37, 1 LCD, 1 HM-10, 2 resistores 10k, resistores 220Ω e divisor 1k/2k. Cada projeto precisa de 1 HM-10 (2 no total).

## 3. Base comum

- HTML, CSS e JS puros, **sem build e sem biblioteca externa**. ES modules.
- PWA (`manifest.webmanifest` + `sw.js`): abre offline depois da primeira visita.
- Publicação em HTTPS (GitHub Pages) porque Web Bluetooth exige contexto seguro; em desenvolvimento, `localhost`.
- Requisito do tablet: **Android com Chrome**.
- Um app por pasta, dentro do projeto. O `ble.js` fica **duplicado** nas duas pastas de propósito (regra do projeto: nunca misturar).

```
B1-Amicao/app/
  index.html  estilo.css  manifest.webmanifest  sw.js  icone.svg  icone-192.png  icone-512.png
  package.json   (so serve para os testes: marca a pasta como ES module)
  js/app.js  js/ble.js  js/banco.js  js/dom.js  js/foto.js  js/pesos.js
  js/protocolo.js  js/arduino-falso.js  js/simulador.js  js/telas.js
  teste/arduino-falso.test.js  teste/pesos.test.js  teste/protocolo.test.js
  README.md

B2-AnjosDaEstrada/app/
  index.html  estilo.css  manifest.webmanifest  sw.js  icone.svg  icone-192.png  icone-512.png
  package.json   (so serve para os testes)
  js/app.js  js/ble.js  js/dom.js  js/protocolo.js  js/faixas.js  js/caminhao.js
  js/caminhao-falso.js  js/tela.js  js/som.js  js/simulador.js
  teste/caminhao-falso.test.js  teste/faixas.test.js  teste/protocolo.test.js
  README.md

ferramentas/gerar_icones.py   (gera os PNG dos icones a partir do desenho; roda uma vez)
```
`dom.js` (funcao `h` para montar elementos) existe nos dois apps, duplicado de proposito. `arduino-falso.js` (B1) e `caminhao-falso.js` (B2) fazem o papel do Arduino no simulador; `foto.js` (B1) reduz a foto do cachorro; `tela.js` (B2) monta a tela do caminhao e os cards.

### 3.1 BLE (`ble.js`)
- Serviço `0xFFE0`, característica `0xFFE1` (HM-10): notificações de entrada, escrita sem resposta de saída.
- `requestDevice` com `acceptAllDevices` e `optionalServices: [0xFFE0]` (o HM-10 nem sempre anuncia o serviço).
- Entrada: acumula bytes e entrega linha completa a cada `\n`. Saída: quebra em blocos de 20 bytes.
- Botão "Conectar" (o Chrome exige gesto). Se desconectar, tenta reconectar a cada 3 s enquanto a página estiver aberta.
- Linhas que não são JSON válido são descartadas sem erro.

### 3.2 Simulador
BLE e simulador entregam texto à **mesma função** `receberLinha(texto)`. O simulador (painel aberto com `?sim=1`) gera as linhas do protocolo com botões e controles deslizantes. O que se testa no navegador é o caminho real do app.

### 3.3 Módulos puros
`protocolo.js`, `pesos.js` e `faixas` (B2) **não tocam em DOM nem BLE**, para testar com `node --test` sem dependências.

## 4. B1 Amicão

### 4.1 Protocolo (uma linha JSON por evento, 9600 baud)

Arduino → app:
```
{"evento":"ligado"}
{"evento":"visita","uid":"0A:0B:0C:0D","peso_kg":7.0,"racao":true}      // peso_kg pode ser null
{"evento":"agua","bomba":"ligada"}  /  {"evento":"agua","bomba":"desligada"}
{"evento":"alerta","tipo":"reservatorio_vazio"}
{"evento":"modo_cadastro","ativo":true}                                    // ativo:false ao expirar (30 s), ao cancelar ou depois de ler uma tag
{"evento":"tag_lida","uid":"0A:0B:0C:0D"}                                  // só dentro do modo cadastro
{"evento":"cadastros","uids":["0A:0B:0C:0D"]}                              // resposta a listar, permitir e remover
```
App → Arduino:
```
{"cmd":"cadastrar"}   {"cmd":"cancelar"}   {"cmd":"listar"}
{"cmd":"permitir","uid":"0A:0B:0C:0D","nome":"Rex"}   // nome sem acento, até 10 caracteres
{"cmd":"remover","uid":"0A:0B:0C:0D"}
```

### 4.2 Regras de cadastro
- **O app é a fonte da verdade.** O Arduino guarda na EEPROM até 10 tags: UID de **4 ou 7 bytes** (NTAG tem 7) + nome de 10 caracteres (usado no LCD), 18 bytes por slot (10 slots).
- Fora do modo cadastro, tag que não está na lista **não gera evento, LCD, ração nem Serial**.
- Ao conectar, o app envia `listar` e reconcilia: UID que só existe no Arduino recebe `remover`; UID que só existe no app recebe `permitir`.
- Tablet sem cachorros ligado a um totem que já tem tags: o app **pergunta** antes de apagar as tags do Arduino.
- Se o app receber `visita` de UID que não conhece, ignora.
- Cadastro é feito por quem está com o tablet; não há senha no protótipo.

### 4.3 Telas
- **Início**: faixa de status (conectado/desconectado, bomba), banners de alerta, um card por cachorro (foto, nome, "comeu hoje", último peso com seta subiu/desceu, selo de alerta), botão "Cadastrar cachorro".
- **Detalhe**: foto, nome, gráfico de peso em SVG, lista de visitas (data e hora carimbadas pelo app, peso, "comeu" ou "só passou").
- **Cadastro**: envia `cadastrar`, mostra contagem regressiva de 30 s, "encoste a tag no leitor". Ao chegar `tag_lida`, pede nome e foto (câmera do tablet, reduzida para ~200 px JPEG), salva e envia `permitir`.
- **Ajustes**: conectar, limiares do alerta de peso, remover cachorro (envia `remover`), exportar e importar backup (JSON).
- Sem indicador de nível de ração ou de pote (o projeto não tem sensor para isso).

### 4.4 Dados (IndexedDB, só no tablet)
- `cachorros`: `uid` (chave), `nome`, `foto`, `criadoEm`.
- `visitas`: `id` automático, `uid`, `quando` (ISO), `peso_kg` (ou null), `racao` (bool).
- `config`: `quedaPercentual` = 5, `janelaRecente` = 3, `janelaAnterior` = 5, `minimoVisitas` = 4.

### 4.5 Alerta "perdeu peso"
Considera só visitas com `peso_kg` diferente de null. `recente` = últimas 3; `anterior` = até 5 visitas imediatamente antes dessas.
Dispara se houver **no mínimo 4 visitas válidas** e `mediaRecente <= mediaAnterior × (1 − 5%)`. É recalculado a cada visita e **some sozinho** se a média se recuperar.
Demonstração com a pelúcia: leituras 7, 6, 6, 6 kg disparam o alerta (queda de ~14%).

### 4.6 Alerta "reservatório vazio"
Banner fixo até o usuário tocar "Entendi" ou chegar `agua` com `bomba: "ligada"`. Não é gravado.

### 4.7 Desconexão
BLE só entrega com o tablet conectado. **Visita sem conexão se perde** (o Arduino não tem relógio nem histórico). O app mostra a faixa "Desconectado: visitas não estão sendo registradas".

## 5. B2 Anjos da Estrada

### 5.1 Protocolo (uma linha a cada ~500 ms, Arduino → app)
```
{"frente_esq":12,"frente_dir":null,"tras_esq":4,"tras_dir":30,"chuva":true,"farol_e":"ok","farol_d":"queimado"}
```
- Distâncias em cm; `null` = sem eco ou fora de alcance (tratado como livre).
- `chuva`: `true` ou `false`.
- `farol_e` e `farol_d`: `"desligado"`, `"ok"` ou `"queimado"`.
- App → Arduino: nada.

### 5.2 Faixas de proximidade (constantes no topo)
`DIST_ATENCAO = 15`, `DIST_CRITICO = 5`, `DIST_MINIMA_VALIDA = 2`.

| Distância | Estado | Card e zona | Som |
|---|---|---|---|
| > 15 cm ou `null` | livre | verde | silêncio |
| 15 a 5 cm | atenção | amarelo | bipes de 880 Hz (80 ms); intervalo cai linearmente de 600 ms (15 cm) para 200 ms (5 cm) |
| < 5 cm (inclui < 2 cm) | crítico | vermelho piscando | tom contínuo de 1 kHz |

O som de proximidade segue o **menor** valor entre os 4 sensores.

Na implementação, o intervalo é `200 + (cm - 5) / 10 * 400` ms: 480 ms a 12 cm. Como o app confere o som a cada 50 ms, o intervalo observado fica perto de 500 ms nesse caso.

### 5.3 Alertas
- **Pista molhada** (`chuva: true`) e **farol queimado** (`"queimado"`): banner vermelho fixo, com o nome do item ("Farol esquerdo queimado"), que **some sozinho** quando a condição acaba. Nada é gravado.
- Som: tom duplo ao aparecer e **repetido a cada 10 s** enquanto durar. Pista molhada usa sequência ascendente, farol queimado usa descendente (distintos entre si). Tom de alerta **não toca enquanto o tom contínuo de crítico estiver ativo**; toca no próximo ciclo.
- **Sem sinal**: sem linha por mais de 3 s, o app silencia, cinza todos os cards e mostra "Sem comunicação com o caminhão".

### 5.4 Tela (paisagem, tela única)
Caminhão em **SVG redesenhado, visto de cima, frente para cima**, no centro. Esquerda do caminhão = esquerda da tela.
- Coluna esquerda: Frente esq, Farol esq, Trás esq. Coluna direita: espelhada.
- Cada card de distância mostra o número em cm; a zona no caminhão acende com a mesma cor.
- Cada farol mostra desligado, ok ou queimado, com o ícone no caminhão.
- Estado sempre com **cor, ícone e texto** juntos.
- Botão **Mudo** fixo no canto. O botão **Conectar** some quando conecta, e o banner "Sem comunicação com o caminhão" avisa a falta de sinal.
- Botão "Conectar" também **libera o áudio** (gesto exigido pelo Chrome) e ativa o **Wake Lock** para a tela do tablet não apagar.
- O app não controla o volume de mídia do tablet.

## 6. Ajustes de firmware (última etapa)

### B1
- HM-10 no lugar do HC-06, mesmos pinos (RX D2 ← TXD, TX A3 → RXD com divisor 1k/2k). Sem HM-10 no Wokwi: segue saindo no Serial com `APP> `.
- Lista de tags autorizadas na EEPROM (10 × 18 bytes: tamanho do UID, UID de até 7 bytes, nome de 10 caracteres); remove a lista fixa `cachorros[]`.
- Modo cadastro de 30 s; comandos lidos por busca de texto simples (sem biblioteca JSON, por causa dos 2 KB de RAM).
- Tag fora da lista: nenhuma ação.
- Intervalo de ração e peso: sem mudança.

### B2
- Remove SW-18010P (D2), LDR (A1) e buzzer (D8); remove a lógica de prioridade do LCD ligada a eles. Ordem do LCD: proximidade crítica > proximidade em atenção > farol queimado > pista molhada > "Tudo OK".
- Plano de pinos: HM-10 RX D2, TX D3 (SoftwareSerial); HC-SR04 frente esq 4/5, frente dir 6/7, trás esq 8/9, trás dir 10/11 (TRIG/ECHO); LED de alerta D12; FC-37 A0; chave esquerda A1, chave direita A2; I2C A4/A5 (LCD 0x27, INA219 0x40 e 0x41). Livres: D13 e A3.
- Cada chave: 5V → chave → (derivação para o pino com 10k para GND) → INA219 → 220Ω → LED → GND. Farol `queimado` = chave ligada e corrente < `LIMIAR_CORRENTE_MA` (3 mA), confirmado em 3 leituras seguidas.
- Leitura dos 4 sensores **um por vez**, ~50 ms entre eles, para um não ouvir o eco do outro.
- O Wokwi não tem INA219. Com `SIMULACAO 1`, os pinos D13 e A3 (livres) viram duas chaves "LED removido" (esquerda e direita): chave na direita = LED tirado = corrente 0. Com `SIMULACAO 0`, o sketch lê os INA219 de verdade (registrador de tensão do shunt, 0x40 e 0x41).

## 7. Testes
- **Automáticos** (`node --test`, sem dependência): `protocolo.js` (parse, linhas inválidas, chunking), `pesos.js` (alerta de peso: 4 leituras, queda de 14%, `null`, recuperação), `faixas` do B2 (limites 15, 5, 2 e `null`).
- **No navegador**, pelo simulador: telas, cadastro completo (modo cadastro, `tag_lida`, `permitir`), alertas, banner "sem sinal", som, mudo.
- **Só no tablet, com hardware** (checklist no README do app): pareamento do HM-10, 20 bytes por pacote, reconexão, Wake Lock, volume. **Nada disso foi testado enquanto o HM-10 não estiver montado.**
- Firmware: compilar com `arduino-cli`, simular com `wokwi-cli` e conferir o Serial. **Situação real:** os dois sketches compilam (B1 usa 57% da RAM, B2 41%), mas a simulação não foi executada: o `wokwi-cli` respondeu "API Error: Unauthorized" (token inválido). Os `cenario.yaml` foram reescritos e nunca rodaram. O layout e as posições das peças do `diagram.json` do B2 também não foram conferidos visualmente.

## 8. Pendências abertas
1. Conta e repositório do GitHub Pages para publicar (decisão do Allysom).
2. ~~Atualizar `CLAUDE.md`~~ (feito).
3. ~~Conferir se o INA219 tem dublê no Wokwi~~: não tem; foram usadas as chaves "LED removido" em D13 e A3.
4. Calibração real: `LIMIAR_CORRENTE_MA`, `LIMITE_CHUVA`, limiares de distância.
5. Gerar um novo token do Wokwi CLI e rodar os dois cenários (`wokwi-cli --timeout 90000 --scenario cenario.yaml --serial-log-file serial.log .` dentro de cada projeto).
