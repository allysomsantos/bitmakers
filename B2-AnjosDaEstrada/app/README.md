# App do Anjos da Estrada (tablet na cabine)

App web (PWA) que roda no Chrome do tablet Android. Recebe as leituras do kit por Bluetooth (HM-10, BLE) e mostra o caminhão visto de cima, com a distância dos 4 cantos, os dois faróis e a pista (seca ou molhada). Toca sons de alerta pelo tablet e **não guarda histórico**.

HTML, CSS e JavaScript puros, sem build e sem biblioteca. Os alunos não precisam editar o app: ele já vem pronto.

> **Situação:** o app foi testado por testes automáticos e pelo simulador no navegador. **Nunca foi testado com o HM-10 de verdade, nem no tablet.** O som, o volume e o Wake Lock no tablet também não foram testados. Use o checklist no final e marque cada item quando fizer.

## Como abrir no tablet
1. O app precisa estar publicado em HTTPS (o Chrome só libera Bluetooth em HTTPS). Veja `docs/PUBLICAR.md` na pasta principal. **Ainda não foi publicado.**
2. No tablet, abra o endereço no **Chrome** (por exemplo `https://<usuario>.github.io/bitmakers-apps/anjos/`).
3. Menu ⋮ → **Instalar app** (ou "Adicionar à tela inicial"). Abra uma vez com internet; depois ele abre offline.
4. Ligue o kit, abra o app, **deixe o volume de mídia do tablet no alto** e toque em **Conectar**. Escolha **ANJOS** na lista (o nome é dado ao HM-10 conforme o `README.md` do projeto).

O toque em **Conectar** também libera o som (o Chrome exige um toque) e liga o Wake Lock, que pede para a tela não apagar. O app **não controla o volume** do tablet.

## O que cada coisa significa na tela
- **Cards de distância** (frente e trás, esquerda e direita): verde = livre (mais de 20 cm), amarelo = atenção (20 a 10 cm), vermelho = crítico (menos de 10 cm). Sempre com cor, ícone e texto juntos. Escala de protótipo; no caminhão real, ×10.
- **Sons:** atenção = bipes cada vez mais rápidos (o intervalo cai de 600 ms a 20 cm para 200 ms a 10 cm; a 12 cm são 280 ms); crítico = tom contínuo. O som de proximidade segue o sensor **mais perto**.
- **Alertas** (faixa vermelha no topo): "Pista molhada" e "Farol esquerdo/direito queimado". Tocam um tom duplo ao aparecer e **repetem a cada 10 s** enquanto durarem; somem sozinhos. Pista molhada sobe, farol queimado desce. Alerta não toca enquanto o tom contínuo de crítico estiver ligado.
- **Sem sinal:** sem linha do kit por mais de 3 s, o app silencia, deixa os cards cinza e mostra "Sem comunicação com o caminhão".
- **Botão de som** no topo: liga e desliga todo o som.
- Se o Bluetooth cair, o botão **Conectar** volta e o app **tenta reconectar sozinho a cada 3 segundos**.

## Como usar o simulador (sem Arduino)
Abra o app com `?sim=1` no final do endereço e toque em **Conectar** (isso liga o "caminhão falso" e libera o som). Aparece um painel com:
- uma barra de distância para cada um dos 4 sensores (40 = livre);
- caixas para pista molhada e "LED removido" de cada farol (o farol fica sempre ligado: LED removido = farol queimado);
- **Pausar** para simular a perda de sinal.

Para rodar no computador, de dentro da pasta `app`:
```
python -m http.server 8082
```
e abra `http://localhost:8082/?sim=1`. (Em `localhost` o Service Worker não registra de propósito; só em HTTPS.)

## Como rodar os testes
De dentro da pasta `app` (precisa do Node.js, nada para instalar):
```
node --test "teste/*.test.js"
```
Cobrem o protocolo (linhas e leitura), as faixas de distância e o "caminhão falso". **Não** cobrem as telas, o som nem o Bluetooth.

## Como atualizar o app
1. Mude o número de `VERSAO` no `sw.js` (por exemplo `anjos-v1` para `anjos-v2`). Sem isso o tablet continua com a versão antiga guardada.
2. Publique os arquivos de novo (`docs/PUBLICAR.md`).
3. O app instalado troca de versão na próxima abertura (às vezes é preciso abrir e fechar duas vezes).

## Onde ficam as faixas
As distâncias de atenção e crítico ficam só no app (`js/faixas.js`, para cores e sons). O Arduino só manda a distância medida. O sketch de teste `testes/teste-sensores` tem uma cópia para o Monitor Serial: se mudar no app, mude lá também.

## Checklist de teste com hardware
Marque cada item quando fizer no tablet, com o HM-10 montado:

```
[ ] Pareia com o HM-10 (aparece ANJOS na lista)
[ ] Conecta e o botão "Conectar" some e os cards mostram valores (sem "Sem comunicação")
[ ] Desligar o Arduino: o app mostra "Sem comunicação" e o botão Conectar volta; ligar de novo: ele reconecta sozinho (3 s)
[ ] Linhas chegam inteiras (sem JSON cortado) — conferir que os cards atualizam
[ ] Tela do tablet não apaga com o app aberto (Wake Lock)
[ ] Som sai no volume de mídia do tablet
[ ] Aproximar a mão de cada um dos 4 sensores: o card certo muda e o som acompanha o mais perto
[ ] Tirar o LED da protoboard dispara "Farol ... queimado" (alerta e tom no tablet)
```
