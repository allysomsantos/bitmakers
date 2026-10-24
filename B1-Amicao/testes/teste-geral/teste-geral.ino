/*
  TESTE GERAL DO AMICAO (B1) - valida se cada peca esta funcionando.
  Nao e o programa final: nao tem cadastro, EEPROM nem app. Serve para montar e calibrar.

  Como usar:
    1. Grave este sketch e abra o Serial Monitor em 9600, com "Nova linha" (ou "Both NL & CR").
    2. Ao ligar ele faz sozinho a checagem do RC522 e do HX711.
    3. Digite uma letra e aperte Enter para testar cada peca:

       r   liga/desliga a leitura de tags (mostra o UID de cada tag encostada)
       t   zera a balanca (tare) - deixe ela VAZIA
       b   liga/desliga a leitura continua da balanca
       k 2.0   calibra: com um peso conhecido (aqui 2.0 kg) em cima, calcula o fator
       m   motor da racao: 1 volta para um lado
       n   motor da racao: 1 volta para o outro lado
       p   bomba: liga por 2 segundos (so teste com a bomba na agua!)
       h   manda "TESTE HM-10" pelo Bluetooth; o que o tablet mandar aparece aqui com "BT< "
       a   manda "AT" ao HM-10 (so responde se nenhum tablet estiver conectado)
       ?   mostra este menu de novo

  Ligacao: veja B1-Amicao/ligacoes/0-ligacao-completa.svg
*/

#include <SPI.h>
#include <MFRC522.h>
#include <HX711.h>
#include <Stepper.h>
#include <SoftwareSerial.h>

// ---------------- PINOS (iguais aos do programa final) ----------------
const int PINO_RFID_SS     = 10;  // RC522 SDA   (SCK=13, MOSI=11, MISO=12 sao fixos no Uno)
const int PINO_RFID_RST    = 9;
const int PINO_BALANCA_DT  = A1;
const int PINO_BALANCA_SCK = A0;
const int PINO_MOTOR_IN1   = 4;
const int PINO_MOTOR_IN2   = 5;
const int PINO_MOTOR_IN3   = 6;
const int PINO_MOTOR_IN4   = 7;
const int PINO_BOMBA       = 3;   // IN do modulo rele
const int PINO_BT_RX       = 2;   // recebe do TXD do HM-10
const int PINO_BT_TX       = A3;  // envia pro RXD do HM-10 (com divisor 1k/2k!)

// ---------------- AJUSTES ----------------
// O RC522 agora fica em outro Arduino (leitor-rfid). Mude para true so se ele estiver ligado neste.
const bool TESTAR_RFID_AQUI = false;
const int   PASSOS_POR_VOLTA = 2048;   // 28BYJ-48
const int   RPM_DOSADOR      = 10;     // o 28BYJ-48 nao passa muito de 15
const int   NIVEL_BOMBA_LIGADA = HIGH; // rele de 3 pinos (IN, GND, VCC) com transistor liga com HIGH. Se a bomba ligar
                                       // quando deveria estar desligada, troque para HIGH.
const unsigned long TEMPO_TESTE_BOMBA = 2000UL;
const unsigned long INTERVALO_BALANCA = 500UL;  // de quanto em quanto tempo mostra o peso
float fatorBalanca = 1.0;              // depois de calibrar, copie o valor para o programa final

const int NIVEL_BOMBA_DESLIGADA = (NIVEL_BOMBA_LIGADA == HIGH) ? LOW : HIGH;

// ---------------- OBJETOS ----------------
MFRC522 rfid(PINO_RFID_SS, PINO_RFID_RST);
HX711 balanca;
Stepper dosador(PASSOS_POR_VOLTA, PINO_MOTOR_IN1, PINO_MOTOR_IN3, PINO_MOTOR_IN2, PINO_MOTOR_IN4);
SoftwareSerial bluetooth(PINO_BT_RX, PINO_BT_TX);

bool lendoTags = false;
bool lendoBalanca = false;
unsigned long ultimaLeituraBalanca = 0;

// ---------------- FUNCOES ----------------
void mostrarMenu() {
  Serial.println(F("--------------------------------------------"));
  Serial.println(F("r = tags   t = zerar balanca   b = ler balanca"));
  Serial.println(F("k 2.0 = calibrar com peso conhecido (kg)"));
  Serial.println(F("m / n = motor 1 volta   p = bomba 2 s"));
  Serial.println(F("h = teste do Bluetooth   a = comando AT   ? = menu"));
  Serial.println(F("--------------------------------------------"));
}

void imprimirUid() {
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) Serial.print('0');
    Serial.print(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) Serial.print(':');
  }
}

// O RC522 responde com um numero de versao. 0x00 ou 0xFF = fio solto ou ligado errado.
void checarRfid() {
  if (!TESTAR_RFID_AQUI) {
    Serial.println(F("RC522: nao testado aqui (fica no Arduino do leitor)"));
    return;
  }
  byte versao = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.print(F("RC522 versao: 0x"));
  Serial.print(versao, HEX);
  if (versao == 0x00 || versao == 0xFF) {
    Serial.println(F("  -> FALHOU (confira 3.3V, GND, SDA=10, SCK=13, MOSI=11, MISO=12, RST=9)"));
  } else {
    Serial.println(F("  -> OK"));
  }
}

void checarBalanca() {
  if (balanca.wait_ready_timeout(1000)) {
    Serial.println(F("HX711: respondeu -> OK"));
  } else {
    Serial.println(F("HX711: sem resposta -> FALHOU (confira VCC=5V da fonte, GND, DT=A1, SCK=A0)"));
  }
}

void zerarBalanca() {
  if (!balanca.wait_ready_timeout(1000)) {
    Serial.println(F("HX711 sem resposta."));
    return;
  }
  Serial.println(F("Zerando... deixe a balanca vazia."));
  balanca.tare(10);
  Serial.println(F("Zerada."));
}

void mostrarPeso() {
  if (!balanca.is_ready()) {
    Serial.println(F("HX711 sem resposta."));
    return;
  }
  long bruto = balanca.read_average(3);
  float peso = balanca.get_units(3);
  Serial.print(F("bruto: "));
  Serial.print(bruto);
  Serial.print(F("   valor (bruto - zero): "));
  Serial.print(balanca.get_value(3), 0);
  Serial.print(F("   peso: "));
  Serial.print(peso, 3);
  Serial.println(F(" kg"));
}

// Com um peso conhecido em cima: fator = (leitura - zero) / peso em kg
void calibrarBalanca() {
  float pesoConhecido = Serial.parseFloat();
  if (pesoConhecido <= 0) {
    Serial.println(F("Use assim: k 2.0   (peso conhecido em kg, maior que zero)"));
    return;
  }
  if (!balanca.wait_ready_timeout(1000)) {
    Serial.println(F("HX711 sem resposta."));
    return;
  }
  float valor = balanca.get_value(15);   // leitura menos o zero
  if (valor == 0) {
    Serial.println(F("Leitura zero: confira os fios da celula e se o peso esta em cima."));
    return;
  }
  fatorBalanca = valor / pesoConhecido;
  balanca.set_scale(fatorBalanca);
  Serial.print(F("FATOR_BALANCA = "));
  Serial.println(fatorBalanca, 2);
  Serial.println(F("Copie esse numero para o programa final. Tire o peso e use 'b' para conferir."));
}

void desligarMotor() {
  // O 28BYJ-48 esquenta se as bobinas ficarem ligadas parado
  digitalWrite(PINO_MOTOR_IN1, LOW);
  digitalWrite(PINO_MOTOR_IN2, LOW);
  digitalWrite(PINO_MOTOR_IN3, LOW);
  digitalWrite(PINO_MOTOR_IN4, LOW);
}

void girarMotor(int sentido) {
  Serial.println(sentido > 0 ? F("Motor: 1 volta (sentido A)...") : F("Motor: 1 volta (sentido B)..."));
  dosador.step(sentido * PASSOS_POR_VOLTA);
  desligarMotor();
  Serial.println(F("Motor: pronto."));
}

void testarBomba() {
  Serial.println(F("Bomba LIGADA (so com a bomba dentro da agua!)"));
  digitalWrite(PINO_BOMBA, NIVEL_BOMBA_LIGADA);
  delay(TEMPO_TESTE_BOMBA);
  digitalWrite(PINO_BOMBA, NIVEL_BOMBA_DESLIGADA);
  Serial.println(F("Bomba desligada."));
}

// Tudo que o HM-10 mandar aparece no Serial com "BT< "
void repassarBluetooth() {
  static bool inicioDeLinha = true;
  while (bluetooth.available()) {
    char c = bluetooth.read();
    if (inicioDeLinha) Serial.print(F("BT< "));
    Serial.write(c);
    inicioDeLinha = (c == '\n');
  }
}

void lerTag() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;
  Serial.print(F("Tag lida: "));
  imprimirUid();
  Serial.print(F("   tipo: "));
  Serial.println(rfid.PICC_GetTypeName(rfid.PICC_GetType(rfid.uid.sak)));
  rfid.PICC_HaltA();
}

void tratarComando(char comando) {
  switch (comando) {
    case 'r':
      if (!TESTAR_RFID_AQUI) {
        Serial.println(F("RC522 nao esta neste Arduino. Teste-o no Arduino do leitor (leitor-rfid)."));
        break;
      }
      lendoTags = !lendoTags;
      Serial.println(lendoTags ? F("Leitura de tags LIGADA. Encoste uma tag.") : F("Leitura de tags desligada."));
      break;
    case 't': zerarBalanca(); break;
    case 'b':
      lendoBalanca = !lendoBalanca;
      Serial.println(lendoBalanca ? F("Leitura da balanca LIGADA.") : F("Leitura da balanca desligada."));
      break;
    case 'k': calibrarBalanca(); break;
    case 'm': girarMotor(1); break;
    case 'n': girarMotor(-1); break;
    case 'p': testarBomba(); break;
    case 'h':
      bluetooth.println(F("TESTE HM-10"));
      Serial.println(F("Mandei \"TESTE HM-10\" pelo Bluetooth. Abra um app de terminal BLE no tablet para ver."));
      break;
    case 'a':
      bluetooth.print(F("AT"));   // o HM-10 nao quer \r\n nos comandos AT
      Serial.println(F("Mandei AT. Esperado: OK (se der erro, nao tem resposta ou tem tablet conectado)."));
      break;
    case '?': mostrarMenu(); break;
    case '\n': case '\r': case ' ': break;
    default:
      Serial.print(F("Comando desconhecido: "));
      Serial.println(comando);
      break;
  }
}

// ---------------- PROGRAMA ----------------
void setup() {
  Serial.begin(9600);
  Serial.setTimeout(300);
  bluetooth.begin(9600);   // velocidade padrao do HM-10

  // A bomba comeca DESLIGADA: escreve o nivel antes de virar saida, pro rele nao dar um clique
  digitalWrite(PINO_BOMBA, NIVEL_BOMBA_DESLIGADA);
  pinMode(PINO_BOMBA, OUTPUT);
  pinMode(PINO_MOTOR_IN1, OUTPUT);
  pinMode(PINO_MOTOR_IN2, OUTPUT);
  pinMode(PINO_MOTOR_IN3, OUTPUT);
  pinMode(PINO_MOTOR_IN4, OUTPUT);
  desligarMotor();
  dosador.setSpeed(RPM_DOSADOR);

  if (TESTAR_RFID_AQUI) {
    SPI.begin();
    rfid.PCD_Init();
  }
  balanca.begin(PINO_BALANCA_DT, PINO_BALANCA_SCK);
  balanca.set_scale(fatorBalanca);

  Serial.println(F("TESTE GERAL DO AMICAO"));
  checarRfid();
  checarBalanca();
  if (balanca.is_ready()) balanca.tare(10);   // zera ao ligar: a balanca precisa estar vazia
  mostrarMenu();
}

void loop() {
  if (Serial.available()) tratarComando(Serial.read());

  repassarBluetooth();

  if (lendoTags) lerTag();

  if (lendoBalanca && millis() - ultimaLeituraBalanca >= INTERVALO_BALANCA) {
    ultimaLeituraBalanca = millis();
    mostrarPeso();
  }
}
