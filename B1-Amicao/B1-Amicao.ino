/*
  AMICAO — BITMAKERS B1
  Totem comedouro/bebedouro que identifica cada cachorro pela tag da coleira,
  registra o peso e manda os dados pro aplicativo.

  Componentes:
    - RC522 .............. le a tag NFC da coleira
    - Celula de carga + HX711 ... balanca
    - 28BYJ-48 + ULN2003 . dosador de racao   (no Wokwi: motor de passo comum)
    - Rele + bomba ....... enche o pote de agua (no Wokwi: LED azul)
    - Bluetooth HM-10 .... (BLE) manda cada evento pro app no tablet e recebe comandos do app

  Este arquivo esta configurado para a MONTAGEM REAL (SIMULACAO 0), pronto para o app no tablet.
  Para simular no Wokwi, mude SIMULACAO para 1.

  Antes do primeiro uso: calibre a balanca com testes/teste-geral (comando k) e
  copie o numero para FATOR_BALANCA, abaixo.
*/

#define SIMULACAO 0   // 1 = Wokwi   |   0 = montagem real

// Onde fica o leitor de tags?
//   0 = RC522 ligado neste mesmo Arduino (SPI)
//   1 = RC522 em OUTRO Arduino (testes/../leitor-rfid), conversando com este por I2C (A4 e A5)
#define RFID_EXTERNO 1

#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <HX711.h>
#include <Stepper.h>
#include <SoftwareSerial.h>
#include <EEPROM.h>

// ---------------- PINOS ----------------
const int PINO_RFID_SS   = 10;  // RC522 SDA
const int PINO_RFID_RST  = 9;   // RC522 RST   (SCK=13, MOSI=11, MISO=12 sao fixos no Uno)
const byte ENDERECO_LEITOR = 0x30;   // endereco I2C do Arduino do leitor (RFID_EXTERNO 1)
const int PINO_BALANCA_DT  = A1;
const int PINO_BALANCA_SCK = A0;
const int PINO_MOTOR_IN1 = 4;   // ULN2003 IN1
const int PINO_MOTOR_IN2 = 5;   // ULN2003 IN2
const int PINO_MOTOR_IN3 = 6;   // ULN2003 IN3
const int PINO_MOTOR_IN4 = 7;   // ULN2003 IN4
const int PINO_BOMBA     = 3;   // IN do modulo rele (liga a bomba)
const int PINO_BT_RX     = 2;   // recebe do TXD do HM-10
const int PINO_BT_TX     = A3;  // envia pro RXD do HM-10 (com divisor de tensao 1k/2k!)

// ---------------- AJUSTES ----------------
#if SIMULACAO
  const int   PASSOS_POR_VOLTA = 200;     // motor do Wokwi
  const float FATOR_BALANCA    = 420.0;   // Wokwi 50kg: leitura 0..21000 -> 420 por kg
  const unsigned long INTERVALO_RACAO = 15000UL;           // 15 s pra testar
  const unsigned long TEMPO_BOMBA     = 2000UL;            // bomba ligada por visita
  const unsigned long INTERVALO_AGUA  = 8000UL;            // 8 s pra testar
  const int   NIVEL_BOMBA_LIGADA = HIGH;                   // LED azul acende com HIGH
  const unsigned long TEMPO_PESAGEM   = 500UL;             // espera o cachorro na balanca
  const unsigned long TEMPO_MENSAGEM  = 800UL;             // pausa depois da visita, antes de ler a proxima tag
  const unsigned long JANELA_TAG_REPETIDA = 3000UL;        // ignora a mesma tag lida de novo
  const int   RPM_DOSADOR      = 30;                       // Wokwi aguenta mais rapido
#else
  const int   PASSOS_POR_VOLTA = 2048;    // 28BYJ-48
  const float FATOR_BALANCA    = 27553.0; // PROVISORIO: media de 4 medidas com 1 kg (variaram +-8%). Recalibre com um peso maior (teste-geral, comando k)
  const unsigned long INTERVALO_RACAO = 60UL * 1000;       // 1 minuto (para a apresentacao)
  const unsigned long TEMPO_BOMBA     = 8000UL;            // 8 s por visita: CALIBRAR pelo tamanho do pote
  const unsigned long INTERVALO_AGUA  = 60UL * 1000;       // 1 minuto, igual a racao
  const int   NIVEL_BOMBA_LIGADA = HIGH;                   // rele de 3 pinos (IN, GND, VCC) com transistor liga com HIGH. Se for com optoacoplador, troque para LOW
  const unsigned long TEMPO_PESAGEM   = 2000UL;            // espera o cachorro na balanca
  const unsigned long TEMPO_MENSAGEM  = 2500UL;            // pausa depois da visita, antes de ler a proxima tag
  const unsigned long JANELA_TAG_REPETIDA = 10000UL;       // ignora a mesma tag lida de novo
  const int   RPM_DOSADOR      = 10;                       // o 28BYJ-48 nao passa muito de 15
#endif

const float VOLTAS_POR_PORCAO = 0.5;  // quanto o dosador gira por porcao
const float PESO_MINIMO_KG    = 1.0;  // menos que isso = cachorro nao esta na balanca
const int   NIVEL_BOMBA_DESLIGADA = (NIVEL_BOMBA_LIGADA == HIGH) ? LOW : HIGH;

// ---------------- TAGS AUTORIZADAS (EEPROM) ----------------
// Quem cadastra e o app. O Arduino so guarda a lista pra saber quem pode comer.
// Cada "slot" da EEPROM: [tamanho do UID][UID, ate 7 bytes][nome, ate 10 letras]
const int MAX_TAGS   = 10;
const int TAM_UID    = 7;                          // tags NFC tem UID de 4 ou 7 bytes
const int TAM_NOME   = 10;                         // nome do cachorro (sem acento)
const int TAM_SLOT   = 1 + TAM_UID + TAM_NOME;     // 18 bytes por tag
const int END_MAGICA = 0;                          // endereco do marcador "EEPROM preparada"
const int END_SLOTS  = 1;                          // onde comecam os slots
const byte MAGICA    = 0xA5;
const unsigned long DURACAO_CADASTRO = 30000UL;    // o modo cadastro dura 30 s

unsigned long ultimaPorcao[MAX_TAGS];
bool jaComeu[MAX_TAGS];
bool modoCadastro = false;
unsigned long inicioCadastro = 0;

// ---------------- OBJETOS ----------------
#if !RFID_EXTERNO
MFRC522 rfid(PINO_RFID_SS, PINO_RFID_RST);
#endif
HX711 balanca;
Stepper dosador(PASSOS_POR_VOLTA, PINO_MOTOR_IN1, PINO_MOTOR_IN3, PINO_MOTOR_IN2, PINO_MOTOR_IN4);
SoftwareSerial bluetooth(PINO_BT_RX, PINO_BT_TX);

bool bombaLigada = false;
bool jaDeuAgua = false;
unsigned long ultimaAgua = 0;
String ultimoUid = "";
unsigned long momentoUltimoUid = 0;

// Enquanto o totem pesa, solta racao e enche a agua, ele fica "ocupado": continua LENDO o leitor
// (para a fila nao travar), mas DESCARTA qualquer tag nova. Ela so vale depois que terminar.
bool ocupado = false;
unsigned long ultimoDescarte = 0;

// Estado dos sensores, mostrado no app (evento "status").
unsigned long ultimoOkLeitor = 0;      // quando o leitor respondeu pela ultima vez (0 = nunca)
bool chipLeitorOk = false;             // o RC522 do leitor esta respondendo
bool statusLeitor = false;
bool statusBalanca = false;
unsigned long ultimaChecagemStatus = 0;
unsigned long ultimoEnvioStatus = 0;

// ---------------- FUNCOES ----------------
// Nao ha display: as mensagens aparecem so no Serial (USB), com "MSG> ", para acompanhar nos testes.
void mostrar(String linha1, String linha2) {
  Serial.print(F("MSG> "));
  Serial.print(linha1);
  Serial.print(F(" | "));
  Serial.println(linha2);
}

// Cada evento vira UMA linha de JSON. O HM-10 repassa pro tablet do jeito que sai.
void enviarParaApp(String json) {
  Serial.print(F("APP> "));
  Serial.println(json);
  bluetooth.println(json);
}

// ---------------- LISTA DE TAGS NA EEPROM ----------------
int enderecoSlot(int i) { return END_SLOTS + i * TAM_SLOT; }

bool slotOcupado(int i) {
  byte tamanho = EEPROM.read(enderecoSlot(i));
  return tamanho == 4 || tamanho == 7;
}

// Na primeira vez que o Arduino liga, a EEPROM vem cheia de 0xFF: marca todos os slots como livres.
void prepararEeprom() {
  if (EEPROM.read(END_MAGICA) == MAGICA) return;
  for (int i = 0; i < MAX_TAGS; i++) EEPROM.update(enderecoSlot(i), 0);
  EEPROM.update(END_MAGICA, MAGICA);
}

String uidDoSlot(int i) {
  int inicio = enderecoSlot(i);
  byte tamanho = EEPROM.read(inicio);
  String uid = "";
  for (byte b = 0; b < tamanho; b++) {
    byte valor = EEPROM.read(inicio + 1 + b);
    if (valor < 0x10) uid += "0";
    uid += String(valor, HEX);
    if (b < tamanho - 1) uid += ":";
  }
  uid.toUpperCase();
  return uid;
}

String nomeDoSlot(int i) {
  String nome = "";
  int inicio = enderecoSlot(i) + 1 + TAM_UID;
  for (int b = 0; b < TAM_NOME; b++) {
    char letra = EEPROM.read(inicio + b);
    if (letra == 0) break;
    nome += letra;
  }
  return nome;
}

int procurarSlot(const String& uid) {
  for (int i = 0; i < MAX_TAGS; i++) {
    if (slotOcupado(i) && uidDoSlot(i) == uid) return i;
  }
  return -1;
}

int slotLivre() {
  for (int i = 0; i < MAX_TAGS; i++) {
    if (!slotOcupado(i)) return i;
  }
  return -1;
}

// Converte "0A:0B:0C:0D" em bytes. Devolve o tamanho (4 ou 7), ou 0 se o texto for invalido.
byte textoParaUid(const char* texto, byte* bytes) {
  byte quantos = 0;
  const char* p = texto;
  while (quantos < TAM_UID) {
    if (!isxdigit(p[0]) || !isxdigit(p[1])) return 0;
    char dupla[3] = { p[0], p[1], 0 };
    bytes[quantos++] = (byte) strtol(dupla, NULL, 16);
    p += 2;
    if (*p == ':') p++;
    else break;
  }
  if (*p != 0) return 0;
  return (quantos == 4 || quantos == 7) ? quantos : 0;
}

void gravarTag(const char* uidTexto, const char* nome) {
  byte bytes[TAM_UID];
  byte tamanho = textoParaUid(uidTexto, bytes);
  if (tamanho == 0) return;

  String uid = String(uidTexto);
  uid.toUpperCase();
  int slot = procurarSlot(uid);
  if (slot < 0) slot = slotLivre();
  if (slot < 0) return;   // lista cheia

  int inicio = enderecoSlot(slot);
  int tamanhoNome = strlen(nome);
  EEPROM.update(inicio, tamanho);
  for (byte b = 0; b < TAM_UID; b++) EEPROM.update(inicio + 1 + b, b < tamanho ? bytes[b] : 0);
  for (int b = 0; b < TAM_NOME; b++) EEPROM.update(inicio + 1 + TAM_UID + b, b < tamanhoNome ? nome[b] : 0);
  jaComeu[slot] = false;
  ultimaPorcao[slot] = 0;
}

void apagarTag(const char* uidTexto) {
  String uid = String(uidTexto);
  uid.toUpperCase();
  int slot = procurarSlot(uid);
  if (slot >= 0) EEPROM.update(enderecoSlot(slot), 0);
}

// Manda a lista inteira pro app, aos pedacos (montar tudo numa String gastaria a RAM).
void escrever(const __FlashStringHelper* texto) { Serial.print(texto); bluetooth.print(texto); }
void escrever(const String& texto) { Serial.print(texto); bluetooth.print(texto); }

void enviarCadastros() {
  Serial.print(F("APP> "));
  escrever(F("{\"evento\":\"cadastros\",\"uids\":["));
  bool primeiro = true;
  for (int i = 0; i < MAX_TAGS; i++) {
    if (!slotOcupado(i)) continue;
    if (!primeiro) escrever(F(","));
    primeiro = false;
    escrever(F("\""));
    escrever(uidDoSlot(i));
    escrever(F("\""));
  }
  Serial.println(F("]}"));
  bluetooth.println(F("]}"));
}

// Monta o texto do UID, no formato "0A:0B:0C:0D".
String uidParaTexto(const byte* bytes, byte tamanho) {
  String uid = "";
  for (byte i = 0; i < tamanho; i++) {
    if (bytes[i] < 0x10) uid += "0";
    uid += String(bytes[i], HEX);
    if (i < tamanho - 1) uid += ":";
  }
  uid.toUpperCase();
  return uid;
}

// Devolve true e preenche o UID quando uma tag nova chegou ao leitor.
#if RFID_EXTERNO
// O leitor esta em outro Arduino. Pergunta por I2C: 10 bytes = [novo][tamanho][UID de 7 bytes][chip ok]
// Se um escravo travar segurando o SDA, o barramento para. Dar 9 pulsos no SCL solta ele.
void reiniciarI2c() {
  Wire.end();
  pinMode(A4, INPUT_PULLUP);   // SDA
  pinMode(A5, OUTPUT);         // SCL
  for (byte i = 0; i < 9; i++) {
    digitalWrite(A5, LOW);
    delayMicroseconds(5);
    digitalWrite(A5, HIGH);
    delayMicroseconds(5);
  }
  Wire.begin();
  Wire.setWireTimeout(3000, true);
}

bool lerTag(String& uid) {
  static unsigned int falhasSeguidas = 0;
  if (Wire.requestFrom(ENDERECO_LEITOR, (uint8_t)10) != 10) {   // leitor ausente ou ocupado
    falhasSeguidas++;
    if (falhasSeguidas % 50 == 0) {   // ~10 s sem resposta
      Serial.println(F("MSG> ATENCAO: o leitor RFID nao responde pelo I2C (A4, A5, GND). Reiniciando o barramento."));
      reiniciarI2c();
    }
    return false;
  }
  falhasSeguidas = 0;
  byte novo = Wire.read();
  byte tamanho = Wire.read();
  byte bytes[7];
  for (byte i = 0; i < 7; i++) bytes[i] = Wire.read();
  chipLeitorOk = Wire.read() == 1;
  ultimoOkLeitor = millis() | 1;   // "| 1" garante que nunca vira 0 (0 quer dizer "nunca respondeu")
  if (!novo || (tamanho != 4 && tamanho != 7)) return false;
  uid = uidParaTexto(bytes, tamanho);
  Serial.print(F("MSG> Leitor entregou a tag: "));
  Serial.println(uid);
  return true;
}
#else
// O leitor RC522 esta ligado neste Arduino (SPI).
bool lerTag(String& uid) {
  if (!(rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial())) return false;
  uid = uidParaTexto(rfid.uid.uidByte, rfid.uid.size);
  rfid.PICC_HaltA();
  return true;
}
#endif

void desligarMotor() {
  // O 28BYJ-48 esquenta se as bobinas ficarem ligadas parado
  digitalWrite(PINO_MOTOR_IN1, LOW);
  digitalWrite(PINO_MOTOR_IN2, LOW);
  digitalWrite(PINO_MOTOR_IN3, LOW);
  digitalWrite(PINO_MOTOR_IN4, LOW);
}

void soltarRacao() {
  enviarParaApp(F("{\"evento\":\"racao\",\"motor\":\"ligado\"}"));
  dosador.step((int)(PASSOS_POR_VOLTA * VOLTAS_POR_PORCAO));
  desligarMotor();
  enviarParaApp(F("{\"evento\":\"racao\",\"motor\":\"desligado\"}"));
}

void ligarBomba() {
  digitalWrite(PINO_BOMBA, NIVEL_BOMBA_LIGADA);
  bombaLigada = true;
  enviarParaApp(F("{\"evento\":\"agua\",\"bomba\":\"ligada\"}"));
}

void desligarBomba() {
  digitalWrite(PINO_BOMBA, NIVEL_BOMBA_DESLIGADA);
  bombaLigada = false;
  enviarParaApp(F("{\"evento\":\"agua\",\"bomba\":\"desligada\"}"));
}

// Enche o pote por um tempo fixo (nao ha sensor de nivel).
// O intervalo minimo evita transbordar se varios cachorros passarem em seguida.
// Devolve true se a bomba rodou.
bool darAgua() {
  bool podeDar = !jaDeuAgua || (millis() - ultimaAgua >= INTERVALO_AGUA);
  if (!podeDar) return false;
  Serial.println(F("MSG> Enchendo agua"));
  ligarBomba();
  esperarLendo(TEMPO_BOMBA);
  desligarBomba();
  ultimaAgua = millis();
  jaDeuAgua = true;
  return true;
}

// ---------------- MODO CADASTRO ----------------
void ligarModoCadastro() {
  modoCadastro = true;
  inicioCadastro = millis();
  enviarParaApp(F("{\"evento\":\"modo_cadastro\",\"ativo\":true}"));
  mostrar("Modo cadastro", "Encoste a tag");
}

void desligarModoCadastro() {
  if (!modoCadastro) return;
  modoCadastro = false;
  enviarParaApp(F("{\"evento\":\"modo_cadastro\",\"ativo\":false}"));
}

// ---------------- COMANDOS DO APP ----------------
// Cada comando e uma linha JSON. Nao usamos biblioteca de JSON (a RAM do Uno e pequena):
// procuramos o texto  "chave":"valor"  direto na linha.
bool extrairTexto(const char* linha, const char* chave, char* saida, int maximo) {
  char procurado[16];
  snprintf(procurado, sizeof(procurado), "\"%s\":\"", chave);
  const char* inicio = strstr(linha, procurado);
  if (!inicio) return false;
  inicio += strlen(procurado);
  int n = 0;
  while (*inicio && *inicio != '"' && n < maximo - 1) saida[n++] = *inicio++;
  saida[n] = 0;
  return true;
}

void tratarComando(const char* linha) {
  char comando[12], uid[24], nome[TAM_NOME + 1];
  if (!extrairTexto(linha, "cmd", comando, sizeof(comando))) return;

  if (strcmp(comando, "cadastrar") == 0) {
    ligarModoCadastro();
  } else if (strcmp(comando, "cancelar") == 0) {
    desligarModoCadastro();
  } else if (strcmp(comando, "listar") == 0) {
    enviarCadastros();
  } else if (strcmp(comando, "permitir") == 0 && extrairTexto(linha, "uid", uid, sizeof(uid))) {
    if (!extrairTexto(linha, "nome", nome, sizeof(nome))) nome[0] = 0;
    gravarTag(uid, nome);
    enviarCadastros();
  } else if (strcmp(comando, "remover") == 0 && extrairTexto(linha, "uid", uid, sizeof(uid))) {
    apagarTag(uid);
    enviarCadastros();
  }
}

char linhaApp[80];
int tamanhoLinhaApp = 0;
#if SIMULACAO
char linhaUsb[80];          // no Wokwi os comandos chegam pelo Serial, ja que nao ha HM-10
int tamanhoLinhaUsb = 0;
#endif

// Le caracteres ate o \n e entrega a linha pronta pra tratarComando.
void juntarLinha(Stream& origem, char* buffer, int& tamanho) {
  while (origem.available()) {
    char c = origem.read();
    if (c == '\n') {
      buffer[tamanho] = 0;
      if (tamanho > 0) tratarComando(buffer);
      tamanho = 0;
    } else if (c != '\r') {
      if (tamanho < 79) buffer[tamanho++] = c;
      else tamanho = 0;     // linha grande demais: joga fora
    }
  }
}

void lerComandos() {
  juntarLinha(bluetooth, linhaApp, tamanhoLinhaApp);
#if SIMULACAO
  juntarLinha(Serial, linhaUsb, tamanhoLinhaUsb);
#endif
}

// Espera "ms" milissegundos, mas continua lendo os comandos do app durante a espera.
// Por que nao usar delay()? O SoftwareSerial guarda so 63 bytes. Se o app mandar
// varios comandos enquanto o Arduino esta parado num delay(), o buffer enche e os
// comandos se perdem. Aqui a gente esvazia o buffer a cada milissegundo.
void esperarLendo(unsigned long ms) {
  unsigned long inicio = millis();
  while (millis() - inicio < ms) {
    lerComandos();
    if (ocupado && millis() - ultimoDescarte >= 100) {
      ultimoDescarte = millis();
      descartarTagsDoLeitor();
    }
    delay(1);
  }
}

// Esvazia a fila do leitor sem fazer nada com a tag (totem ocupado).
void descartarTagsDoLeitor() {
  String ignorada;
  if (lerTag(ignorada)) {
    Serial.print(F("MSG> Tag ignorada (totem ocupado): "));
    Serial.println(ignorada);
  }
}

// ---------------- STATUS DOS SENSORES ----------------
// Se o leitor respondeu ha pouco E o RC522 dele esta vivo.
bool leitorFunciona() {
#if RFID_EXTERNO
  return ultimoOkLeitor != 0 && (millis() - ultimoOkLeitor) < 3000 && chipLeitorOk;
#else
  byte versao = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  return versao != 0x00 && versao != 0xFF;
#endif
}

// O HX711 mantem o pino DT em nivel baixo quando ha um dado pronto. Desligado ou com fio solto, o DT fica alto.
bool balancaFunciona() {
  return balanca.wait_ready_timeout(150);
}

// Confere os sensores a cada 2 s e avisa o app quando algo muda (ou, no minimo, a cada 5 s).
void atualizarStatus(bool forcar) {
  if (ocupado) return;   // durante a pesagem nao mexe no HX711
  if (!forcar && millis() - ultimaChecagemStatus < 2000) return;
  ultimaChecagemStatus = millis();

  bool leitor = leitorFunciona();
  bool balancaOk = balancaFunciona();
  bool mudou = (leitor != statusLeitor) || (balancaOk != statusBalanca);
  statusLeitor = leitor;
  statusBalanca = balancaOk;

  if (forcar || mudou || millis() - ultimoEnvioStatus >= 5000) {
    ultimoEnvioStatus = millis();
    String json = "{\"evento\":\"status\",\"leitor\":";
    json += leitor ? "true" : "false";
    json += ",\"balanca\":";
    json += balancaOk ? "true" : "false";
    json += "}";
    enviarParaApp(json);
  }
}

void atenderCachorro(int slot, String uid) {
  ocupado = true;   // a partir daqui, tags novas sao lidas e descartadas
  String nome = nomeDoSlot(slot);

  mostrar("Ola, " + nome + "!", "Pesando...");
  esperarLendo(TEMPO_PESAGEM);  // espera o cachorro se acomodar na balanca

  float peso = 0;
  if (balanca.wait_ready_timeout(1000)) peso = balanca.get_units(10);  // media de 10 leituras
  bool pesoValido = peso >= PESO_MINIMO_KG;

  bool podeComer = !jaComeu[slot] || (millis() - ultimaPorcao[slot] >= INTERVALO_RACAO);
  if (podeComer) {
    mostrar(nome + " " + (pesoValido ? String(peso, 1) + "kg" : "?kg"), "Soltando racao");
    soltarRacao();
    ultimaPorcao[slot] = millis();
    jaComeu[slot] = true;
  } else {
    mostrar(nome + " " + (pesoValido ? String(peso, 1) + "kg" : "?kg"), "Ja comeu, volte!");
  }

  // Agua vem junto com a visita (o pote e compartilhado, entao tem intervalo proprio)
  darAgua();

  String json = "{\"evento\":\"visita\",\"uid\":\"" + uid + "\"";
  json += ",\"peso_kg\":" + (pesoValido ? String(peso, 1) : String("null"));
  json += ",\"racao\":" + String(podeComer ? "true" : "false") + "}";
  enviarParaApp(json);

  esperarLendo(TEMPO_MENSAGEM);
  descartarTagsDoLeitor();   // tira da fila o que ainda estiver la
  ocupado = false;           // terminou: a proxima tag volta a valer
}

// ---------------- PROGRAMA ----------------
void setup() {
  Serial.begin(9600);
  bluetooth.begin(9600);  // velocidade padrao do HM-10
  prepararEeprom();
#if RFID_EXTERNO
  Wire.begin();                     // este Arduino e o "mestre" do I2C
  Wire.setWireTimeout(3000, true);  // se o leitor travar o barramento, nao trava o totem
#else
  SPI.begin();
  rfid.PCD_Init();
#endif

  // A bomba comeca DESLIGADA: escreve o nivel antes de virar saida, pro rele nao dar um clique no boot
  digitalWrite(PINO_BOMBA, NIVEL_BOMBA_DESLIGADA);
  pinMode(PINO_BOMBA, OUTPUT);
  pinMode(PINO_MOTOR_IN1, OUTPUT);
  pinMode(PINO_MOTOR_IN2, OUTPUT);
  pinMode(PINO_MOTOR_IN3, OUTPUT);
  pinMode(PINO_MOTOR_IN4, OUTPUT);
  desligarMotor();
  dosador.setSpeed(RPM_DOSADOR);

  mostrar("     AMICAO", "Zerando balanca");
  balanca.begin(PINO_BALANCA_DT, PINO_BALANCA_SCK);
  balanca.set_scale(FATOR_BALANCA);
  if (balanca.wait_ready_timeout(1000)) {
    balanca.tare();  // a balanca precisa estar VAZIA ao ligar
  } else {
    Serial.println(F("MSG> ATENCAO: HX711 nao respondeu (confira VCC, GND, DT=A1, SCK=A0)"));
  }
#if !SIMULACAO
  if (FATOR_BALANCA == 1.0) Serial.println(F("MSG> ATENCAO: balanca sem calibrar (FATOR_BALANCA = 1.0)"));
#endif

  enviarParaApp(F("{\"evento\":\"ligado\"}"));
  atualizarStatus(true);
}

void loop() {
  lerComandos();
  atualizarStatus(false);

  if (modoCadastro && millis() - inicioCadastro > DURACAO_CADASTRO) {
    desligarModoCadastro();
  }

  String uid;
  if (lerTag(uid)) {

    if (modoCadastro) {
      // Qualquer tag vale: o app decide o nome e manda "permitir"
      enviarParaApp("{\"evento\":\"tag_lida\",\"uid\":\"" + uid + "\"}");
      desligarModoCadastro();
    } else {
      int slot = procurarSlot(uid);
      // ignora a mesma tag lida de novo logo em seguida (cadastrada ou nao)
      bool repetida = (uid == ultimoUid) && (millis() - momentoUltimoUid < JANELA_TAG_REPETIDA);
      if (!repetida) {
        if (slot >= 0) {
          atenderCachorro(slot, uid);
        } else {
          // tag que nao esta na lista: nada acontece com o totem (so aparece aviso no Serial)
          Serial.print(F("MSG> Tag nao cadastrada: "));
          Serial.println(uid);
        }
        ultimoUid = uid;
        momentoUltimoUid = millis();
      }
    }
  }

  esperarLendo(200);   // pausa curta, lendo os comandos do app enquanto espera
}
