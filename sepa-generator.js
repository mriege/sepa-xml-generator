// SEPA-XML Generator - Komplett im Browser
// Maximal benutzerfreundlich mit Excel-Upload UND manueller Eingabe

document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const fileInput = document.getElementById('excelFile');
    const fileName = document.getElementById('fileName');
    const previewSection = document.getElementById('previewSection');
    const previewBody = document.getElementById('previewBody');
    const summary = document.getElementById('summary');
    const generateBtn = document.getElementById('generateBtn');
    const resetBtn = document.getElementById('resetBtn');
    const errorSection = document.getElementById('errorSection');
    const errorMessage = document.getElementById('errorMessage');
    
    // Payment type elements
    const directDebitBtn = document.getElementById('directDebitBtn');
    const transferBtn = document.getElementById('transferBtn');
    const directDebitSettings = document.getElementById('directDebitSettings');
    const transferSettings = document.getElementById('transferSettings');
    const directDebitInfo = document.getElementById('directDebitInfo');
    const transferInfo = document.getElementById('transferInfo');
    
    // Input method tabs
    const excelTab = document.getElementById('excelTab');
    const manualTab = document.getElementById('manualTab');
    const excelInputMethod = document.getElementById('excelInputMethod');
    const manualInputMethod = document.getElementById('manualInputMethod');
    
    // Manual input elements
    const manualName = document.getElementById('manualName');
    const manualIBAN = document.getElementById('manualIBAN');
    const manualBIC = document.getElementById('manualBIC');
    const manualAmount = document.getElementById('manualAmount');
    const manualRemittance = document.getElementById('manualRemittance');
    const manualReference = document.getElementById('manualReference');
    const manualReferenceLabel = document.getElementById('manualReferenceLabel');
    const addManualEntry = document.getElementById('addManualEntry');
    
    // Config elements
    const painFormatSelect = document.getElementById('painFormat');
    const initiatorNameInput = document.getElementById('initiatorName');
    const executionDateInput = document.getElementById('executionDate');
    const creditorNameInput = document.getElementById('creditorName');
    const creditorIBANInput = document.getElementById('creditorIBAN');
    const creditorBICInput = document.getElementById('creditorBIC');
    const creditorIdInput = document.getElementById('creditorId');
    const sequenceTypeSelect = document.getElementById('sequenceType');
    const localInstrumentationSelect = document.getElementById('localInstrumentation');
    const debtorNameInput = document.getElementById('debtorName');
    const debtorIBANInput = document.getElementById('debtorIBAN');
    const debtorBICInput = document.getElementById('debtorBIC');
    const downloadTemplateBtn = document.getElementById('downloadTemplate');

    let currentTransactions = [];
    let currentPaymentType = 'directDebit'; // or 'transfer'
    
    // Load config from localStorage
    loadConfigFromStorage();
    
    // Validate all pre-filled fields after loading
    setTimeout(() => {
        validateAllFields();
    }, 100);
    
    // Event Listeners - Payment Type
    directDebitBtn.addEventListener('click', () => switchPaymentType('directDebit'));
    transferBtn.addEventListener('click', () => switchPaymentType('transfer'));
    
    // Event Listeners - Input Method
    excelTab.addEventListener('click', () => switchInputMethod('excel'));
    manualTab.addEventListener('click', () => switchInputMethod('manual'));
    
    // Event Listeners - File Upload
    fileInput.addEventListener('change', handleFileSelect);
    
    // Event Listeners - Manual Entry
    addManualEntry.addEventListener('click', addManualTransaction);
    
    // Event Listeners - Buttons
    generateBtn.addEventListener('click', generateAndDownload);
    resetBtn.addEventListener('click', resetApp);
    downloadTemplateBtn.addEventListener('click', downloadExcelTemplate);
    
    // Event Listeners - Field Validation
    manualIBAN.addEventListener('input', validateIBAN);
    creditorIBANInput.addEventListener('input', validateIBAN);
    debtorIBANInput.addEventListener('input', validateIBAN);
    
    manualBIC.addEventListener('input', validateBIC);
    creditorBICInput.addEventListener('input', validateBIC);
    debtorBICInput.addEventListener('input', validateBIC);
    
    manualAmount.addEventListener('input', validateAmount);
    
    manualName.addEventListener('input', validateName);
    creditorNameInput.addEventListener('input', validateName);
    debtorNameInput.addEventListener('input', validateName);
    initiatorNameInput.addEventListener('input', validateName);
    
    manualRemittance.addEventListener('input', validateRemittance);
    manualReference.addEventListener('input', validateReference);
    creditorIdInput.addEventListener('input', validateCreditorId);
    
    executionDateInput.addEventListener('input', validateDate);
    
    painFormatSelect.addEventListener('change', validateSelect);
    sequenceTypeSelect.addEventListener('change', validateSelect);
    localInstrumentationSelect.addEventListener('change', validateSelect);
    
    // Event Listeners - FAQ
    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', function() {
            const item = this.closest('.faq-item');
            const wasActive = item.classList.contains('active');
            
            // Optional: Close all other FAQ items
            document.querySelectorAll('.faq-item').forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Toggle current item
            item.classList.toggle('active', !wasActive);
        });
    });
    
    // Event Listeners - Auto-save config
    [painFormatSelect, initiatorNameInput, executionDateInput, creditorNameInput, 
     creditorIBANInput, creditorBICInput, creditorIdInput, sequenceTypeSelect, 
     localInstrumentationSelect, debtorNameInput, debtorIBANInput, debtorBICInput].forEach(el => {
        if (el) el.addEventListener('change', saveConfigToStorage);
    });
    
    // Event Listeners - Config File Management
    const configFileInput = document.getElementById('configFileInput');
    const loadConfigBtn = document.getElementById('loadConfig');
    const saveConfigBtn = document.getElementById('saveConfig');
    
    // Save config to file
    if (saveConfigBtn) {
        saveConfigBtn.addEventListener('click', saveConfigToFile);
    }
    
    // Load config from file
    if (loadConfigBtn && configFileInput) {
        loadConfigBtn.addEventListener('click', () => {
            configFileInput.click();
        });
        
        configFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const config = JSON.parse(event.target.result);
                    
                    // Load config into form fields
                    if (config.initiatorName) initiatorNameInput.value = config.initiatorName;
                    if (config.executionDate) executionDateInput.value = config.executionDate;
                    if (config.creditorName) creditorNameInput.value = config.creditorName;
                    if (config.creditorIBAN) creditorIBANInput.value = config.creditorIBAN;
                    if (config.creditorBIC) creditorBICInput.value = config.creditorBIC;
                    if (config.creditorId) creditorIdInput.value = config.creditorId;
                    if (config.sequenceType) sequenceTypeSelect.value = config.sequenceType;
                    if (config.localInstrumentation) localInstrumentationSelect.value = config.localInstrumentation;
                    if (config.debtorName) debtorNameInput.value = config.debtorName;
                    if (config.debtorIBAN) debtorIBANInput.value = config.debtorIBAN;
                    if (config.debtorBIC) debtorBICInput.value = config.debtorBIC;
                    if (config.painFormat) painFormatSelect.value = config.painFormat;
                    
                    // Save to localStorage
                    saveConfigToStorage();
                    
                    // Show success message
                    showSuccess('Konfiguration erfolgreich geladen!');
                    
                    // Clear file input
                    configFileInput.value = '';
                } catch (error) {
                    showError('Fehler beim Laden der Konfigurationsdatei: ' + error.message);
                }
            };
            reader.readAsText(file);
        });
    }
    
    /**
     * Switch between Direct Debit and Transfer
     */
    function switchPaymentType(type) {
        currentPaymentType = type;
        
        // Update buttons
        directDebitBtn.classList.toggle('active', type === 'directDebit');
        transferBtn.classList.toggle('active', type === 'transfer');
        
        // Update settings visibility
        directDebitSettings.style.display = type === 'directDebit' ? 'block' : 'none';
        transferSettings.style.display = type === 'transfer' ? 'block' : 'none';
        
        // Update info visibility
        if (directDebitInfo) directDebitInfo.style.display = type === 'directDebit' ? 'block' : 'none';
        if (transferInfo) transferInfo.style.display = type === 'transfer' ? 'block' : 'none';
        
        // Update manual input label
        if (type === 'directDebit') {
            manualReferenceLabel.textContent = 'Mandatsreferenz *';
            manualReference.placeholder = 'MAND-001-2025';
        } else {
            manualReferenceLabel.textContent = 'Referenz';
            manualReference.placeholder = 'Optional';
            manualReference.removeAttribute('required');
        }
        
        // Update pain format options
        updatePainFormatOptions(type);
        
        // Reset transactions
        currentTransactions = [];
        updatePreview();
    }
    
    /**
     * Switch between Excel and Manual input
     */
    function switchInputMethod(method) {
        excelTab.classList.toggle('active', method === 'excel');
        manualTab.classList.toggle('active', method === 'manual');
        excelInputMethod.classList.toggle('active', method === 'excel');
        manualInputMethod.classList.toggle('active', method === 'manual');
    }
    
    /**
     * Update pain format options based on payment type
     */
    function updatePainFormatOptions(type) {
        const options = type === 'directDebit' ? [
            { value: 'pain.008.001.02', text: 'pain.008.001.02 (Ältere Version - hohe Kompatibilität)' },
            { value: 'pain.008.001.08', text: 'pain.008.001.08 (Aktuelle Version - EMPFOHLEN) ⭐', selected: true }
        ] : [
            { value: 'pain.001.001.03', text: 'pain.001.001.03 (Ältere Version - hohe Kompatibilität)' },
            { value: 'pain.001.001.08', text: 'pain.001.001.08 (Neuere Version)' },
            { value: 'pain.001.001.09', text: 'pain.001.001.09 (Neueste Version - EMPFOHLEN) ⭐', selected: true }
        ];
        
        painFormatSelect.innerHTML = '';
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            if (opt.selected) option.selected = true;
            painFormatSelect.appendChild(option);
        });
    }
    
    /**
     * Validate IBAN and show feedback
     */
    function validateIBAN(e) {
        const input = e.target;
        const iban = input.value.replace(/\s/g, '').toUpperCase();
        
        if (iban.length === 0) {
            input.classList.remove('valid', 'invalid');
            removeValidationMessage(input);
            return;
        }
        
        // Basic IBAN validation
        const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/;
        const isValid = ibanRegex.test(iban) && iban.length >= 15 && iban.length <= 34;
        
        if (isValid) {
            input.classList.remove('invalid');
            input.classList.add('valid');
            showValidationMessage(input, '✓ Gültige IBAN', 'success');
        } else {
            input.classList.remove('valid');
            input.classList.add('invalid');
            showValidationMessage(input, '✗ Ungültige IBAN (Format: DE89370400440532013000)', 'error');
        }
    }
    
    /**
     * Validate BIC and show feedback
     */
    function validateBIC(e) {
        const input = e.target;
        const bic = input.value.trim().toUpperCase();
        
        if (bic.length === 0) {
            input.classList.remove('valid', 'invalid');
            removeValidationMessage(input);
            return;
        }
        
        // BIC validation (8 or 11 characters)
        const bicRegex = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
        const isValid = bicRegex.test(bic);
        
        if (isValid) {
            input.classList.remove('invalid');
            input.classList.add('valid');
            showValidationMessage(input, '✓ Gültiger BIC', 'success');
        } else {
            input.classList.remove('valid');
            input.classList.add('invalid');
            showValidationMessage(input, '✗ Ungültiger BIC (8 oder 11 Zeichen)', 'error');
        }
    }
    
    /**
     * Validate Amount
     */
    function validateAmount(e) {
        const input = e.target;
        const amount = parseFloat(input.value);
        
        if (input.value.length === 0) {
            input.classList.remove('valid', 'invalid');
            removeValidationMessage(input);
            return;
        }
        
        if (!isNaN(amount) && amount >= 0.01 && amount <= 999999999.99) {
            input.classList.remove('invalid');
            input.classList.add('valid');
            showValidationMessage(input, `✓ ${amount.toFixed(2)} EUR`, 'success');
        } else {
            input.classList.remove('valid');
            input.classList.add('invalid');
            showValidationMessage(input, '✗ Betrag muss zwischen 0.01 und 999,999,999.99 EUR liegen', 'error');
        }
    }
    
    /**
     * Validate Name fields
     */
    function validateName(e) {
        const input = e.target;
        const name = input.value.trim();
        
        if (name.length === 0) {
            input.classList.remove('valid', 'invalid');
            removeValidationMessage(input);
            return;
        }
        
        if (name.length >= 2 && name.length <= 70) {
            input.classList.remove('invalid');
            input.classList.add('valid');
            showValidationMessage(input, '✓ Gültig', 'success');
        } else {
            input.classList.remove('valid');
            input.classList.add('invalid');
            showValidationMessage(input, '✗ Name muss 2-70 Zeichen lang sein', 'error');
        }
    }
    
    /**
     * Validate Remittance Info
     */
    function validateRemittance(e) {
        const input = e.target;
        const text = input.value.trim();
        
        if (text.length === 0) {
            input.classList.remove('valid', 'invalid');
            removeValidationMessage(input);
            return;
        }
        
        if (text.length >= 1 && text.length <= 140) {
            input.classList.remove('invalid');
            input.classList.add('valid');
            showValidationMessage(input, `✓ ${text.length}/140 Zeichen`, 'success');
        } else {
            input.classList.remove('valid');
            input.classList.add('invalid');
            showValidationMessage(input, '✗ Verwendungszweck darf maximal 140 Zeichen haben', 'error');
        }
    }
    
    /**
     * Validate Reference/Mandate
     */
    function validateReference(e) {
        const input = e.target;
        const ref = input.value.trim();
        
        if (ref.length === 0 && currentPaymentType !== 'directDebit') {
            input.classList.remove('valid', 'invalid');
            removeValidationMessage(input);
            return;
        }
        
        if (ref.length >= 1 && ref.length <= 35) {
            input.classList.remove('invalid');
            input.classList.add('valid');
            showValidationMessage(input, '✓ Gültig', 'success');
        } else if (ref.length > 35) {
            input.classList.remove('valid');
            input.classList.add('invalid');
            showValidationMessage(input, '✗ Maximal 35 Zeichen', 'error');
        } else if (currentPaymentType === 'directDebit') {
            input.classList.remove('valid');
            input.classList.add('invalid');
            showValidationMessage(input, '✗ Pflichtfeld für Lastschriften', 'error');
        }
    }
    
    /**
     * Validate Creditor ID
     */
    function validateCreditorId(e) {
        const input = e.target;
        const id = input.value.trim().toUpperCase();
        
        if (id.length === 0) {
            input.classList.remove('valid', 'invalid');
            removeValidationMessage(input);
            return;
        }
        
        // German Creditor ID format: DE98ZZZ09999999999
        const creditorIdRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{3}[0-9]{11}$/;
        const isValid = creditorIdRegex.test(id);
        
        if (isValid) {
            input.classList.remove('invalid');
            input.classList.add('valid');
            showValidationMessage(input, '✓ Gültige Gläubiger-ID', 'success');
        } else {
            input.classList.remove('valid');
            input.classList.add('invalid');
            showValidationMessage(input, '✗ Format: DE98ZZZ09999999999', 'error');
        }
    }
    
    /**
     * Validate Date
     */
    function validateDate(e) {
        const input = e.target;
        const dateValue = input.value;
        
        if (dateValue.length === 0) {
            input.classList.remove('valid', 'invalid');
            removeValidationMessage(input);
            return;
        }
        
        const selectedDate = new Date(dateValue);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate >= today) {
            input.classList.remove('invalid');
            input.classList.add('valid');
            const daysDiff = Math.ceil((selectedDate - today) / (1000 * 60 * 60 * 24));
            showValidationMessage(input, `✓ In ${daysDiff} Tag${daysDiff !== 1 ? 'en' : ''}`, 'success');
        } else {
            input.classList.remove('valid');
            input.classList.add('invalid');
            showValidationMessage(input, '✗ Datum muss in der Zukunft liegen', 'error');
        }
    }
    
    /**
     * Validate Select fields
     */
    function validateSelect(e) {
        const select = e.target;
        
        if (select.value && select.value !== '') {
            select.classList.remove('invalid');
            select.classList.add('valid');
        } else {
            select.classList.remove('valid');
            select.classList.add('invalid');
        }
    }
    
    /**
     * Show validation message
     */
    function showValidationMessage(input, message, type) {
        removeValidationMessage(input);
        
        const msgDiv = document.createElement('div');
        msgDiv.className = `validation-message ${type}`;
        msgDiv.textContent = message;
        msgDiv.dataset.validationFor = input.id || input.name;
        
        input.parentElement.appendChild(msgDiv);
    }
    
    /**
     * Remove validation message
     */
    function removeValidationMessage(input) {
        const existingMsg = input.parentElement.querySelector('.validation-message');
        if (existingMsg) {
            existingMsg.remove();
        }
    }
    
    /**
     * Validate all fields (called after loading config)
     */
    function validateAllFields() {
        // IBAN fields
        if (manualIBAN.value) validateIBAN({ target: manualIBAN });
        if (creditorIBANInput.value) validateIBAN({ target: creditorIBANInput });
        if (debtorIBANInput.value) validateIBAN({ target: debtorIBANInput });
        
        // BIC fields
        if (manualBIC.value) validateBIC({ target: manualBIC });
        if (creditorBICInput.value) validateBIC({ target: creditorBICInput });
        if (debtorBICInput.value) validateBIC({ target: debtorBICInput });
        
        // Name fields
        if (manualName.value) validateName({ target: manualName });
        if (creditorNameInput.value) validateName({ target: creditorNameInput });
        if (debtorNameInput.value) validateName({ target: debtorNameInput });
        if (initiatorNameInput.value) validateName({ target: initiatorNameInput });
        
        // Amount
        if (manualAmount.value) validateAmount({ target: manualAmount });
        
        // Text fields
        if (manualRemittance.value) validateRemittance({ target: manualRemittance });
        if (manualReference.value) validateReference({ target: manualReference });
        if (creditorIdInput.value) validateCreditorId({ target: creditorIdInput });
        
        // Date
        if (executionDateInput.value) validateDate({ target: executionDateInput });
        
        // Selects
        if (painFormatSelect.value) validateSelect({ target: painFormatSelect });
        if (sequenceTypeSelect.value) validateSelect({ target: sequenceTypeSelect });
        if (localInstrumentationSelect.value) validateSelect({ target: localInstrumentationSelect });
    }
    
    /**
     * Add manual transaction
     */
    function addManualTransaction() {
        // Validate inputs
        if (!manualName.value || !manualIBAN.value || !manualAmount.value || !manualRemittance.value) {
            showError('Bitte füllen Sie alle Pflichtfelder aus!');
            return;
        }
        
        if (currentPaymentType === 'directDebit' && !manualReference.value) {
            showError('Mandatsreferenz ist erforderlich für Lastschriften!');
            return;
        }
        
        // Create transaction object
        const transaction = {
            name: manualName.value.trim(),
            iban: manualIBAN.value.replace(/\s/g, '').toUpperCase(),
            bic: manualBIC.value.trim().toUpperCase() || '',
            amount: parseFloat(manualAmount.value),
            remittanceInfo: manualRemittance.value.trim(),
            mandateId: manualReference.value.trim() || '',
            mandateSignatureDate: new Date().toISOString().split('T')[0]
        };
        
        // Add to transactions
        currentTransactions.push(transaction);
        
        // Clear form and validation
        manualName.value = '';
        manualIBAN.value = '';
        manualBIC.value = '';
        manualAmount.value = '';
        manualRemittance.value = '';
        manualReference.value = '';
        
        // Remove validation classes and messages
        [manualName, manualIBAN, manualBIC, manualAmount, manualRemittance, manualReference].forEach(field => {
            field.classList.remove('valid', 'invalid');
            removeValidationMessage(field);
        });
        
        // Update preview
        updatePreview();
        
        // Show success feedback
        showSuccess(`✓ Zahlung hinzugefügt! Insgesamt: ${currentTransactions.length}`);
    }
    
    /**
     * Handle Excel file selection
     */
    async function handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        fileName.textContent = `📄 ${file.name}`;
        hideError();
        
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet);
            
            if (rows.length === 0) {
                throw new Error('Die Excel-Datei enthält keine Daten.');
            }
            
            // Parse transactions
            currentTransactions = rows.map(row => {
                const transaction = {
                    name: row.Name || row.name || '',
                    iban: (row.IBAN || row.iban || '').toString().replace(/\s/g, ''),
                    bic: (row.BIC || row.bic || '').toString(),
                    amount: parseFloat(row.Betrag || row.betrag || row.Amount || row.amount || 0),
                    remittanceInfo: row.Verwendungszweck || row.verwendungszweck || row.Purpose || row.purpose || ''
                };
                
                // Add mandate info for direct debits
                if (currentPaymentType === 'directDebit') {
                    transaction.mandateId = row.Mandatsreferenz || row.mandatsreferenz || row.MandateId || row.mandateId || '';
                    transaction.mandateSignatureDate = row.Mandatsdatum || row.mandatsdatum || row.MandateDate || row.mandateDate || '';
                } else {
                    // For transfers, read Reference
                    transaction.mandateId = row.Referenz || row.referenz || row.Reference || row.reference || '';
                }
                
                return transaction;
            });
            
            updatePreview();
            
        } catch (error) {
            showError(`Fehler beim Lesen der Datei: ${error.message}`);
            console.error(error);
        }
    }
    
    /**
     * Update preview table
     */
    function updatePreview() {
        if (currentTransactions.length === 0) {
            previewSection.style.display = 'none';
            return;
        }
        
        previewSection.style.display = 'block';
        
        // Calculate totals
        const totalAmount = currentTransactions.reduce((sum, t) => sum + t.amount, 0);
        const count = currentTransactions.length;
        
        summary.textContent = `📊 Gefunden: ${count} Transaktionen | Gesamtbetrag: ${formatCurrency(totalAmount)}`;
        
        // Build table
        previewBody.innerHTML = '';
        currentTransactions.forEach((t, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td><strong>${escapeHtml(t.name)}</strong></td>
                <td><code>${escapeHtml(t.iban)}</code></td>
                <td class="amount">${formatCurrency(t.amount)}</td>
                <td>${escapeHtml(t.remittanceInfo)}</td>
                ${currentPaymentType === 'directDebit' ? `<td>${escapeHtml(t.mandateId)}</td>` : ''}
                <td>
                    <button class="btn-remove" onclick="removeTransaction(${index})" title="Entfernen">
                        🗑️
                    </button>
                </td>
            `;
            previewBody.appendChild(row);
        });
    }
    
    // Make removeTransaction available globally
    window.removeTransaction = function(index) {
        currentTransactions.splice(index, 1);
        updatePreview();
    };
    
    /**
     * Generate and download SEPA XML
     */
    function generateAndDownload() {
        if (currentTransactions.length === 0) {
            showError('Bitte fügen Sie zuerst Transaktionen hinzu!');
            return;
        }
        
        // Validate configuration
        if (!initiatorNameInput.value) {
            showError('Bitte geben Sie den Initiator-Namen ein!');
            return;
        }
        
        if (currentPaymentType === 'directDebit') {
            if (!creditorNameInput.value || !creditorIBANInput.value || !creditorIdInput.value) {
                showError('Bitte füllen Sie alle Gläubiger-Felder aus!');
                return;
            }
        } else {
            if (!debtorNameInput.value || !debtorIBANInput.value) {
                showError('Bitte füllen Sie alle Zahler-Felder aus!');
                return;
            }
        }
        
        try {
            // Create SEPA document
            const painFormat = painFormatSelect.value;
            const doc = new SEPA.Document(painFormat);
            doc.grpHdr.id = generateMessageId();
            doc.grpHdr.created = new Date().toISOString();
            doc.grpHdr.initiatorName = initiatorNameInput.value;
            
            // Create payment info
            const info = doc.createPaymentInfo();
            info.collectionDate = executionDateInput.value || new Date().toISOString().split('T')[0];
            
            if (currentPaymentType === 'directDebit') {
                // Direct Debit settings
                info.creditorName = creditorNameInput.value;
                info.creditorIBAN = creditorIBANInput.value.replace(/\s/g, '');
                if (creditorBICInput.value) info.creditorBIC = creditorBICInput.value;
                info.creditorId = creditorIdInput.value;
                info.sequenceType = sequenceTypeSelect.value;
                info.localInstrument = localInstrumentationSelect.value;
                
                // Add transactions
                currentTransactions.forEach(t => {
                    const transaction = info.createTransaction();
                    transaction.debtorName = t.name;
                    transaction.debtorIBAN = t.iban;
                    transaction.debtorBIC = t.bic || '';
                    transaction.amount = parseFloat(t.amount);
                    transaction.mandateId = t.mandateId;
                    const d = t.mandateSignatureDate ? new Date(t.mandateSignatureDate) : new Date();
                    transaction.mandateSignatureDate = isNaN(d.getTime()) ? new Date() : d;
                    transaction.remittanceInfo = t.remittanceInfo;
                    
                    info.addTransaction(transaction);
                });
            } else {
                // Credit Transfer settings
                info.debtorName = debtorNameInput.value;
                info.debtorIBAN = debtorIBANInput.value.replace(/\s/g, '');
                if (debtorBICInput.value) info.debtorBIC = debtorBICInput.value;
                
                // Add transactions
                currentTransactions.forEach(t => {
                    const transaction = info.createTransaction();
                    transaction.creditorName = t.name;
                    transaction.creditorIBAN = t.iban;
                    transaction.creditorBIC = t.bic || '';
                    transaction.amount = parseFloat(t.amount);
                    transaction.remittanceInfo = t.remittanceInfo;
                    transaction.end2endId = t.mandateId || 'NOTPROVIDED';
                    
                    info.addTransaction(transaction);
                });
            }
            
            // Generate XML
            const xml = doc.toString();
            
            // Download file
            const blob = new Blob([xml], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            const date = new Date().toISOString().split('T')[0];
            const type = currentPaymentType === 'directDebit' ? 'Lastschrift' : 'Überweisung';
            a.download = `${date}_SEPA_${type}.xml`;
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showSuccess('✓ SEPA-XML-Datei erfolgreich erstellt und heruntergeladen!');
            
        } catch (error) {
            showError(`Fehler beim Generieren der XML: ${error.message}`);
            console.error(error);
        }
    }
    
    /**
     * Download Excel template
     */
    function downloadExcelTemplate() {
        const wb = XLSX.utils.book_new();
        
        let data;
        if (currentPaymentType === 'directDebit') {
            data = [
                ['Name', 'IBAN', 'BIC', 'Betrag', 'Verwendungszweck', 'Mandatsreferenz', 'Mandatsdatum'],
                ['Max Mustermann', 'DE89370400440532013000', 'COBADEFFXXX', 45.00, 'Mitgliedsbeitrag Januar 2025', 'MAND-001-2025', '2025-01-01'],
                ['Erika Musterfrau', 'DE89370400440532013001', '', 30.00, 'Mitgliedsbeitrag Januar 2025', 'MAND-002-2025', '2025-01-01']
            ];
        } else {
            data = [
                ['Name', 'IBAN', 'BIC', 'Betrag', 'Verwendungszweck', 'Referenz'],
                ['Max Mustermann', 'DE89370400440532013000', 'COBADEFFXXX', 1500.00, 'Gehalt Januar 2025', 'REF-001'],
                ['Erika Musterfrau', 'DE89370400440532013001', '', 2000.00, 'Gehalt Januar 2025', 'REF-002']
            ];
        }
        
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Set column widths
        ws['!cols'] = [
            { wch: 25 }, // Name
            { wch: 30 }, // IBAN
            { wch: 15 }, // BIC
            { wch: 10 }, // Betrag
            { wch: 35 }, // Verwendungszweck
            { wch: 20 }, // Mandatsreferenz
            { wch: 15 }  // Mandatsdatum
        ];
        
        XLSX.utils.book_append_sheet(wb, ws, 'Transaktionen');
        
        const type = currentPaymentType === 'directDebit' ? 'Lastschrift' : 'Überweisung';
        XLSX.writeFile(wb, `SEPA_${type}_Vorlage.xlsx`);
        
        showSuccess('✓ Excel-Vorlage heruntergeladen! Füllen Sie diese aus und laden Sie sie wieder hoch.');
    }
    
    /**
     * Reset application
     */
    function resetApp() {
        if (!confirm('Möchten Sie wirklich alle Transaktionen löschen und von vorne beginnen?')) {
            return;
        }
        
        currentTransactions = [];
        fileInput.value = '';
        fileName.textContent = '';
        updatePreview();
        hideError();
    }
    
    /**
     * Save configuration to localStorage
     */
    function saveConfigToStorage() {
        const config = {
            paymentType: currentPaymentType,
            painFormat: painFormatSelect.value,
            initiatorName: initiatorNameInput.value,
            executionDate: executionDateInput.value,
            creditorName: creditorNameInput.value,
            creditorIBAN: creditorIBANInput.value,
            creditorBIC: creditorBICInput.value,
            creditorId: creditorIdInput.value,
            sequenceType: sequenceTypeSelect.value,
            localInstrumentation: localInstrumentationSelect.value,
            debtorName: debtorNameInput.value,
            debtorIBAN: debtorIBANInput.value,
            debtorBIC: debtorBICInput.value
        };
        
        try {
            localStorage.setItem('sepaConfig', JSON.stringify(config));
        } catch (e) {
            console.warn('Could not save config to localStorage:', e);
        }
    }
    
    /**
     * Save configuration to file
     */
    function saveConfigToFile() {
        const config = {
            paymentType: currentPaymentType,
            painFormat: painFormatSelect.value,
            initiatorName: initiatorNameInput.value,
            executionDate: executionDateInput.value,
            creditorName: creditorNameInput.value,
            creditorIBAN: creditorIBANInput.value,
            creditorBIC: creditorBICInput.value,
            creditorId: creditorIdInput.value,
            sequenceType: sequenceTypeSelect.value,
            localInstrumentation: localInstrumentationSelect.value,
            debtorName: debtorNameInput.value,
            debtorIBAN: debtorIBANInput.value,
            debtorBIC: debtorBICInput.value
        };
        
        // Create JSON string with nice formatting
        const jsonString = JSON.stringify(config, null, 2);
        
        // Create blob and download
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sepa-config-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Show success message
        showSuccess('Konfiguration erfolgreich als Datei gespeichert!');
    }
    
    /**
     * Load configuration from localStorage
     */
    function loadConfigFromStorage() {
        try {
            const savedConfig = localStorage.getItem('sepaConfig');
            if (!savedConfig) return;
            
            const config = JSON.parse(savedConfig);
            
            if (config.paymentType) switchPaymentType(config.paymentType);
            if (config.painFormat) painFormatSelect.value = config.painFormat;
            if (config.initiatorName) initiatorNameInput.value = config.initiatorName;
            if (config.executionDate) executionDateInput.value = config.executionDate;
            if (config.creditorName) creditorNameInput.value = config.creditorName;
            if (config.creditorIBAN) creditorIBANInput.value = config.creditorIBAN;
            if (config.creditorBIC) creditorBICInput.value = config.creditorBIC;
            if (config.creditorId) creditorIdInput.value = config.creditorId;
            if (config.sequenceType) sequenceTypeSelect.value = config.sequenceType;
            if (config.localInstrumentation) localInstrumentationSelect.value = config.localInstrumentation;
            if (config.debtorName) debtorNameInput.value = config.debtorName;
            if (config.debtorIBAN) debtorIBANInput.value = config.debtorIBAN;
            if (config.debtorBIC) debtorBICInput.value = config.debtorBIC;
            
        } catch (e) {
            console.warn('Could not load config from localStorage:', e);
        }
    }
    
    /**
     * Show error message
     */
    function showError(message) {
        errorSection.style.display = 'block';
        errorMessage.textContent = message;
        errorSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    /**
     * Hide error message
     */
    function hideError() {
        errorSection.style.display = 'none';
    }
    
    /**
     * Show success message
     */
    function showSuccess(message) {
        // Create temporary success message
        const successDiv = document.createElement('div');
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            padding: 1.5rem 2rem;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
            z-index: 10000;
            font-weight: 600;
            font-size: 1.05rem;
            animation: slideIn 0.3s ease;
        `;
        successDiv.textContent = message;
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            successDiv.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => document.body.removeChild(successDiv), 300);
        }, 3000);
    }
    
    /**
     * Helper functions
     */
    function generateMessageId() {
        return 'MSG-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    
    function formatCurrency(amount) {
        return new Intl.NumberFormat('de-DE', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});

// Add CSS animation for success message
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
    
    .btn-remove {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 1.2rem;
        padding: 0.5rem;
        transition: transform 0.2s ease;
    }
    
    .btn-remove:hover {
        transform: scale(1.2);
    }
`;
document.head.appendChild(style);
