# Preparando o computador — Projetos Arduino BITMAKERS

Este guia prepara o computador para três coisas:
1. **Programar e gravar** no Arduino Uno de verdade.
2. **Simular** os projetos no Wokwi pelo terminal (sem placa).
3. **Continuar o desenvolvimento com o Claude Code** nesta pasta.

Os comandos estão para **Windows (PowerShell)**. Quando o comando for diferente no Linux/macOS, está indicado.

---

## 1. Arduino IDE 2 (para os alunos e para gravar na mão)

1. Baixe em https://www.arduino.cc/en/software e instale.
2. Abra a IDE, vá em **Ferramentas > Placa > Gerenciador de Placas** e confirme que **Arduino AVR Boards** está instalado.
3. Instale as bibliotecas em **Ferramentas > Gerenciar Bibliotecas**:
   - `LiquidCrystal I2C` (Frank de Brabander) — B1 e B2
   - `HX711 Arduino Library` (Bogdan Necula / bogde) — B1. Cuidado: buscar só "HX711" traz outra biblioteca (Rob Tillaart)
   - `MFRC522` (GithubCommunity / miguelbalboa) — B1
   - `Stepper` (Arduino) — B1

### Driver USB (importante para placas "clone")
A maioria dos Unos vendidos no Brasil usa o chip **CH340** em vez do chip original. Se o Windows não reconhecer a placa (nenhuma porta COM aparece em **Ferramentas > Porta**), instale o driver CH340/CH341. Procure por "CH340 driver" no site do fabricante WCH.

**Teste:** abra **Arquivo > Exemplos > 01.Basics > Blink**, selecione a placa **Arduino Uno** e a porta COM, e clique em Carregar. O LED da placa deve piscar.

---

## 2. Arduino CLI (o que o Claude Code usa para compilar e gravar)

A IDE 2 usa o arduino-cli por baixo, mas o Claude Code precisa dele disponível no terminal.

```powershell
winget install ArduinoSA.CLI
```
Linux/macOS: `curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh`

Feche e abra o terminal de novo, depois:

```powershell
arduino-cli config init
arduino-cli core update-index
arduino-cli core install arduino:avr
arduino-cli lib install "LiquidCrystal I2C" "HX711 Arduino Library" "MFRC522" "Stepper"
```

**Teste:** com a placa plugada,
```powershell
arduino-cli board list
```
deve mostrar a porta (ex.: `COM3`). Depois, de dentro da pasta de um projeto:
```powershell
cd B2-AnjosDaEstrada
arduino-cli compile --fqbn arduino:avr:uno --output-dir build .
arduino-cli upload  --fqbn arduino:avr:uno -p COM3 --input-dir build .
arduino-cli monitor -p COM3 -c baudrate=9600
```
(troque `COM3` pela porta que apareceu no `board list`)

---

## 3. Wokwi

### 3a. Wokwi no navegador (para os alunos consultarem)
Crie uma conta em https://wokwi.com. Cada pasta de projeto tem um `README.md` explicando como colar os arquivos e salvar. O link salvo é o que vai para os alunos.

### 3b. Wokwi CLI (para simular pelo terminal e pelo Claude Code)

```powershell
iwr https://wokwi.com/ci/install.ps1 -useb | iex
```
Linux/macOS: `curl -L https://wokwi.com/ci/install.sh | sh`

1. Faça login no wokwi.com e gere um token no **Wokwi CI Dashboard** (o link fica na documentação: https://docs.wokwi.com/wokwi-ci/getting-started). Confira no site se o seu plano inclui uso da CLI.
2. Salve o token como variável de ambiente **do usuário** (assim o Claude Code enxerga):
   ```powershell
   [Environment]::SetEnvironmentVariable("WOKWI_CLI_TOKEN", "SEU_TOKEN_AQUI", "User")
   ```
   Linux/macOS: adicione `export WOKWI_CLI_TOKEN=SEU_TOKEN_AQUI` no `~/.bashrc` ou `~/.zshrc`.
3. Feche e abra o terminal.

**Teste:**
```powershell
cd B2-AnjosDaEstrada
arduino-cli compile --fqbn arduino:avr:uno --output-dir build .
wokwi-cli --timeout 10000 .
```
Deve aparecer a saída do Monitor Serial da simulação (`distancia=... chuva=... luz=...`).

### 3c. (Opcional) Extensão Wokwi para VS Code
Se usar o VS Code, a extensão **Wokwi Simulator** abre o `diagram.json` visualmente e roda a simulação dentro do editor, usando o mesmo `wokwi.toml` de cada pasta. Ela pede uma licença na primeira vez; siga as instruções que aparecem.

---

## 4. Claude Code

1. Instale seguindo a documentação oficial: https://docs.claude.com/en/docs/claude-code/overview
2. Abra o terminal **na pasta `bitmakers-arduino`** e rode `claude`.
3. O Claude Code lê o `CLAUDE.md` automaticamente. Ele tem todo o contexto do projeto.
4. O arquivo `.mcp.json` já configura o **MCP do Wokwi** para este projeto. Na primeira vez, o Claude Code pergunta se você aprova esse servidor; aprove. Ele usa o `WOKWI_CLI_TOKEN` do passo 3b.

Para conferir: dentro do Claude Code, digite `/mcp` e veja se o `wokwi` aparece conectado.

> Não é preciso MCP para o Arduino: o Claude Code roda o `arduino-cli` direto pelo terminal (compilar, gravar e ler o Serial).

---

## 5. Checklist final

- [ ] Blink funcionou pela IDE
- [ ] `arduino-cli board list` mostra a placa
- [ ] `arduino-cli compile` funciona no B1 e no B2
- [ ] `wokwi-cli --timeout 10000 .` mostra saída serial no B2
- [ ] Projetos B1 e B2 salvos no wokwi.com, links anotados
- [ ] `claude` aberto na pasta `bitmakers-arduino`, `/mcp` mostra o Wokwi
