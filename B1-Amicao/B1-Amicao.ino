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
    - Bluetooth HC-06 .... manda cada evento pro app no tablet

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
const int PINO_BT_RX     = 2;   // recebe do TXD do HC-06
const int PINO_BT_TX     = A3;  // envia pro RXD do HC-06 (com divisor de tensao!)

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

// ---------------- CACHORROS CONHECIDOS ----------------
// O app e quem guarda o cadastro completo. Aqui so ficam os nomes pra aparecer no LCD.
struct Cachorro {
  const char* uid;
  const char* nome;
  unsigned long ultimaPorcao;
  bool jaComeu;
};

Cachorro cachorros[] = {
  { "0A:0B:0C:0D", "Rex",    0, false },
  { "11:22:33:44", "Pipoca", 0, false },
};
const int TOTAL_CACHORROS = sizeof(cachorros) / sizeof(cachorros[0]);
Cachorro desconhecido = { "", "Novo amigo", 0, false };

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

// Cada evento vira UMA linha de JSON. O HC-06 repassa pro tablet do jeito que sai.
void enviarParaApp(String json) {
  Serial.print(F("APP> "));
  Serial.println(json);
  bluetooth.println(json);
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

Cachorro* procurarCachorro(String uid) {
  for (int i = 0; i < TOTAL_CACHORROS; i++) {
    if (uid == cachorros[i].uid) return &cachorros[i];
  }
  return &desconhecido;
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
  String agua = bombaTravada ? "SEM AGUA!" : (bombaLigada ? "enchendo" : "ok");
  mostrar("     AMICAO", "Agua: " + agua);
}

void atenderCachorro(String uid) {
  Cachorro* c = procurarCachorro(uid);

  mostrar("Ola, " + String(c->nome) + "!", "Pesando...");
  delay(TEMPO_PESAGEM);  // espera o cachorro se acomodar na balanca

  float peso = balanca.get_units(10);  // media de 10 leituras
  bool pesoValido = peso >= PESO_MINIMO_KG;

  bool podeComer = !c->jaComeu || (millis() - c->ultimaPorcao >= INTERVALO_RACAO);
  if (podeComer) {
    mostrar(String(c->nome) + " " + (pesoValido ? String(peso, 1) + "kg" : "?kg"), "Soltando racao");
    soltarRacao();
    c->ultimaPorcao = millis();
    c->jaComeu = true;
  } else {
    mostrar(String(c->nome) + " " + (pesoValido ? String(peso, 1) + "kg" : "?kg"), "Ja comeu, volte!");
  }

  String json = "{\"evento\":\"visita\",\"uid\":\"" + uid + "\"";
  json += ",\"peso_kg\":" + (pesoValido ? String(peso, 1) : String("null"));
  json += ",\"racao\":" + String(podeComer ? "true" : "false") + "}";
  enviarParaApp(json);

  if (c == &desconhecido) {
    Serial.print(F("Tag nao cadastrada: "));
    Serial.println(uid);
  }
  delay(TEMPO_MENSAGEM);
}

// ---------------- PROGRAMA ----------------
void setup() {
  Serial.begin(9600);
  bluetooth.begin(9600);  // velocidade padrao do HC-06
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

  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String uid = lerUid();
    rfid.PICC_HaltA();

    // ignora a mesma tag lida de novo logo em seguida
    bool repetida = (uid == ultimoUid) && (millis() - momentoUltimoUid < JANELA_TAG_REPETIDA);
    if (!repetida) {
      atenderCachorro(uid);
      ultimoUid = uid;
      momentoUltimoUid = millis();
    }
  }

  telaInicial();
  delay(200);
}
