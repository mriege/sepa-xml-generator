#!/usr/bin/env node
/**
 * build-blz-bic.mjs — erzeugt blz-bic.js (BLZ -> BIC Nachschlagetabelle)
 * aus der offiziellen Bankleitzahlendatei der Deutschen Bundesbank.
 *
 * Warum: Manche (aeltere) Bankprogramme validieren SEPA-Dateien gegen ein
 * Schema, dessen <FinInstnId> ausschliesslich <BIC> erlaubt und <Othr>
 * (NOTPROVIDED) ablehnt. Damit Nutzer keinen BIC eintippen muessen, leitet
 * der Generator den BIC aus der deutschen IBAN (BLZ = Stellen 5-12) ab.
 * Grundlage muss die ECHTE Bundesbank-Datei sein – BICs duerfen niemals
 * geraten werden.
 *
 * AKTUALISIERUNG (die Bundesbank veroeffentlicht die Datei quartalsweise):
 *   1. CSV laden von der Download-Seite:
 *      https://www.bundesbank.de/de/aufgaben/unbarer-zahlungsverkehr/serviceangebot/bankleitzahlen/download-bankleitzahlen-602592
 *      (Direktlink-Datei: blz-aktuell-csv-data.csv)
 *   2. node tools/build-blz-bic.mjs <pfad-zur-csv>
 *   3. Ergebnis: blz-bic.js im Projekt-Root (per <script> in index.html geladen).
 *
 * CSV-Spalten (semikolongetrennt, in Anfuehrungszeichen, ISO-8859-1):
 *   0 Bankleitzahl | 1 Merkmal | 2 Bezeichnung | ... | 7 BIC | ...
 * Merkmal "1" = bankleitzahlfuehrende Stelle -> traegt den massgeblichen BIC.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Aufruf: node tools/build-blz-bic.mjs <pfad-zur-blz-csv>');
  process.exit(1);
}

// ISO-8859-1 (Latin-1) dekodieren – die Bundesbank-CSV ist nicht UTF-8.
const raw = readFileSync(csvPath, 'latin1');
const lines = raw.split(/\r?\n/);

// Ein CSV-Feld-Parser, der ";" innerhalb von Anfuehrungszeichen respektiert.
function parseLine(line) {
  const out = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ';' && !inQuotes) {
      out.push(field); field = '';
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

const map = {};
let rows = 0, withBic = 0, skippedNonMain = 0;
for (let i = 1; i < lines.length; i++) { // Zeile 0 = Kopfzeile
  const line = lines[i];
  if (!line.trim()) continue;
  rows++;
  const cols = parseLine(line);
  const blz = (cols[0] || '').trim();
  const merkmal = (cols[1] || '').trim();
  const bic = (cols[7] || '').trim().toUpperCase();
  if (merkmal !== '1') { skippedNonMain++; continue; } // nur die BLZ-fuehrende Stelle
  if (!/^\d{8}$/.test(blz)) continue;
  if (!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) continue; // gueltiges BIC-Format
  map[blz] = bic;
  withBic++;
}

// Deterministisch sortieren, damit Diffs bei Updates lesbar bleiben.
const sorted = {};
for (const k of Object.keys(map).sort()) sorted[k] = map[k];

const header =
`/**
 * blz-bic.js — BLZ -> BIC Nachschlagetabelle (deutsche Banken).
 * AUTOMATISCH GENERIERT aus der Bankleitzahlendatei der Deutschen Bundesbank.
 * NICHT VON HAND BEARBEITEN – stattdessen: node tools/build-blz-bic.mjs <csv>
 * Eintraege: ${Object.keys(sorted).length}
 */
(function (root) {
  var data = `;
const footer = `;
  if (typeof module !== 'undefined' && module.exports) { module.exports = data; }
  else { root.SEPA_BLZ_BIC = data; }
})(typeof window !== 'undefined' ? window : this);
`;

const outPath = join(__dirname, '..', 'blz-bic.js');
writeFileSync(outPath, header + JSON.stringify(sorted) + footer, 'utf8');

console.log(`Zeilen gelesen: ${rows}`);
console.log(`  davon Merkmal!=1 uebersprungen: ${skippedNonMain}`);
console.log(`BLZ->BIC Eintraege geschrieben: ${withBic}`);
console.log(`Ausgabe: ${outPath}  (${(readFileSync(outPath).length / 1024).toFixed(0)} KB)`);
