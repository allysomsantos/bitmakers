# App do Amicão (tablet)

App web (PWA) que roda no Chrome do tablet Android. Conversa com o totem por Bluetooth (HM-10, BLE): cadastra os cachorros, guarda o histórico de visitas e peso no próprio tablet e avisa quando um cachorro perde peso ou o reservatório de água acaba.

HTML, CSS e JavaScript puros, sem build e sem biblioteca. Os alunos não precisam editar o app: ele já vem pronto.

> **Situação:** o app foi testado por testes automáticos e pelo simulador no navegador. **Nunca foi testado com o HM-10 de verdade, nem no tablet.** Use o checklist no final e marque cada item quando fizer.

## Como abrir no tablet
1. O app precisa estar publicado em HTTPS (o Chrome só libera Bluetooth em HTTPS). Veja `docs/PUBLICAR.md` na pasta principal. **Ainda não foi publicado.**
2. No tablet, abra o endereço no **Chrome** (por exemplo `https://<usuario>.github.io/bitmakers-apps/amicao/`).
3. Menu ⋮ → **Instalar app** (ou "Adicionar à tela inicial"). Abra uma vez com internet; depois ele abre offline.
4. Ligue o totem, abra o app e toque em **Conectar**. Escolha **AMICAO** na lista (o nome é dado ao HM-10 conforme o `README.md` do projeto).

Se o Bluetooth cair, o app mostra "Desconectado" e **tenta reconectar sozinho a cada 3 segundos**. Enquanto estiver desconectado, as visitas **se perdem**: o Arduino não tem relógio nem guarda histórico.

## Como usar o simulador (sem Arduino)
Abra o app com `?sim=1` no final do endereço. Aparece um painel com um "Arduino falso" que segue as mesmas regras do firmware:
- escolha uma tag (inclusive uma de 7 bytes e uma "intrusa" que nunca é cadastrada), digite o peso e toque em **Encostar tag na balança**;
- botões para bomba ligou/desligou, reservatório vazio e Arduino reiniciou.

Para cadastrar um cachorro no simulador: **Cadastrar cachorro**, encoste uma tag no painel, dê nome e foto, salve. Depois encoste a mesma tag de novo para gerar visitas. Sete, seis, seis e seis kg em quatro visitas disparam o alerta de perda de peso.

Para rodar no computador, de dentro da pasta `app`:
```
python -m http.server 8081
```
e abra `http://localhost:8081/?sim=1`. (Em `localhost` o Service Worker não registra de propósito; só em HTTPS.)

## Como rodar os testes
De dentro da pasta `app` (precisa do Node.js, nada para instalar):
```
node --test "teste/*.test.js"
```
Cobrem o protocolo (linhas, blocos de 20 bytes, comandos), a regra do alerta de peso e o "Arduino falso". **Não** cobrem as telas nem o Bluetooth.

## Como atualizar o app
1. Mude o número de `VERSAO` no `sw.js` (por exemplo `amicao-v1` para `amicao-v2`). Sem isso o tablet continua com a versão antiga guardada.
2. Publique os arquivos de novo (`docs/PUBLICAR.md`).
3. O app instalado troca de versão na próxima abertura (às vezes é preciso abrir e fechar duas vezes).

## Dados e backup
Cachorros, fotos e visitas ficam **só neste tablet** (IndexedDB). Se limpar os dados do Chrome ou trocar de tablet, perde tudo. Em **Ajustes** há **Exportar backup** e **Importar**.

## Checklist de teste com hardware
Marque cada item quando fizer no tablet, com o HM-10 montado:

```
[ ] Pareia com o HM-10 (aparece AMICAO na lista)
[ ] Conecta e o selo "Conectado" aparece no topo
[ ] Desligar o Arduino: o app mostra desconectado e tenta reconectar sozinho (3 s)
[ ] Linhas chegam inteiras (sem JSON cortado) — conferir que os cards atualizam
[ ] Tela do tablet não apaga com o app aberto (Wake Lock)
[ ] B1: cadastrar um cachorro de verdade e conferir que o LCD mostra o nome
[ ] B1: tag que não está na lista não faz nada
```

Observações:
- O app do B1 pede Wake Lock ao tocar em **Conectar** (para a tela não apagar e o Bluetooth não cair), mas não toca som. Se o Chrome negar o Wake Lock, deixe o tempo de tela do tablet bem longo nas configurações.
- O app manda um comando por vez ao totem e espera a resposta (até 1,5 s). O totem lê os comandos durante as esperas, mas o movimento do motor da ração ainda bloqueia por alguns segundos.
