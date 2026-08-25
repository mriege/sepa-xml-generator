#!/usr/bin/env node
/**
 * fetch-xsd.mjs — laedt die ISO-20022-Schemadateien nach tests/xsd/ und
 * korrigiert einen bekannten Defekt der Bezugsquelle.
 *
 * Warum: Die Testsuite hat lange nur geprueft, ob bestimmte Zeichenketten im
 * erzeugten XML vorkommen. Drei schema-brechende Fehler (<BIC> statt <BICFI>
 * in den .08/.09-Formaten, flaches <ReqdExctnDt> statt <ReqdExctnDt><Dt>,
 * fehlendes NbOfTxs im PmtInf) sind so unentdeckt in Produktion gelangt und
 * erst durch Nutzer-Rueckmeldungen aufgefallen. Seither validieren die Tests
 * jedes erzeugte Dokument gegen das echte Schema.
 *
 * AKTUALISIERUNG:
 *   node tools/fetch-xsd.mjs
 * Ergebnis: tests/xsd/*.xsd (im Repo eingecheckt, damit die Tests ohne
 * Netzzugriff laufen).
 *
 * BEZUGSQUELLE: partners.lhv.ee spiegelt die ISO-Originale. Die ISO selbst
 * bietet die Schemata nur als ZIP hinter einer Katalogseite an, die sich nicht
 * stabil verlinken laesst.
 *
 * BEKANNTER DEFEKT DER QUELLE (wird hier korrigiert):
 *   ServiceLevel8Choice ist dort als <xs:sequence> mit optionalem <Cd> und
 *   PFLICHT-<Prtry> deklariert. Im ISO-Original ist es eine <xs:choice>.
 *   Unkorrigiert meldet jede korrekte SEPA-Datei faelschlich
 *   "Element 'SvcLvl': Missing child element(s). Expected is ( Prtry )".
 *
 * NICHT VERFUEGBAR: pain.001.001.08 wird von der Quelle nicht angeboten.
 * Dieses Format wird in den Tests strukturell statt per XSD geprueft.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'tests', 'xsd');

const BASE = 'https://partners.lhv.ee/assets/files/XSD/';
const FILES = [
  'pain.001.001.03.xsd',
  'pain.001.001.09.xsd',
  'pain.008.001.02.xsd',
  'pain.008.001.08.xsd',
  'supl.001.001.01.xsd',   // von pain.001.001.09 per <xs:import> referenziert
];

/**
 * Stellt ServiceLevel8Choice als echte Choice wieder her (siehe Kopfkommentar).
 * Greift nur innerhalb der so benannten complexTypes, damit keine anderen
 * Sequenzen des Schemas beruehrt werden.
 */
function repairServiceLevelChoice(xsd) {
  return xsd.replace(
    /(<xs:complexType name="ServiceLevel8Choice[^"]*">[\s\S]*?)<xs:sequence>([\s\S]*?)<\/xs:sequence>/g,
    (_, head, body) => `${head}<xs:choice>${body}</xs:choice>`
  );
}

mkdirSync(outDir, { recursive: true });

for (const file of FILES) {
  const res = await fetch(BASE + file);
  if (!res.ok) {
    console.error(`FEHLER: ${file} -> HTTP ${res.status}`);
    process.exit(1);
  }
  const raw = await res.text();
  const repaired = repairServiceLevelChoice(raw);
  writeFileSync(join(outDir, file), repaired);
  const note = repaired === raw ? '' : ' (ServiceLevel8Choice korrigiert)';
  console.log(`${file}: ${repaired.length} Zeichen${note}`);
}

console.log(`\nFertig. Ziel: ${outDir}`);
