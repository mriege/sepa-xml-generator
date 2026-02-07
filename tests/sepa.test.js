const { describe, it } = require('node:test');
const assert = require('node:assert');
const SEPA = require('../sepa.min.js');

// ---------------------------------------------------------------------------
// Valid test data – IBANs pass the mod-97 checksum used by the library.
// All data is fictional but structurally correct.
// ---------------------------------------------------------------------------

const TEST_DATA = {
  creditor: {
    name: 'Muster GmbH',
    iban: 'DE89370400440532013000',
    bic:  'COBADEFFXXX',
    id:   'DE98ZZZ09999999999',      // valid creditor-ID checksum
  },
  debtor: {
    name: 'Max Mustermann',
    iban: 'DE89370400440532013000',
    bic:  'COBADEFFXXX',
  },
  // Additional accounts for multi-transaction tests
  accounts: [
    { name: 'Anna Schmidt',    iban: 'DE75512108001245126199', bic: 'SOLADEST600' },
    { name: 'Bernd Weber',     iban: 'DE27100777770209299700', bic: 'DEUTDEFF'    },
    { name: 'Clara Fischer',   iban: 'DE02120300000000202051', bic: ''            },
  ],
};

// Sequence types and local instrumentations to iterate over
const SEQUENCE_TYPES        = ['FRST', 'RCUR', 'OOFF', 'FNAL'];
const LOCAL_INSTRUMENTATIONS = ['CORE', 'COR1', 'B2B'];

// All supported pain formats grouped by type
const DD_FORMATS  = ['pain.008.001.02', 'pain.008.001.08'];
const CT_FORMATS  = ['pain.001.001.03', 'pain.001.001.08', 'pain.001.001.09'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createDirectDebitDoc(painFormat, opts = {}) {
  const {
    sequenceType = 'RCUR',
    localInstrumentation = 'CORE',
    transactions = [TEST_DATA.accounts[0]],
  } = opts;

  const doc = new SEPA.Document(painFormat);
  doc.grpHdr.id = 'MSG-TEST-001';
  doc.grpHdr.created = new Date('2026-01-15T10:00:00Z');
  doc.grpHdr.initiatorName = TEST_DATA.creditor.name;

  const info = doc.createPaymentInfo();
  info.collectionDate = new Date('2026-02-01');
  info.creditorName = TEST_DATA.creditor.name;
  info.creditorIBAN = TEST_DATA.creditor.iban;
  info.creditorBIC = TEST_DATA.creditor.bic;
  info.creditorId = TEST_DATA.creditor.id;
  info.sequenceType = sequenceType;
  info.localInstrumentation = localInstrumentation;

  for (const t of transactions) {
    const txn = info.createTransaction();
    txn.debtorName = t.name;
    txn.debtorIBAN = t.iban;
    txn.debtorBIC  = t.bic || '';
    txn.amount     = t.amount || 49.99;
    txn.mandateId  = t.mandateId || 'MAND-001';
    txn.mandateSignatureDate = t.mandateSignatureDate || new Date('2025-06-15');
    txn.remittanceInfo = t.remittanceInfo || 'Beitrag Januar 2026';
    info.addTransaction(txn);
  }

  doc.addPaymentInfo(info);
  return doc;
}

function createTransferDoc(painFormat, opts = {}) {
  const { transactions = [TEST_DATA.accounts[0]] } = opts;

  const doc = new SEPA.Document(painFormat);
  doc.grpHdr.id = 'MSG-TEST-002';
  doc.grpHdr.created = new Date('2026-01-15T10:00:00Z');
  doc.grpHdr.initiatorName = TEST_DATA.debtor.name;

  const info = doc.createPaymentInfo();
  info.requestedExecutionDate = new Date('2026-02-01');
  info.debtorName = TEST_DATA.debtor.name;
  info.debtorIBAN = TEST_DATA.debtor.iban;
  info.debtorBIC  = TEST_DATA.debtor.bic;

  for (const t of transactions) {
    const txn = info.createTransaction();
    txn.creditorName = t.name;
    txn.creditorIBAN = t.iban;
    txn.creditorBIC  = t.bic || '';
    txn.amount       = t.amount || 1500.00;
    txn.remittanceInfo = t.remittanceInfo || 'Gehalt Januar 2026';
    txn.end2endId    = t.end2endId || 'NOTPROVIDED';
    info.addTransaction(txn);
  }

  doc.addPaymentInfo(info);
  return doc;
}

function assertValidXML(xml, painFormat) {
  // Basic structural checks every SEPA XML must pass
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'Missing XML declaration');
  assert.ok(xml.includes(`xmlns="urn:iso:std:iso:20022:tech:xsd:${painFormat}"`), `Missing namespace for ${painFormat}`);
  assert.ok(xml.includes('<GrpHdr>'), 'Missing GrpHdr element');
  assert.ok(xml.includes('<MsgId>'), 'Missing MsgId element');
  assert.ok(xml.includes('<CreDtTm>'), 'Missing CreDtTm element');
  assert.ok(xml.includes('<NbOfTxs>'), 'Missing NbOfTxs element');
  assert.ok(xml.includes('<CtrlSum>'), 'Missing CtrlSum element');
  assert.ok(xml.includes('<InitgPty>'), 'Missing InitgPty element');
  assert.ok(xml.includes('<PmtInf>'), 'Missing PmtInf element');
}

// =========================================================================
// TEST SUITES
// =========================================================================

// -------------------------------------------------------------------------
// 1. Direct Debit × pain format combinations
// -------------------------------------------------------------------------

describe('Lastschrift (Direct Debit)', () => {
  for (const fmt of DD_FORMATS) {
    describe(`Format ${fmt}`, () => {

      it('generiert valides XML mit einer Transaktion', () => {
        const doc = createDirectDebitDoc(fmt);
        const xml = doc.toString();
        assertValidXML(xml, fmt);
        assert.ok(xml.includes('<CstmrDrctDbtInitn>'), 'Missing root element');
        assert.ok(xml.includes('<PmtMtd>DD</PmtMtd>'), 'Wrong payment method');
        assert.ok(xml.includes('<NbOfTxs>1</NbOfTxs>'), 'Wrong transaction count');
        assert.ok(xml.includes('Anna Schmidt'), 'Missing debtor name');
        assert.ok(xml.includes('DE75512108001245126199'), 'Missing debtor IBAN');
        assert.ok(xml.includes('<MndtId>MAND-001</MndtId>'), 'Missing mandate ID');
      });

      it('generiert valides XML mit mehreren Transaktionen', () => {
        const doc = createDirectDebitDoc(fmt, {
          transactions: TEST_DATA.accounts.map((a, i) => ({
            ...a,
            amount: (i + 1) * 25.50,
            mandateId: `MAND-${i + 1}`,
          })),
        });
        const xml = doc.toString();
        assertValidXML(xml, fmt);
        assert.ok(xml.includes('<NbOfTxs>3</NbOfTxs>'), 'Wrong transaction count');
        // Control sum = 25.50 + 51.00 + 76.50 = 153.00
        assert.ok(xml.includes('<CtrlSum>153.00</CtrlSum>'), 'Wrong control sum');
        for (const a of TEST_DATA.accounts) {
          assert.ok(xml.includes(a.name), `Missing debtor ${a.name}`);
        }
      });

      // Test all sequence types
      for (const seq of SEQUENCE_TYPES) {
        it(`funktioniert mit Sequenztyp ${seq}`, () => {
          const doc = createDirectDebitDoc(fmt, { sequenceType: seq });
          const xml = doc.toString();
          assertValidXML(xml, fmt);
          assert.ok(xml.includes(`<SeqTp>${seq}</SeqTp>`), `Missing sequence type ${seq}`);
        });
      }

      // Test all local instrumentations
      for (const instr of LOCAL_INSTRUMENTATIONS) {
        it(`funktioniert mit Instrumentierung ${instr}`, () => {
          const doc = createDirectDebitDoc(fmt, { localInstrumentation: instr });
          const xml = doc.toString();
          assertValidXML(xml, fmt);
          assert.ok(xml.includes(`<Cd>${instr}</Cd>`), `Missing instrumentation ${instr}`);
        });
      }

      it('verwendet NOTPROVIDED wenn kein BIC angegeben', () => {
        const doc = createDirectDebitDoc(fmt, {
          transactions: [{ ...TEST_DATA.accounts[2], bic: '' }],
        });
        const xml = doc.toString();
        assertValidXML(xml, fmt);
        assert.ok(xml.includes('NOTPROVIDED'), 'Missing NOTPROVIDED fallback for empty BIC');
      });

      it('enthält korrekte Gläubiger-ID', () => {
        const doc = createDirectDebitDoc(fmt);
        const xml = doc.toString();
        assert.ok(xml.includes(TEST_DATA.creditor.id), 'Missing creditor ID');
        assert.ok(xml.includes('<Prtry>SEPA</Prtry>'), 'Missing SEPA scheme');
      });

      it('enthält korrektes Mandatsdatum', () => {
        const doc = createDirectDebitDoc(fmt, {
          transactions: [{
            ...TEST_DATA.accounts[0],
            mandateSignatureDate: new Date('2025-03-20'),
          }],
        });
        const xml = doc.toString();
        assert.ok(xml.includes('<DtOfSgntr>2025-03-20</DtOfSgntr>'), 'Wrong mandate signature date');
      });
    });
  }
});

// -------------------------------------------------------------------------
// 2. Credit Transfer × pain format combinations
// -------------------------------------------------------------------------

describe('Überweisung (Credit Transfer)', () => {
  for (const fmt of CT_FORMATS) {
    describe(`Format ${fmt}`, () => {

      it('generiert valides XML mit einer Transaktion', () => {
        const doc = createTransferDoc(fmt);
        const xml = doc.toString();
        assertValidXML(xml, fmt);
        assert.ok(xml.includes('<CstmrCdtTrfInitn>'), 'Missing root element');
        assert.ok(xml.includes('<PmtMtd>TRF</PmtMtd>'), 'Wrong payment method');
        assert.ok(xml.includes('<NbOfTxs>1</NbOfTxs>'), 'Wrong transaction count');
        assert.ok(xml.includes('Anna Schmidt'), 'Missing creditor name');
      });

      it('generiert valides XML mit mehreren Transaktionen', () => {
        const doc = createTransferDoc(fmt, {
          transactions: TEST_DATA.accounts.map((a, i) => ({
            ...a,
            amount: (i + 1) * 1000,
          })),
        });
        const xml = doc.toString();
        assertValidXML(xml, fmt);
        assert.ok(xml.includes('<NbOfTxs>3</NbOfTxs>'), 'Wrong transaction count');
        // Control sum = 1000 + 2000 + 3000 = 6000
        assert.ok(xml.includes('<CtrlSum>6000.00</CtrlSum>'), 'Wrong control sum');
      });

      it('setzt Ausführungsdatum korrekt', () => {
        const doc = createTransferDoc(fmt);
        const xml = doc.toString();
        assert.ok(xml.includes('2026-02-01'), 'Missing execution date');
      });

      it('funktioniert ohne BIC (NOTPROVIDED)', () => {
        const doc = createTransferDoc(fmt, {
          transactions: [{ ...TEST_DATA.accounts[2], bic: '' }],
        });
        const xml = doc.toString();
        assertValidXML(xml, fmt);
        assert.ok(xml.includes('NOTPROVIDED'), 'Missing NOTPROVIDED for empty BIC');
      });

      it('enthält End-to-End-ID', () => {
        const doc = createTransferDoc(fmt, {
          transactions: [{
            ...TEST_DATA.accounts[0],
            end2endId: 'REF-2026-001',
          }],
        });
        const xml = doc.toString();
        assert.ok(xml.includes('<EndToEndId>REF-2026-001</EndToEndId>'), 'Missing end-to-end ID');
      });

      it('keine Gläubiger-ID-Validierung bei Überweisungen', () => {
        // This must NOT throw – debtorId validation was the old Bug #5
        assert.doesNotThrow(() => {
          const doc = createTransferDoc(fmt);
          doc.toString();
        }, 'Transfer should not validate debtorId');
      });
    });
  }
});

// -------------------------------------------------------------------------
// 3. Sequence type × Instrumentation matrix (DD only)
// -------------------------------------------------------------------------

describe('Lastschrift: Sequenztyp × Instrumentierung Matrix', () => {
  const fmt = 'pain.008.001.08';
  for (const seq of SEQUENCE_TYPES) {
    for (const instr of LOCAL_INSTRUMENTATIONS) {
      it(`${seq} + ${instr} generiert fehlerfreies XML`, () => {
        assert.doesNotThrow(() => {
          const doc = createDirectDebitDoc(fmt, {
            sequenceType: seq,
            localInstrumentation: instr,
          });
          const xml = doc.toString();
          assertValidXML(xml, fmt);
          assert.ok(xml.includes(`<SeqTp>${seq}</SeqTp>`));
          assert.ok(xml.includes(`<Cd>${instr}</Cd>`));
        });
      });
    }
  }
});

// -------------------------------------------------------------------------
// 4. IBAN validation
// -------------------------------------------------------------------------

describe('IBAN-Validierung', () => {
  const VALID_IBANS = [
    'DE89370400440532013000',
    'DE75512108001245126199',
    'DE27100777770209299700',
    'DE02120300000000202051',
  ];
  const INVALID_IBANS = [
    'DE00370400440532013000',   // wrong checksum
    'DE89370400440532013001',   // altered last digit
    'INVALID',                  // garbage
    'XX12345',                  // too short
  ];

  for (const iban of VALID_IBANS) {
    it(`akzeptiert gültige IBAN ${iban}`, () => {
      assert.ok(SEPA.validateIBAN(iban), `IBAN ${iban} should be valid`);
    });
  }

  for (const iban of INVALID_IBANS) {
    it(`lehnt ungültige IBAN ${iban} ab`, () => {
      assert.ok(!SEPA.validateIBAN(iban), `IBAN ${iban} should be invalid`);
    });
  }
});

// -------------------------------------------------------------------------
// 5. Creditor-ID validation
// -------------------------------------------------------------------------

describe('Gläubiger-ID-Validierung', () => {
  it('akzeptiert gültige Gläubiger-ID', () => {
    assert.ok(SEPA.validateCreditorID('DE98ZZZ09999999999'));
  });

  it('lehnt ungültige Gläubiger-ID ab', () => {
    assert.ok(!SEPA.validateCreditorID('DE00ZZZ09999999999'));
    assert.ok(!SEPA.validateCreditorID(''));
    assert.ok(!SEPA.validateCreditorID('INVALID'));
  });
});

// -------------------------------------------------------------------------
// 6. Edge cases & error handling
// -------------------------------------------------------------------------

describe('Fehlerfälle und Grenzwerte', () => {

  it('wirft Fehler bei ungültiger IBAN in Transaktion', () => {
    assert.throws(() => {
      const doc = createDirectDebitDoc('pain.008.001.08', {
        transactions: [{ ...TEST_DATA.accounts[0], iban: 'DE00000000000000000000' }],
      });
      doc.toString();
    }, /IBAN/);
  });

  it('wirft Fehler bei Betrag = 0', () => {
    assert.throws(() => {
      const doc = new SEPA.Document('pain.008.001.08');
      doc.grpHdr.id = 'MSG-TEST';
      doc.grpHdr.created = new Date();
      doc.grpHdr.initiatorName = 'Test';
      const info = doc.createPaymentInfo();
      info.collectionDate = new Date();
      info.creditorName = TEST_DATA.creditor.name;
      info.creditorIBAN = TEST_DATA.creditor.iban;
      info.creditorBIC = TEST_DATA.creditor.bic;
      info.creditorId = TEST_DATA.creditor.id;
      const txn = info.createTransaction();
      txn.debtorName = 'Test Person';
      txn.debtorIBAN = 'DE89370400440532013000';
      txn.debtorBIC = 'COBADEFFXXX';
      txn.amount = 0; // explicitly zero, no fallback
      txn.mandateId = 'M-001';
      txn.mandateSignatureDate = new Date();
      txn.remittanceInfo = 'Test';
      info.addTransaction(txn);
      doc.addPaymentInfo(info);
      doc.toString();
    }, /amount/);
  });

  it('wirft Fehler bei negativem Betrag', () => {
    assert.throws(() => {
      const doc = createDirectDebitDoc('pain.008.001.08', {
        transactions: [{ ...TEST_DATA.accounts[0], amount: -10 }],
      });
      doc.toString();
    }, /amount/);
  });

  it('akzeptiert Betrag von 0.01 EUR (Minimum)', () => {
    assert.doesNotThrow(() => {
      const doc = createDirectDebitDoc('pain.008.001.08', {
        transactions: [{ ...TEST_DATA.accounts[0], amount: 0.01 }],
      });
      const xml = doc.toString();
      assert.ok(xml.includes('0.01'));
    });
  });

  it('akzeptiert hohe Beträge', () => {
    assert.doesNotThrow(() => {
      const doc = createTransferDoc('pain.001.001.09', {
        transactions: [{ ...TEST_DATA.accounts[0], amount: 999999999.99 }],
      });
      const xml = doc.toString();
      assert.ok(xml.includes('999999999.99'));
    });
  });

  it('wirft Fehler bei ungültigem Sequenztyp', () => {
    assert.throws(() => {
      createDirectDebitDoc('pain.008.001.08', {
        sequenceType: 'INVALID',
      }).toString();
    }, /sequenceType/);
  });

  it('wirft Fehler bei ungültiger Instrumentierung', () => {
    assert.throws(() => {
      createDirectDebitDoc('pain.008.001.08', {
        localInstrumentation: 'INVALID',
      }).toString();
    }, /localInstrumentation/);
  });

  it('wirft Fehler bei ungültiger BIC-Länge', () => {
    assert.throws(() => {
      const doc = createDirectDebitDoc('pain.008.001.08', {
        transactions: [{ ...TEST_DATA.accounts[0], bic: 'ABC' }],
      });
      doc.toString();
    }, /BIC/);
  });

  it('wirft Fehler bei fehlendem Mandatsdatum (Lastschrift)', () => {
    assert.throws(() => {
      const doc = new SEPA.Document('pain.008.001.08');
      doc.grpHdr.id = 'MSG-TEST';
      doc.grpHdr.created = new Date();
      doc.grpHdr.initiatorName = 'Test';
      const info = doc.createPaymentInfo();
      info.collectionDate = new Date();
      info.creditorName = TEST_DATA.creditor.name;
      info.creditorIBAN = TEST_DATA.creditor.iban;
      info.creditorBIC = TEST_DATA.creditor.bic;
      info.creditorId = TEST_DATA.creditor.id;
      const txn = info.createTransaction();
      txn.debtorName = 'Test Person';
      txn.debtorIBAN = 'DE89370400440532013000';
      txn.amount = 10;
      txn.mandateId = 'M-001';
      // mandateSignatureDate intentionally NOT set (null)
      txn.remittanceInfo = 'Test';
      info.addTransaction(txn);
      doc.addPaymentInfo(info);
      doc.toString();
    }, /mandateSignatureDate/);
  });

  it('Verwendungszweck bis 140 Zeichen erlaubt', () => {
    const longPurpose = 'A'.repeat(140);
    assert.doesNotThrow(() => {
      const doc = createTransferDoc('pain.001.001.09', {
        transactions: [{ ...TEST_DATA.accounts[0], remittanceInfo: longPurpose }],
      });
      doc.toString();
    });
  });

  it('wirft Fehler bei Verwendungszweck über 140 Zeichen', () => {
    const tooLong = 'A'.repeat(141);
    assert.throws(() => {
      const doc = createTransferDoc('pain.001.001.09', {
        transactions: [{ ...TEST_DATA.accounts[0], remittanceInfo: tooLong }],
      });
      doc.toString();
    }, /remittanceInfo/);
  });
});

// -------------------------------------------------------------------------
// 7. Document structure – ensure addPaymentInfo works
// -------------------------------------------------------------------------

describe('Dokumentstruktur (addPaymentInfo)', () => {

  it('XML enthält PmtInf nur wenn addPaymentInfo aufgerufen wird', () => {
    const doc = new SEPA.Document('pain.001.001.09');
    doc.grpHdr.id = 'MSG-EMPTY';
    doc.grpHdr.created = new Date();
    doc.grpHdr.initiatorName = 'Test';
    // Deliberately do NOT call addPaymentInfo
    const xml = doc.toString();
    assert.ok(!xml.includes('<PmtInf>'), 'Should not contain PmtInf without addPaymentInfo');
    assert.ok(xml.includes('<NbOfTxs>0</NbOfTxs>'), 'Transaction count should be 0');
  });

  it('XML enthält PmtInf wenn addPaymentInfo aufgerufen wird', () => {
    const doc = createTransferDoc('pain.001.001.09');
    const xml = doc.toString();
    assert.ok(xml.includes('<PmtInf>'), 'Should contain PmtInf');
    assert.ok(xml.includes('<NbOfTxs>1</NbOfTxs>'), 'Transaction count should be 1');
  });
});

// -------------------------------------------------------------------------
// 8. grpHdr.created must be a Date object
// -------------------------------------------------------------------------

describe('grpHdr.created Typbehandlung', () => {

  it('Date-Objekt funktioniert korrekt', () => {
    assert.doesNotThrow(() => {
      const doc = createTransferDoc('pain.001.001.09');
      const xml = doc.toString();
      assert.ok(xml.includes('<CreDtTm>'), 'Must contain CreDtTm');
      assert.ok(xml.includes('2026-01-15T10:00:00'), 'Must contain correct ISO date');
    });
  });

  it('String statt Date wirft Fehler (alter Bug)', () => {
    assert.throws(() => {
      const doc = new SEPA.Document('pain.001.001.09');
      doc.grpHdr.id = 'MSG-TEST';
      doc.grpHdr.created = new Date().toISOString(); // Bug: String statt Date
      doc.grpHdr.initiatorName = 'Test';
      const info = doc.createPaymentInfo();
      info.requestedExecutionDate = new Date();
      info.debtorName = TEST_DATA.debtor.name;
      info.debtorIBAN = TEST_DATA.debtor.iban;
      const txn = info.createTransaction();
      txn.creditorName = 'Test';
      txn.creditorIBAN = 'DE89370400440532013000';
      txn.amount = 10;
      txn.remittanceInfo = 'Test';
      txn.end2endId = 'E2E-001';
      info.addTransaction(txn);
      doc.addPaymentInfo(info);
      doc.toString();
    }, /toISOString is not a function/);
  });
});

// -------------------------------------------------------------------------
// 9. Full integration: simulate exactly what sepa-generator.js does
// -------------------------------------------------------------------------

describe('Integration: Simulation des Generator-Flows', () => {

  it('Lastschrift-Flow pain.008.001.08 komplett', () => {
    // Simulates generateAndDownload() for direct debit
    const painFormat = 'pain.008.001.08';
    const doc = new SEPA.Document(painFormat);
    doc.grpHdr.id = 'MSG-1706789012345-abc';
    doc.grpHdr.created = new Date();                           // Fix: Date, not string
    doc.grpHdr.initiatorName = 'Verein Musterstadt e.V.';

    const info = doc.createPaymentInfo();
    info.collectionDate = new Date('2026-02-15');              // Fix: Date, not string
    info.creditorName = 'Verein Musterstadt e.V.';
    info.creditorIBAN = 'DE89370400440532013000';
    info.creditorBIC = 'COBADEFFXXX';
    info.creditorId = 'DE98ZZZ09999999999';
    info.sequenceType = 'RCUR';
    info.localInstrumentation = 'CORE';                        // Fix: correct property name

    const members = [
      { name: 'Anna Schmidt',  iban: 'DE75512108001245126199', bic: 'SOLADEST600', amount: 25.00, mandate: 'M-2025-001' },
      { name: 'Bernd Weber',   iban: 'DE27100777770209299700', bic: 'DEUTDEFF',    amount: 25.00, mandate: 'M-2025-002' },
      { name: 'Clara Fischer', iban: 'DE02120300000000202051', bic: '',             amount: 50.00, mandate: 'M-2025-003' },
    ];

    for (const m of members) {
      const txn = info.createTransaction();
      txn.debtorName = m.name;
      txn.debtorIBAN = m.iban;
      txn.debtorBIC = m.bic;
      txn.amount = m.amount;
      txn.mandateId = m.mandate;
      txn.mandateSignatureDate = new Date('2025-01-01');
      txn.remittanceInfo = 'Mitgliedsbeitrag Q1 2026';
      info.addTransaction(txn);
    }

    doc.addPaymentInfo(info);                                  // Fix: must call this

    const xml = doc.toString();
    assertValidXML(xml, painFormat);
    assert.ok(xml.includes('<CstmrDrctDbtInitn>'));
    assert.ok(xml.includes('<NbOfTxs>3</NbOfTxs>'));
    assert.ok(xml.includes('<CtrlSum>100.00</CtrlSum>'));
    assert.ok(xml.includes('<PmtMtd>DD</PmtMtd>'));
    assert.ok(xml.includes('<SeqTp>RCUR</SeqTp>'));
    assert.ok(xml.includes('<Cd>CORE</Cd>'));
    assert.ok(xml.includes('DE98ZZZ09999999999'));
    for (const m of members) {
      assert.ok(xml.includes(m.name), `Missing member ${m.name}`);
      assert.ok(xml.includes(m.iban), `Missing IBAN for ${m.name}`);
    }
  });

  it('Überweisungs-Flow pain.001.001.09 komplett', () => {
    // Simulates generateAndDownload() for credit transfer
    const painFormat = 'pain.001.001.09';
    const doc = new SEPA.Document(painFormat);
    doc.grpHdr.id = 'MSG-1706789012345-def';
    doc.grpHdr.created = new Date();
    doc.grpHdr.initiatorName = 'Lothar Vogel';

    const info = doc.createPaymentInfo();
    info.requestedExecutionDate = new Date('2026-01-07');       // Fix: correct property
    info.debtorName = 'Lothar Vogel';
    info.debtorIBAN = 'DE89370400440532013000';
    info.debtorBIC = 'COBADEFFXXX';

    const recipients = [
      { name: 'Horst Richter',     iban: 'DE75512108001245126199', amount: 1500, purpose: 'Gehalt Januar 2026' },
      { name: 'Erika Moppelhaus',  iban: 'DE27100777770209299700', amount: 2000, purpose: 'Gehalt Januar 2026' },
    ];

    for (const r of recipients) {
      const txn = info.createTransaction();
      txn.creditorName = r.name;
      txn.creditorIBAN = r.iban;
      txn.creditorBIC = '';
      txn.amount = r.amount;
      txn.remittanceInfo = r.purpose;
      txn.end2endId = 'NOTPROVIDED';
      info.addTransaction(txn);
    }

    doc.addPaymentInfo(info);

    const xml = doc.toString();
    assertValidXML(xml, painFormat);
    assert.ok(xml.includes('<CstmrCdtTrfInitn>'));
    assert.ok(xml.includes('<NbOfTxs>2</NbOfTxs>'));
    assert.ok(xml.includes('<CtrlSum>3500.00</CtrlSum>'));
    assert.ok(xml.includes('<PmtMtd>TRF</PmtMtd>'));
    assert.ok(xml.includes('Lothar Vogel'));
    for (const r of recipients) {
      assert.ok(xml.includes(r.name), `Missing recipient ${r.name}`);
      assert.ok(xml.includes(r.purpose), `Missing purpose for ${r.name}`);
    }
  });

  it('Überweisungs-Flow pain.001.001.08 komplett', () => {
    const painFormat = 'pain.001.001.08';
    const doc = new SEPA.Document(painFormat);
    doc.grpHdr.id = 'MSG-TEST-CT08';
    doc.grpHdr.created = new Date();
    doc.grpHdr.initiatorName = 'Firma Test AG';

    const info = doc.createPaymentInfo();
    info.requestedExecutionDate = new Date('2026-03-01');
    info.debtorName = 'Firma Test AG';
    info.debtorIBAN = 'DE89370400440532013000';
    info.debtorBIC = 'COBADEFFXXX';

    const txn = info.createTransaction();
    txn.creditorName = 'Lieferant GmbH';
    txn.creditorIBAN = 'DE02120300000000202051';
    txn.creditorBIC = '';
    txn.amount = 4999.99;
    txn.remittanceInfo = 'Rechnung RE-2026-0042';
    txn.end2endId = 'RE-2026-0042';
    info.addTransaction(txn);

    doc.addPaymentInfo(info);

    const xml = doc.toString();
    assertValidXML(xml, painFormat);
    assert.ok(xml.includes('<CstmrCdtTrfInitn>'));
    assert.ok(xml.includes('4999.99'));
    assert.ok(xml.includes('RE-2026-0042'));
  });

  it('Lastschrift-Flow pain.008.001.02 (Legacy) komplett', () => {
    const painFormat = 'pain.008.001.02';
    const doc = new SEPA.Document(painFormat);
    doc.grpHdr.id = 'MSG-TEST-DD02';
    doc.grpHdr.created = new Date();
    doc.grpHdr.initiatorName = 'Sportverein Tübingen';

    const info = doc.createPaymentInfo();
    info.collectionDate = new Date('2026-04-01');
    info.creditorName = 'Sportverein Tübingen';
    info.creditorIBAN = 'DE89370400440532013000';
    info.creditorBIC = 'COBADEFFXXX';
    info.creditorId = 'DE98ZZZ09999999999';
    info.sequenceType = 'FRST';
    info.localInstrumentation = 'B2B';

    const txn = info.createTransaction();
    txn.debtorName = 'Mitglied Eins';
    txn.debtorIBAN = 'DE75512108001245126199';
    txn.debtorBIC = 'SOLADEST600';
    txn.amount = 120.00;
    txn.mandateId = 'SV-2026-001';
    txn.mandateSignatureDate = new Date('2026-01-15');
    txn.remittanceInfo = 'Jahresbeitrag 2026';
    info.addTransaction(txn);

    doc.addPaymentInfo(info);

    const xml = doc.toString();
    assertValidXML(xml, painFormat);
    assert.ok(xml.includes('<CstmrDrctDbtInitn>'));
    assert.ok(xml.includes('<SeqTp>FRST</SeqTp>'));
    assert.ok(xml.includes('<Cd>B2B</Cd>'));
    assert.ok(xml.includes('120.00'));
  });
});

// =========================================================================
// EXCEL-IMPORT & -VERARBEITUNG
// =========================================================================
// Simuliert den Datenfluss: Excel-Zeilen → Mapping (wie in sepa-generator.js
// handleFileSelect, Zeilen 864-883) → SEPA-Library → XML-Validierung.
//
// Da sepa-generator.js Browser-Code mit DOM-Abhaengigkeiten ist, wird die
// Mapping-Logik hier 1:1 nachgebaut und getestet.
// =========================================================================

// ---------------------------------------------------------------------------
// Excel-Hilfs­funktionen
// ---------------------------------------------------------------------------

/**
 * Simuliert die Spalten-Mapping-Logik aus sepa-generator.js handleFileSelect().
 * Wandelt Excel-Zeilen (wie von XLSX.utils.sheet_to_json) in Transaktions-Objekte um.
 *
 * @param {Object[]} rows - Array von Zeilen-Objekten mit Spaltennamen als Keys
 * @param {string} paymentType - 'directDebit' oder 'transfer'
 * @returns {Object[]} Array von Transaktions-Objekten
 */
function processExcelRows(rows, paymentType) {
  return rows.map(row => {
    const t = {
      name: row.Name || row.name || '',
      iban: (row.IBAN || row.iban || '').toString().replace(/\s/g, ''),
      bic: (row.BIC || row.bic || '').toString(),
      amount: parseFloat(row.Betrag || row.betrag || row.Amount || row.amount || 0),
      remittanceInfo: row.Verwendungszweck || row.verwendungszweck || row.Purpose || row.purpose || '',
    };
    if (paymentType === 'directDebit') {
      t.mandateId = row.Mandatsreferenz || row.mandatsreferenz || row.MandateId || row.mandateId || '';
      t.mandateSignatureDate = row.Mandatsdatum || row.mandatsdatum || row.MandateDate || row.mandateDate || '';
    } else {
      t.mandateId = row.Referenz || row.referenz || row.Reference || row.reference || '';
    }
    return t;
  });
}

/**
 * Vollstaendige Pipeline: Excel-Zeilen → SEPA XML-String.
 * Simuliert generateAndDownload() aus sepa-generator.js (Zeilen 991-1065).
 *
 * @param {Object[]} rows - Excel-Zeilen (wie von sheet_to_json)
 * @param {string} paymentType - 'directDebit' oder 'transfer'
 * @param {string} painFormat - Pain-Format-String
 * @returns {string} Generierter XML-String
 */
function excelToXML(rows, paymentType, painFormat) {
  const transactions = processExcelRows(rows, paymentType);

  const doc = new SEPA.Document(painFormat);
  doc.grpHdr.id = 'MSG-EXCEL-TEST';
  doc.grpHdr.created = new Date('2026-01-15T10:00:00Z');
  doc.grpHdr.initiatorName = 'Excel Test Initiator';

  const info = doc.createPaymentInfo();

  if (paymentType === 'directDebit') {
    info.collectionDate = new Date('2026-02-01');
    info.creditorName = TEST_DATA.creditor.name;
    info.creditorIBAN = TEST_DATA.creditor.iban;
    info.creditorBIC = TEST_DATA.creditor.bic;
    info.creditorId = TEST_DATA.creditor.id;
    info.sequenceType = 'RCUR';
    info.localInstrumentation = 'CORE';

    for (const t of transactions) {
      const txn = info.createTransaction();
      txn.debtorName = t.name;
      txn.debtorIBAN = t.iban;
      txn.debtorBIC = t.bic || '';
      txn.amount = parseFloat(t.amount);
      txn.mandateId = t.mandateId;
      const d = t.mandateSignatureDate ? new Date(t.mandateSignatureDate) : new Date();
      txn.mandateSignatureDate = isNaN(d.getTime()) ? new Date() : d;
      txn.remittanceInfo = t.remittanceInfo;
      info.addTransaction(txn);
    }
  } else {
    info.requestedExecutionDate = new Date('2026-02-01');
    info.debtorName = TEST_DATA.debtor.name;
    info.debtorIBAN = TEST_DATA.debtor.iban;
    info.debtorBIC = TEST_DATA.debtor.bic;

    for (const t of transactions) {
      const txn = info.createTransaction();
      txn.creditorName = t.name;
      txn.creditorIBAN = t.iban;
      txn.creditorBIC = t.bic || '';
      txn.amount = parseFloat(t.amount);
      txn.remittanceInfo = t.remittanceInfo;
      txn.end2endId = t.mandateId || 'NOTPROVIDED';
      info.addTransaction(txn);
    }
  }

  doc.addPaymentInfo(info);
  return doc.toString();
}

// Beispiel-Zeilen wie sie die Excel-Vorlage (Template) liefern wuerde
const TEMPLATE_ROWS_DD = [
  { Name: 'Max Mustermann',  IBAN: 'DE89370400440532013000', BIC: 'COBADEFFXXX', Betrag: 45.00, Verwendungszweck: 'Mitgliedsbeitrag Januar 2025', Mandatsreferenz: 'MAND-001-2025', Mandatsdatum: '2025-01-01' },
  { Name: 'Erika Musterfrau', IBAN: 'DE75512108001245126199', BIC: '',            Betrag: 30.00, Verwendungszweck: 'Mitgliedsbeitrag Januar 2025', Mandatsreferenz: 'MAND-002-2025', Mandatsdatum: '2025-01-01' },
];

const TEMPLATE_ROWS_CT = [
  { Name: 'Max Mustermann',  IBAN: 'DE89370400440532013000', BIC: 'COBADEFFXXX', Betrag: 1500.00, Verwendungszweck: 'Gehalt Januar 2025', Referenz: 'REF-001' },
  { Name: 'Erika Musterfrau', IBAN: 'DE75512108001245126199', BIC: '',            Betrag: 2000.00, Verwendungszweck: 'Gehalt Januar 2025', Referenz: 'REF-002' },
];

// -------------------------------------------------------------------------
// 10. Excel-Import: Spalten-Mapping
// -------------------------------------------------------------------------

describe('Excel-Import: Spalten-Mapping', () => {

  it('erkennt deutsche Spalten bei Lastschrift', () => {
    const rows = [{
      Name: 'Anna Schmidt', IBAN: 'DE75512108001245126199', BIC: 'SOLADEST600',
      Betrag: 49.99, Verwendungszweck: 'Beitrag', Mandatsreferenz: 'MAND-001', Mandatsdatum: '2025-06-15',
    }];
    const result = processExcelRows(rows, 'directDebit');
    assert.strictEqual(result[0].name, 'Anna Schmidt');
    assert.strictEqual(result[0].iban, 'DE75512108001245126199');
    assert.strictEqual(result[0].bic, 'SOLADEST600');
    assert.strictEqual(result[0].amount, 49.99);
    assert.strictEqual(result[0].remittanceInfo, 'Beitrag');
    assert.strictEqual(result[0].mandateId, 'MAND-001');
    assert.strictEqual(result[0].mandateSignatureDate, '2025-06-15');
  });

  it('erkennt deutsche Spalten bei Überweisung', () => {
    const rows = [{
      Name: 'Bernd Weber', IBAN: 'DE27100777770209299700', BIC: 'DEUTDEFF',
      Betrag: 1500, Verwendungszweck: 'Gehalt', Referenz: 'REF-2026-001',
    }];
    const result = processExcelRows(rows, 'transfer');
    assert.strictEqual(result[0].name, 'Bernd Weber');
    assert.strictEqual(result[0].iban, 'DE27100777770209299700');
    assert.strictEqual(result[0].amount, 1500);
    assert.strictEqual(result[0].mandateId, 'REF-2026-001');
  });

  it('erkennt englische Spalten', () => {
    const rows = [{
      name: 'John Doe', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX',
      Amount: 100, Purpose: 'Invoice', MandateId: 'M-001', MandateDate: '2025-03-01',
    }];
    const result = processExcelRows(rows, 'directDebit');
    assert.strictEqual(result[0].name, 'John Doe');
    assert.strictEqual(result[0].iban, 'DE89370400440532013000');
    assert.strictEqual(result[0].amount, 100);
    assert.strictEqual(result[0].remittanceInfo, 'Invoice');
    assert.strictEqual(result[0].mandateId, 'M-001');
    assert.strictEqual(result[0].mandateSignatureDate, '2025-03-01');
  });

  it('erkennt kleingeschriebene Spalten', () => {
    const rows = [{
      name: 'Test Person', iban: 'DE89370400440532013000', bic: '',
      betrag: 25.50, verwendungszweck: 'Test Zweck',
    }];
    const result = processExcelRows(rows, 'transfer');
    assert.strictEqual(result[0].name, 'Test Person');
    assert.strictEqual(result[0].amount, 25.50);
    assert.strictEqual(result[0].remittanceInfo, 'Test Zweck');
  });

  it('erkennt gemischte Spaltensprachen', () => {
    const rows = [{
      Name: 'Mixed Person', iban: 'DE89370400440532013000', BIC: 'COBADEFFXXX',
      Amount: 75, Verwendungszweck: 'Gemischt',
    }];
    const result = processExcelRows(rows, 'transfer');
    assert.strictEqual(result[0].name, 'Mixed Person');
    assert.strictEqual(result[0].iban, 'DE89370400440532013000');
    assert.strictEqual(result[0].bic, 'COBADEFFXXX');
    assert.strictEqual(result[0].amount, 75);
    assert.strictEqual(result[0].remittanceInfo, 'Gemischt');
  });

  it('Überweisung liest Referenz-Spalte statt Mandatsreferenz', () => {
    const rows = [{
      Name: 'Test', IBAN: 'DE89370400440532013000', BIC: '',
      Betrag: 100, Verwendungszweck: 'Test', Referenz: 'MY-REF', Mandatsreferenz: 'SHOULD-IGNORE',
    }];
    const result = processExcelRows(rows, 'transfer');
    // Bei Überweisung soll Referenz gelesen werden, nicht Mandatsreferenz
    assert.strictEqual(result[0].mandateId, 'MY-REF');
  });

  it('Lastschrift liest Mandatsreferenz-Spalte statt Referenz', () => {
    const rows = [{
      Name: 'Test', IBAN: 'DE89370400440532013000', BIC: '',
      Betrag: 100, Verwendungszweck: 'Test', Mandatsreferenz: 'MAND-123', Mandatsdatum: '2025-01-01',
      Referenz: 'SHOULD-IGNORE',
    }];
    const result = processExcelRows(rows, 'directDebit');
    assert.strictEqual(result[0].mandateId, 'MAND-123');
  });
});

// -------------------------------------------------------------------------
// 11. Excel-Import: Datenverarbeitung
// -------------------------------------------------------------------------

describe('Excel-Import: Datenverarbeitung', () => {

  it('entfernt Whitespace aus IBAN', () => {
    const rows = [{
      Name: 'Test', IBAN: 'DE89 3704 0044 0532 0130 00', BIC: '', Betrag: 10, Verwendungszweck: 'Test',
    }];
    const result = processExcelRows(rows, 'transfer');
    assert.strictEqual(result[0].iban, 'DE89370400440532013000');
  });

  it('leerer BIC wird als NOTPROVIDED im XML', () => {
    const rows = [{
      Name: 'Clara Fischer', IBAN: 'DE02120300000000202051', BIC: '', Betrag: 50, Verwendungszweck: 'Test',
      Referenz: 'REF-001',
    }];
    const xml = excelToXML(rows, 'transfer', 'pain.001.001.09');
    assert.ok(xml.includes('NOTPROVIDED'), 'Leerer BIC sollte als NOTPROVIDED erscheinen');
  });

  it('Betrag als String wird korrekt geparsed', () => {
    const rows = [{
      Name: 'Test', IBAN: 'DE89370400440532013000', BIC: 'COBADEFFXXX',
      Betrag: '45.00', Verwendungszweck: 'Test', Referenz: 'REF',
    }];
    const result = processExcelRows(rows, 'transfer');
    assert.strictEqual(result[0].amount, 45.00);
    assert.strictEqual(typeof result[0].amount, 'number');
  });

  it('fehlender Betrag wird zu 0 (NaN-sicher)', () => {
    const rows = [{ Name: 'Test', IBAN: 'DE89370400440532013000', BIC: '' }];
    const result = processExcelRows(rows, 'transfer');
    assert.strictEqual(result[0].amount, 0);
  });

  it('fehlende optionale Felder werden als leere Strings gesetzt', () => {
    const rows = [{ Name: 'Nur Name', IBAN: 'DE89370400440532013000', Betrag: 10 }];
    const result = processExcelRows(rows, 'transfer');
    assert.strictEqual(result[0].bic, '');  // (undefined || '') → ''
    assert.strictEqual(result[0].remittanceInfo, '');
    assert.strictEqual(result[0].mandateId, '');
  });

  it('verarbeitet mehrere Zeilen korrekt', () => {
    const rows = [
      { Name: 'Person A', IBAN: 'DE89370400440532013000', BIC: 'COBADEFFXXX', Betrag: 100, Verwendungszweck: 'A' },
      { Name: 'Person B', IBAN: 'DE75512108001245126199', BIC: 'SOLADEST600', Betrag: 200, Verwendungszweck: 'B' },
      { Name: 'Person C', IBAN: 'DE27100777770209299700', BIC: 'DEUTDEFF',    Betrag: 300, Verwendungszweck: 'C' },
    ];
    const result = processExcelRows(rows, 'transfer');
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0].name, 'Person A');
    assert.strictEqual(result[1].name, 'Person B');
    assert.strictEqual(result[2].name, 'Person C');
    assert.strictEqual(result[0].amount + result[1].amount + result[2].amount, 600);
  });

  it('IBAN als Zahl wird korrekt zu String konvertiert', () => {
    // Excel kann IBANs als Zahlen interpretieren
    const rows = [{
      Name: 'Test', IBAN: 1234567890, BIC: '', Betrag: 10, Verwendungszweck: 'Test',
    }];
    const result = processExcelRows(rows, 'transfer');
    assert.strictEqual(typeof result[0].iban, 'string');
    assert.strictEqual(result[0].iban, '1234567890');
  });
});

// -------------------------------------------------------------------------
// 12. Excel-Import: End-to-End Pipeline
// -------------------------------------------------------------------------

describe('Excel-Import: End-to-End Pipeline', () => {

  it('Lastschrift-Vorlage erzeugt valides XML', () => {
    const xml = excelToXML(TEMPLATE_ROWS_DD, 'directDebit', 'pain.008.001.08');
    assertValidXML(xml, 'pain.008.001.08');
    assert.ok(xml.includes('<CstmrDrctDbtInitn>'), 'Fehlendes Root-Element');
    assert.ok(xml.includes('<PmtMtd>DD</PmtMtd>'), 'Falsche Zahlungsmethode');
    assert.ok(xml.includes('<NbOfTxs>2</NbOfTxs>'), 'Falsche Transaktionsanzahl');
    assert.ok(xml.includes('<CtrlSum>75.00</CtrlSum>'), 'Falsche Kontrollsumme (45+30)');
    assert.ok(xml.includes('Max Mustermann'), 'Fehlender Schuldner');
    assert.ok(xml.includes('Erika Musterfrau'), 'Fehlender Schuldner');
    assert.ok(xml.includes('MAND-001-2025'), 'Fehlende Mandatsreferenz');
    assert.ok(xml.includes('MAND-002-2025'), 'Fehlende Mandatsreferenz');
  });

  it('Überweisungs-Vorlage erzeugt valides XML', () => {
    const xml = excelToXML(TEMPLATE_ROWS_CT, 'transfer', 'pain.001.001.09');
    assertValidXML(xml, 'pain.001.001.09');
    assert.ok(xml.includes('<CstmrCdtTrfInitn>'), 'Fehlendes Root-Element');
    assert.ok(xml.includes('<PmtMtd>TRF</PmtMtd>'), 'Falsche Zahlungsmethode');
    assert.ok(xml.includes('<NbOfTxs>2</NbOfTxs>'), 'Falsche Transaktionsanzahl');
    assert.ok(xml.includes('<CtrlSum>3500.00</CtrlSum>'), 'Falsche Kontrollsumme (1500+2000)');
    assert.ok(xml.includes('Max Mustermann'), 'Fehlender Empfänger');
    assert.ok(xml.includes('Erika Musterfrau'), 'Fehlender Empfänger');
  });

  it('5+ Transaktionen mit korrekter Summe', () => {
    const rows = [];
    for (let i = 0; i < 5; i++) {
      rows.push({
        Name: `Person ${i + 1}`,
        IBAN: TEST_DATA.accounts[i % 3].iban,
        BIC: TEST_DATA.accounts[i % 3].bic,
        Betrag: (i + 1) * 100,
        Verwendungszweck: `Zahlung ${i + 1}`,
        Referenz: `REF-${i + 1}`,
      });
    }
    const xml = excelToXML(rows, 'transfer', 'pain.001.001.09');
    assertValidXML(xml, 'pain.001.001.09');
    assert.ok(xml.includes('<NbOfTxs>5</NbOfTxs>'), 'Falsche Transaktionsanzahl');
    // Summe: 100+200+300+400+500 = 1500
    assert.ok(xml.includes('<CtrlSum>1500.00</CtrlSum>'), 'Falsche Kontrollsumme');
  });

  it('Referenz wird als EndToEndId im XML gesetzt', () => {
    const rows = [{
      Name: 'Test Empfänger', IBAN: 'DE89370400440532013000', BIC: 'COBADEFFXXX',
      Betrag: 500, Verwendungszweck: 'Rechnung', Referenz: 'RE-2026-0042',
    }];
    const xml = excelToXML(rows, 'transfer', 'pain.001.001.09');
    assert.ok(xml.includes('<EndToEndId>RE-2026-0042</EndToEndId>'), 'Fehlende End-to-End-ID');
  });

  it('fehlende Referenz wird als NOTPROVIDED gesetzt', () => {
    const rows = [{
      Name: 'Test Empfänger', IBAN: 'DE89370400440532013000', BIC: 'COBADEFFXXX',
      Betrag: 500, Verwendungszweck: 'Ohne Referenz',
    }];
    const xml = excelToXML(rows, 'transfer', 'pain.001.001.09');
    assert.ok(xml.includes('<EndToEndId>NOTPROVIDED</EndToEndId>'), 'Fehlende NOTPROVIDED End-to-End-ID');
  });

  it('Mandatsdatum als String wird korrekt geparsed', () => {
    const rows = [{
      Name: 'Anna Schmidt', IBAN: 'DE75512108001245126199', BIC: 'SOLADEST600',
      Betrag: 25, Verwendungszweck: 'Beitrag', Mandatsreferenz: 'M-001', Mandatsdatum: '2025-03-20',
    }];
    const xml = excelToXML(rows, 'directDebit', 'pain.008.001.08');
    assert.ok(xml.includes('<DtOfSgntr>2025-03-20</DtOfSgntr>'), 'Falsches Mandatsdatum');
  });

  it('ungültiges Mandatsdatum nutzt Fallback (heute)', () => {
    const rows = [{
      Name: 'Anna Schmidt', IBAN: 'DE75512108001245126199', BIC: 'SOLADEST600',
      Betrag: 25, Verwendungszweck: 'Beitrag', Mandatsreferenz: 'M-001', Mandatsdatum: 'UNGUELTIG',
    }];
    // Sollte nicht werfen – ungültiges Datum führt zum Fallback auf new Date()
    assert.doesNotThrow(() => {
      const xml = excelToXML(rows, 'directDebit', 'pain.008.001.08');
      assert.ok(xml.includes('<DtOfSgntr>'), 'Mandatsdatum-Element muss vorhanden sein');
    });
  });

  it('Lastschrift-Vorlage funktioniert mit pain.008.001.02 (Legacy)', () => {
    const xml = excelToXML(TEMPLATE_ROWS_DD, 'directDebit', 'pain.008.001.02');
    assertValidXML(xml, 'pain.008.001.02');
    assert.ok(xml.includes('<CstmrDrctDbtInitn>'));
    assert.ok(xml.includes('<CtrlSum>75.00</CtrlSum>'));
  });

  it('Überweisungs-Vorlage funktioniert mit pain.001.001.03', () => {
    const xml = excelToXML(TEMPLATE_ROWS_CT, 'transfer', 'pain.001.001.03');
    assertValidXML(xml, 'pain.001.001.03');
    assert.ok(xml.includes('<CstmrCdtTrfInitn>'));
    assert.ok(xml.includes('<CtrlSum>3500.00</CtrlSum>'));
  });

  it('Überweisungs-Vorlage funktioniert mit pain.001.001.08', () => {
    const xml = excelToXML(TEMPLATE_ROWS_CT, 'transfer', 'pain.001.001.08');
    assertValidXML(xml, 'pain.001.001.08');
    assert.ok(xml.includes('<CstmrCdtTrfInitn>'));
  });
});

// -------------------------------------------------------------------------
// 13. Excel-Import: Fehlerfälle
// -------------------------------------------------------------------------

describe('Excel-Import: Fehlerfälle', () => {

  it('leere Datei (0 Zeilen) ergibt leere Transaktionsliste', () => {
    const result = processExcelRows([], 'transfer');
    assert.strictEqual(result.length, 0);
    // Hinweis: Die SEPA-Library wirft keinen Fehler bei 0 Transaktionen
    // (A() prueft t && t.length, wobei t=0 falsy ist).
    // Die Validierung "keine Daten" muss im Generator selbst erfolgen.
  });

  it('ungültige IBAN in Excel-Daten wird von SEPA-Library abgefangen', () => {
    const rows = [{
      Name: 'Test Person', IBAN: 'DE00000000000000000000', BIC: '',
      Betrag: 100, Verwendungszweck: 'Test', Referenz: 'REF',
    }];
    assert.throws(() => {
      excelToXML(rows, 'transfer', 'pain.001.001.09');
    }, /IBAN/, 'Ungültige IBAN muss Fehler werfen');
  });

  it('Betrag = 0 in Excel wird von SEPA-Library abgefangen', () => {
    const rows = [{
      Name: 'Test Person', IBAN: 'DE89370400440532013000', BIC: 'COBADEFFXXX',
      Betrag: 0, Verwendungszweck: 'Test', Referenz: 'REF',
    }];
    assert.throws(() => {
      excelToXML(rows, 'transfer', 'pain.001.001.09');
    }, /amount/, 'Betrag 0 muss Fehler werfen');
  });

  it('negativer Betrag in Excel wird von SEPA-Library abgefangen', () => {
    const rows = [{
      Name: 'Test Person', IBAN: 'DE89370400440532013000', BIC: 'COBADEFFXXX',
      Betrag: -50, Verwendungszweck: 'Test', Referenz: 'REF',
    }];
    assert.throws(() => {
      excelToXML(rows, 'transfer', 'pain.001.001.09');
    }, /amount/, 'Negativer Betrag muss Fehler werfen');
  });

  it('ungültige BIC-Länge in Excel wird von SEPA-Library abgefangen', () => {
    const rows = [{
      Name: 'Test Person', IBAN: 'DE89370400440532013000', BIC: 'ABC',
      Betrag: 100, Verwendungszweck: 'Test', Referenz: 'REF',
    }];
    assert.throws(() => {
      excelToXML(rows, 'transfer', 'pain.001.001.09');
    }, /BIC/, 'Ungültige BIC-Länge muss Fehler werfen');
  });

  it('Verwendungszweck über 140 Zeichen wird abgefangen', () => {
    const rows = [{
      Name: 'Test Person', IBAN: 'DE89370400440532013000', BIC: 'COBADEFFXXX',
      Betrag: 100, Verwendungszweck: 'A'.repeat(141), Referenz: 'REF',
    }];
    assert.throws(() => {
      excelToXML(rows, 'transfer', 'pain.001.001.09');
    }, /remittanceInfo/, 'Zu langer Verwendungszweck muss Fehler werfen');
  });

  it('fehlende Mandatsreferenz bei Lastschrift wird akzeptiert (leerer String)', () => {
    // Hinweis: Die SEPA-Library erlaubt leere mandateId, weil F() mit
    // "t && !t.match(...)" prueft — leerer String ist falsy und wird uebersprungen.
    // Die Validierung muss im Generator vor dem Library-Aufruf erfolgen.
    const rows = [{
      Name: 'Test Person', IBAN: 'DE89370400440532013000', BIC: 'COBADEFFXXX',
      Betrag: 100, Verwendungszweck: 'Test', Mandatsdatum: '2025-01-01',
    }];
    assert.doesNotThrow(() => {
      excelToXML(rows, 'directDebit', 'pain.008.001.08');
    }, 'Leere Mandatsreferenz wirft keinen Library-Fehler');
  });
});
