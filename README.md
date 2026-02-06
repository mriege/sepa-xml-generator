# SEPA-XML Generator

Kostenloser, datenschutzfreundlicher SEPA-XML Generator fuer Lastschriften (pain.008) und Ueberweisungen (pain.001). Laeuft vollstaendig im Browser - keine Daten verlassen Ihren Computer.

**Live-Version:** [sepa-xml-generator.de](https://www.sepa-xml-generator.de)

---

## Funktionen

- **SEPA-Lastschrift** (Geld einziehen) - pain.008.001.02 / pain.008.001.08
- **SEPA-Ueberweisung** (Geld senden) - pain.001.001.03 / pain.001.001.08 / pain.001.001.09
- **Excel-Upload** - Transaktionen per Excel-Datei (.xlsx/.xls) importieren
- **Manuelle Eingabe** - Transaktionen einzeln hinzufuegen
- **Konfiguration speichern/laden** - Bankdaten als JSON-Datei sichern
- **Auto-Save** - Einstellungen werden automatisch im Browser (localStorage) gespeichert
- **Echtzeit-Validierung** - IBAN-Checksumme, BIC-Format, Betraege, Glaeubiger-ID

## Datenschutz & Sicherheit

| Eigenschaft | Status |
|---|---|
| Datenverarbeitung | 100% lokal im Browser |
| Serveruebertragung | Keine |
| Cookies / Tracking | Keine |
| DSGVO-konform | Ja |
| Open Source | Ja - vollstaendig einsehbar |
| Abhaengigkeiten | Nur XLSX.js (Excel-Parsing) |

**Alle Bankdaten, IBANs, Namen und Betraege werden ausschliesslich in Ihrem Browser verarbeitet. Es findet keinerlei Kommunikation mit externen Servern statt.**

## Projektstruktur

```
sepa-xml-generator/
├── index.html            # Hauptseite mit komplettem UI (HTML-Struktur)
├── sepa-generator.js     # Anwendungslogik (Event-Handling, Validierung, XML-Erzeugung)
├── sepa.min.js           # SEPA-Bibliothek (XML-Dokumentstruktur, ISO 20022 Standard)
├── style.css             # Styling (responsive Design, Animationen)
├── package.json          # Node.js-Konfiguration (nur fuer Tests)
├── tests/
│   └── sepa.test.js      # Automatisierte Tests (83 Tests)
└── README.md             # Diese Datei
```

## Unterstuetzte SEPA-Formate

### Lastschrift (Direct Debit)
| Format | Beschreibung | Empfehlung |
|---|---|---|
| pain.008.001.02 | Aeltere Version | Nur bei Kompatibilitaetsproblemen |
| pain.008.001.08 | Aktuelle Version | Empfohlen |

### Ueberweisung (Credit Transfer)
| Format | Beschreibung | Empfehlung |
|---|---|---|
| pain.001.001.03 | Aeltere Version | Nur bei Kompatibilitaetsproblemen |
| pain.001.001.08 | Neuere Version | - |
| pain.001.001.09 | Neueste Version | Empfohlen |

## Benutzung

### 1. Zahlungsart waehlen
- **Lastschrift**: Fuer Mitgliedsbeitraege, Abos, wiederkehrende Einzuege
- **Ueberweisung**: Fuer Gehaelter, Lieferanten, Auszahlungen

### 2. Konfiguration eingeben
- Initiator-Name (wer erstellt die Datei)
- Ausfuehrungsdatum (optional, Standard: heute)
- **Bei Lastschrift**: Glaeubiger-Name, IBAN, BIC, Glaeubiger-ID, Sequenztyp, Instrumentierung
- **Bei Ueberweisung**: Auftraggeber-Name, IBAN, BIC

### 3. Transaktionen hinzufuegen

**Per Excel-Upload:**
1. Vorlage herunterladen
2. Daten eintragen
3. Datei hochladen (Drag & Drop oder Klick)

**Erwartete Spalten (Lastschrift):**
| Name | IBAN | BIC | Betrag | Verwendungszweck | Mandatsreferenz | Mandatsdatum |
|---|---|---|---|---|---|---|

**Erwartete Spalten (Ueberweisung):**
| Name | IBAN | BIC | Betrag | Verwendungszweck | Referenz |
|---|---|---|---|---|---|

Die Spaltenbezeichnungen werden flexibel erkannt (deutsch/englisch, gross/klein).

**Per manueller Eingabe:**
- Formular ausfuellen und "Zahlung hinzufuegen" klicken
- Beliebig viele Transaktionen nacheinander hinzufuegen

### 4. XML generieren
- Vorschau pruefen
- "SEPA-XML generieren und herunterladen" klicken
- Datei wird automatisch heruntergeladen
- XML-Datei im Online-Banking hochladen

## Konfigurationsdateien

Bankdaten koennen als JSON-Datei gespeichert und spaeter wieder geladen werden:

```json
{
  "paymentType": "transfer",
  "painFormat": "pain.001.001.09",
  "initiatorName": "Meine Firma GmbH",
  "executionDate": "2026-02-15",
  "debtorName": "Meine Firma GmbH",
  "debtorIBAN": "DE89370400440532013000",
  "debtorBIC": "COBADEFFXXX"
}
```

## Technische Details

### Architektur
Die Anwendung besteht aus drei Schichten:

1. **UI-Schicht** (`index.html` + `style.css`) - HTML-Formulare, Vorschautabelle, FAQ
2. **Anwendungslogik** (`sepa-generator.js`) - Event-Handling, Validierung, Datentransformation
3. **SEPA-Bibliothek** (`sepa.min.js`) - ISO 20022 XML-Dokumenterzeugung mit Validierung

### XML-Erzeugungsablauf
```
Excel/Manuelle Eingabe
        ↓
Transaktions-Objekte (JS)
        ↓
SEPA.Document erstellen (pain-Format)
        ↓
PaymentInfo erstellen + konfigurieren
        ↓
Transaktionen erstellen + hinzufuegen
        ↓
doc.addPaymentInfo(info)
        ↓
doc.toString() → XML-String
        ↓
Blob → Download
```

### Validierungen
- **IBAN**: Mod-97-Checksumme (ISO 13616)
- **BIC**: 8 oder 11 Zeichen, Format [A-Z]{6}[A-Z0-9]{2,5}
- **Glaeubiger-ID**: Mod-97-Checksumme (Bundesbank-Format)
- **Betrag**: 0.01 - 999.999.999,99 EUR, max. 2 Dezimalstellen
- **Verwendungszweck**: Max. 140 Zeichen
- **Mandatsreferenz**: Max. 35 Zeichen, SEPA-Zeichensatz
- **BIC/IBAN-Land**: Laendercode-Abgleich

### Browser-APIs
- `localStorage` - Persistente Konfigurationsspeicherung
- `File API` - Excel-Datei-Upload
- `Blob API` - XML-Datei-Download
- `DOMImplementation` - XML-Dokumenterzeugung
- `XMLSerializer` - XML-zu-String-Serialisierung

### Externe Bibliotheken
- [SheetJS (XLSX)](https://sheetjs.com/) v0.18.5 - Excel-Dateien lesen/schreiben (CDN)
- Keine weiteren Laufzeit-Abhaengigkeiten

## Tests

```bash
# Abhaengigkeiten installieren (nur xmldom fuer Node.js-XML-Verarbeitung)
npm install

# Tests ausfuehren
npm test
```

### Testabdeckung (83 Tests)
| Suite | Tests | Beschreibung |
|---|---|---|
| Lastschrift x Formate | 24 | Alle pain.008-Formate mit verschiedenen Optionen |
| Ueberweisung x Formate | 18 | Alle pain.001-Formate mit verschiedenen Optionen |
| Sequenztyp x Instrumentierung | 12 | 4x3 Matrix (FRST/RCUR/OOFF/FNAL x CORE/COR1/B2B) |
| IBAN-Validierung | 8 | Gueltige + ungueltige IBANs |
| Glaeubiger-ID-Validierung | 2 | Gueltige + ungueltige IDs |
| Fehlerfaelle & Grenzwerte | 11 | Betraege, BIC, Mandate, Zeichenlaengen |
| Dokumentstruktur | 2 | addPaymentInfo-Verhalten |
| Typbehandlung | 2 | Date vs. String fuer grpHdr.created |
| Integration | 4 | Vollstaendige Ablauf-Simulationen |

## Kompatibilitaet

Die generierte XML-Datei ist kompatibel mit:
- Sparkassen-Banking
- VR-NetWorld
- Deutsche Bank Business Banking
- DATEV
- StarMoney
- Und allen weiteren Systemen, die ISO 20022 SEPA-XML unterstuetzen

## Lokale Entwicklung

Die Anwendung benoetigt keinen Build-Prozess. Einfach `index.html` im Browser oeffnen:

```bash
# Mit Python (einfacher HTTP-Server)
python3 -m http.server 8080

# Oder direkt im Browser oeffnen
open index.html
```

## Lizenz

Open Source - Der vollstaendige Quellcode ist oeffentlich einsehbar.

## Kontakt

Entwickelt von [Webexperte.Berlin](https://webexperte.berlin)

- Website: [webexperte.berlin](https://webexperte.berlin)
- SEPA-Generator: [sepa-xml-generator.de](https://www.sepa-xml-generator.de)
- GitHub: [github.com/mriege/sepa-xml-generator](https://github.com/mriege/sepa-xml-generator)
