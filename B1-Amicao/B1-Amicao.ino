/*
  AMICAO — BITMAKERS B1
  Totem comedouro/bebedouro que identifica cada cachorro pela tag da coleira,
  registra o peso e manda os dados pro aplicativo.

  Componentes:
    - RC522 .............. le a tag NFC da coleira
    - Celula de carga + HX711 ... balanca
    - 28BYJ-48 + ULN2003 . dosador de racao   (no Wokwi: motor de passo comum)
    - L9110S + bomba ..... enche o pote de agua (no Wokwi: LED azul)
    - FC-37 .............. sensor de nivel no pote de agua (no Wokwi: potenciometro)
    - LCD 16x2 I2C ....... mensagens
    - Bluetooth HM-10 .... (BLE) manda cada evento pro app no tablet e recebe comandos do app

  Mude SIMULACAO para 0 antes de gravar na placa de verdade.
*/

#define SIMULACAO 1   // 1 = Wokwi   |   0 = montagem real

#include <SPI.h>
#include <MFRC522.h>
#include <HX711.h>
#include <Stepper.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <SoftwareSerial.h>
#include <EEPROM.h>

// ---------------- PINOS ----------------
const int PINO_RFID_SS   = 10;  // RC522 SDA
const int PINO_RFID_RST  = 9;   // RC522 RST   (SCK=13, MOSI=11, MISO=12 sao fixos no Uno)
const int PINO_BALANCA_DT  = A1;
const int PINO_BALANCA_SCK = A0;
const int PINO_MOTOR_IN1 = 4;   // ULN2003 IN1
const int PINO_MOTOR_IN2 = 5;   // ULN2003 IN2
const int PINO_MOTOR_IN3 = 6;   // ULN2003 IN3
const int PINO_MOTOR_IN4 = 7;   // ULN2003 IN4
const int PINO_BOMBA_A   = 3;   // L9110S A-IA
const int PINO_BOMBA_B   = 8;   // L9110S A-IB
const int PINO_AGUA      = A2;  // FC-37 AO
const int PINO_BT_RX     = 2;   // recebe do TXD do HM-10
const int PINO_BT_TX     = A3;  // envia pro RXD do HM-10 (com divisor de tensao 1k/2k!)

// ---------------- AJUSTES ----------------
#if SIMULACAO
  const int   PASSOS_POR_VOLTA = 200;     // motor do Wokwi
  const float FATOR_BALANCA    = 420.0;   // Wokwi 50kg: leitura 0..21000 -> 420 por kg
  const unsigned long INTERVALO_RACAO = 15000UL;           // 15 s pra testar
  const unsigned long TEMPO_MAX_BOMBA = 5000UL;            // 5 s
  const unsigned long TEMPO_PESAGEM   = 500UL;             // espera o cachorro na balanca
  const unsigned long TEMPO_MENSAGEM  = 800UL;             // quanto tempo a mensagem fica no LCD
  const unsigned long JANELA_TAG_REPETIDA = 3000UL;        // ignora a mesma tag lida de novo
  const int   RPM_DOSADOR      = 30;                       // Wokwi aguenta mais rapido
#else
  const int   PASSOS_POR_VOLTA = 2048;    // 28BYJ-48
  const float FATOR_BALANCA    = 1.0;     // CALIBRAR! (veja README)
  const unsigned long INTERVALO_RACAO = 4UL * 60 * 60 * 1000; // 4 horas
  const unsigned long TEMPO_MAX_BOMBA = 30000UL;           // 30 s
  const unsigned long TEMPO_PESAGEM   = 2000UL;            // espera o cachorro na balanca
  const unsigned long TEMPO_MENSAGEM  = 2500UL;            // quanto tempo a mensagem fica no LCD
  const unsigned long JANELA_TAG_REPETIDA = 10000UL;       // ignora a mesma tag lida de novo
  const int   RPM_DOSADOR      = 10;                       // o 28BYJ-48 nao passa muito de 15
#endif

const float VOLTAS_POR_PORCAO = 0.5;  // quanto o dosador gira por porcao
const float PESO_MINIMO_KG    = 1.0;  // menos que isso = cachorro nao esta na balanca
const int   LIMITE_AGUA       = 500;  // FC-37: valor CAI quando molha. Abaixo = tem agua

// ---------------- TAGS AUTORIZADAS (EEPROM) ----------------
// Quem cadastra e o app. O Arduino so guarda a lista pra saber quem pode comer.
// Cada "slot" da EEPROM: [tamanho do UID][UID, ate 7 bytes][nome, ate 10 letras]
const int MAX_TAGS   = 10;
const int TAM_UID    = 7;                          // tags NFC tem UID de 4 ou 7 bytes
const int TAM_NOME   = 10;                         // aparece no LCD (sem acento)
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
MFRC522 rfid(PINO_RFID_SS, PINO_RFID_RST);
HX711 balanca;
Stepper dosador(PASSOS_POR_VOLTA, PINO_MOTOR_IN1, PINO_MOTOR_IN3, PINO_MOTOR_IN2, PINO_MOTOR_IN4);
LiquidCrystal_I2C lcd(0x27, 16, 2);
SoftwareSerial bluetooth(PINO_BT_RX, PINO_BT_TX);

bool bombaLigada = false;
bool bombaTravada = false;
unsigned long inicioBomba = 0;
String ultimoUid = "";
unsigned long momentoUltimoUid = 0;

// ---------------- FUNCOES ----------------
void escreverLinha(int linha, String texto) {
  while (texto.length() < 16) texto += " ";
  lcd.setCursor(0, linha);
  lcd.print(texto.substring(0, 16));
}

void mostrar(String linha1, String linha2) {
  escreverLinha(0, linha1);
  escreverLinha(1, linha2);
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

String lerUid() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) uid += ":";
  }
  uid.toUpperCase();
  return uid;
}

void desligarMotor() {
  // O 28BYJ-48 esquenta se as bobinas ficarem ligadas parado
  digitalWrite(PINO_MOTOR_IN1, LOW);
  digitalWrite(PINO_MOTOR_IN2, LOW);
  digitalWrite(PINO_MOTOR_IN3, LOW);
  digitalWrite(PINO_MOTOR_IN4, LOW);
}

void soltarRacao() {
  dosador.step((int)(PASSOS_POR_VOLTA * VOLTAS_POR_PORCAO));
  desligarMotor();
}

void ligarBomba() {
  digitalWrite(PINO_BOMBA_A, HIGH);
  digitalWrite(PINO_BOMBA_B, LOW);
  bombaLigada = true;
  inicioBomba = millis();
  enviarParaApp(F("{\"evento\":\"agua\",\"bomba\":\"ligada\"}"));
}

void desligarBomba() {
  digitalWrite(PINO_BOMBA_A, LOW);
  digitalWrite(PINO_BOMBA_B, LOW);
  bombaLigada = false;
  enviarParaApp(F("{\"evento\":\"agua\",\"bomba\":\"desligada\"}"));
}

// Mantem o pote com agua. Se a bomba ficar ligada tempo demais,
// provavelmente o reservatorio acabou: desliga e avisa o app.
void controlarAgua() {
  if (bombaTravada) return;
  bool poteComAgua = analogRead(PINO_AGUA) < LIMITE_AGUA;

  if (!bombaLigada && !poteComAgua) {
    ligarBomba();
  } else if (bombaLigada && poteComAgua) {
    desligarBomba();
  } else if (bombaLigada && millis() - inicioBomba > TEMPO_MAX_BOMBA) {
    desligarBomba();
    bombaTravada = true;
    enviarParaApp(F("{\"evento\":\"alerta\",\"tipo\":\"reservatorio_vazio\"}"));
  }
}

void telaInicial() {
  if (modoCadastro) {
    mostrar("Modo cadastro", "Encoste a tag");
    return;
  }
  String agua = bombaTravada ? "SEM AGUA!" : (bombaLigada ? "enchendo" : "ok");
  mostrar("     AMICAO", "Agua: " + agua);
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

void atenderCachorro(int slot, String uid) {
  String nome = nomeDoSlot(slot);

  mostrar("Ola, " + nome + "!", "Pesando...");
  delay(TEMPO_PESAGEM);  // espera o cachorro se acomodar na balanca

  float peso = balanca.get_units(10);  // media de 10 leituras
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

  String json = "{\"evento\":\"visita\",\"uid\":\"" + uid + "\"";
  json += ",\"peso_kg\":" + (pesoValido ? String(peso, 1) : String("null"));
  json += ",\"racao\":" + String(podeComer ? "true" : "false") + "}";
  enviarParaApp(json);

  delay(TEMPO_MENSAGEM);
}

// ---------------- PROGRAMA ----------------
void setup() {
  Serial.begin(9600);
  bluetooth.begin(9600);  // velocidade padrao do HM-10
  prepararEeprom();
  SPI.begin();
  rfid.PCD_Init();

  pinMode(PINO_BOMBA_A, OUTPUT);
  pinMode(PINO_BOMBA_B, OUTPUT);
  pinMode(PINO_MOTOR_IN1, OUTPUT);
  pinMode(PINO_MOTOR_IN2, OUTPUT);
  pinMode(PINO_MOTOR_IN3, OUTPUT);
  pinMode(PINO_MOTOR_IN4, OUTPUT);
  desligarMotor();
  digitalWrite(PINO_BOMBA_A, LOW);
  digitalWrite(PINO_BOMBA_B, LOW);
  dosador.setSpeed(RPM_DOSADOR);

  lcd.init();
  lcd.backlight();
  mostrar("     AMICAO", "Zerando balanca");
  balanca.begin(PINO_BALANCA_DT, PINO_BALANCA_SCK);
  balanca.set_scale(FATOR_BALANCA);
  balanca.tare();  // a balanca precisa estar VAZIA ao ligar

  enviarParaApp(F("{\"evento\":\"ligado\"}"));
  telaInicial();
}

void loop() {
  controlarAgua();
  lerComandos();

  if (modoCadastro && millis() - inicioCadastro > DURACAO_CADASTRO) {
    desligarModoCadastro();
  }

  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String uid = lerUid();
    rfid.PICC_HaltA();

    if (modoCadastro) {
      // Qualquer tag vale: o app decide o nome e manda "permitir"
      enviarParaApp("{\"evento\":\"tag_lida\",\"uid\":\"" + uid + "\"}");
      desligarModoCadastro();
    } else {
      int slot = procurarSlot(uid);
      // ignora a mesma tag lida de novo logo em seguida
      bool repetida = (uid == ultimoUid) && (millis() - momentoUltimoUid < JANELA_TAG_REPETIDA);
      if (slot >= 0 && !repetida) {
        atenderCachorro(slot, uid);
        ultimoUid = uid;
        momentoUltimoUid = millis();
      }
      // tag que nao esta na lista: nada acontece
    }
  }

  telaInicial();
  delay(200);
}
