// ═══════════════════════════════════════════════════════
//  SMATCH WAREHOUSE — EXCEL LAYOUT IMPORT
//  Downloads the official workbook template, validates an
//  uploaded workbook, and applies it after a clean dry run.
// ═══════════════════════════════════════════════════════

const ImportLayoutAPI = {
    baseUrl: (() => {
        const urlParams = new URLSearchParams(window.location.search);
        const apiBaseOverride = urlParams.get('apiBase');

        if (apiBaseOverride) {
            return apiBaseOverride.replace(/\/$/, '') + '/api/v1';
        }

        const isLocal =
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';

        if (isLocal && window.location.port === '3000') {
            return `http://${window.location.hostname}:8000/api/v1`;
        }

        return `${window.location.origin}/api/v1`;
    })(),

    token: new URLSearchParams(window.location.search).get('token') || 'demo-token',

    templateUrl() {
        return `${this.baseUrl}/import/layout-template`;
    },

    locationCodeTemplateUrl() {
        return `${this.baseUrl}/import/location-code-template`;
    },

    async uploadExcel(file, dryRun) {
        const body = new FormData();
        body.append('file', file);

        const response = await fetch(`${this.baseUrl}/import/layout-excel?dry_run=${dryRun ? 'true' : 'false'}`, {
            method: 'POST',
            headers: { 'X-Demo-Token': this.token },
            body,
        });

        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.detail || `Import failed with status ${response.status}`);
        }
        return payload;
    },

    async uploadLocationCodes(file, dryRun, options) {
        const body = new FormData();
        body.append('file', file);

        const params = new URLSearchParams({
            dry_run: dryRun ? 'true' : 'false',
            pattern: options.pattern,
            warehouse_name: options.warehouseName,
            aisle_spacing_meters: options.aisleSpacing,
            bay_width_meters: options.bayWidth,
            bay_depth_meters: options.bayDepth,
            floor_level_height_meters: options.floorLevelHeight,
            upper_level_step_meters: options.upperLevelStep,
        });

        const response = await fetch(`${this.baseUrl}/import/location-codes?${params.toString()}`, {
            method: 'POST',
            headers: { 'X-Demo-Token': this.token },
            body,
        });

        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.detail || `Import failed with status ${response.status}`);
        }
        return payload;
    },
};

function initImportPage() {
    const container = document.getElementById('import-container');
    if (!container) return;

    container.innerHTML = `
        <div style="min-height:100vh; background:#12151a; color:#fff; font-family:'Outfit', sans-serif; display:grid; grid-template-columns:360px 1fr;">
            <aside style="background:#1a1e24; border-right:1px solid #333; padding:24px; display:flex; flex-direction:column; gap:18px;">
                <div>
                    <button id="import-back-btn" class="btn" style="margin-bottom:18px;">BACK TO VIEWER</button>
                    <h1 style="font-size:1.35rem; margin:0 0 8px;">Layout Import</h1>
                    <p style="color:#9ca3af; margin:0; line-height:1.45;">Primary path: import a WMS location-code CSV. Use Excel only for exact hand-authored geometry.</p>
                </div>

                <button id="download-code-template-btn" style="padding:12px; background:#10b981; color:#fff; border:none; border-radius:4px; font-family:'JetBrains Mono', monospace; font-weight:700; cursor:pointer;">DOWNLOAD CSV TEMPLATE</button>
                <button id="download-template-btn" style="padding:12px; background:#2563eb; color:#fff; border:none; border-radius:4px; font-family:'JetBrains Mono', monospace; font-weight:700; cursor:pointer;">DOWNLOAD EXCEL TEMPLATE</button>

                <label style="display:flex; flex-direction:column; gap:8px; font-size:0.9rem;">
                    Import mode
                    <select id="import-mode-select" style="padding:10px; background:#0f1217; border:1px solid #3a3f48; color:#fff; border-radius:4px;">
                        <option value="location_codes">Location-code CSV</option>
                        <option value="excel">Exact Excel workbook</option>
                    </select>
                </label>

                <label style="display:flex; flex-direction:column; gap:8px; font-size:0.9rem;">
                    File
                    <input id="layout-file-input" type="file" accept=".csv,.xlsx" style="padding:10px; background:#0f1217; border:1px solid #3a3f48; color:#fff; border-radius:4px;">
                </label>

                <div id="location-code-options" style="display:flex; flex-direction:column; gap:10px;">
                    <label style="display:flex; flex-direction:column; gap:6px; font-size:0.8rem;">
                        Parser regex
                        <input id="lc-pattern" value="^(?P<zone>[A-Z]+)-(?P<aisle>\\d+)-(?P<bay>\\d+)-(?P<level>\\d+)-(?P<slot>\\d+)$" style="padding:8px; background:#0f1217; border:1px solid #3a3f48; color:#fff; border-radius:4px; font-family:'JetBrains Mono', monospace; font-size:0.72rem;">
                    </label>
                    <label style="display:flex; flex-direction:column; gap:6px; font-size:0.8rem;">
                        Warehouse name
                        <input id="lc-warehouse-name" value="NCL Logical Warehouse" style="padding:8px; background:#0f1217; border:1px solid #3a3f48; color:#fff; border-radius:4px;">
                    </label>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                        <input id="lc-aisle-spacing" type="number" step="0.1" value="3.5" title="Aisle spacing meters" style="padding:8px; background:#0f1217; border:1px solid #3a3f48; color:#fff; border-radius:4px;">
                        <input id="lc-bay-width" type="number" step="0.1" value="2.8" title="Bay width meters" style="padding:8px; background:#0f1217; border:1px solid #3a3f48; color:#fff; border-radius:4px;">
                        <input id="lc-bay-depth" type="number" step="0.1" value="1.2" title="Bay depth meters" style="padding:8px; background:#0f1217; border:1px solid #3a3f48; color:#fff; border-radius:4px;">
                        <input id="lc-level-step" type="number" step="0.1" value="1.5" title="Upper level step meters" style="padding:8px; background:#0f1217; border:1px solid #3a3f48; color:#fff; border-radius:4px;">
                    </div>
                </div>

                <button id="validate-import-btn" style="padding:12px; background:#10b981; color:#fff; border:none; border-radius:4px; font-family:'JetBrains Mono', monospace; font-weight:700; cursor:pointer;">RUN VALIDATION</button>
                <button id="apply-import-btn" disabled style="padding:12px; background:#4b5563; color:#fff; border:none; border-radius:4px; font-family:'JetBrains Mono', monospace; font-weight:700; cursor:not-allowed;">APPLY IMPORT</button>
            </aside>

            <main style="padding:28px; overflow:auto;">
                <section style="max-width:980px;">
                    <h2 style="font-size:1.1rem; margin:0 0 14px;">Validation Result</h2>
                    <div id="import-status" style="background:#1a1e24; border:1px solid #333; border-radius:6px; padding:18px; min-height:120px; color:#cbd5e1;">
                        Select a workbook and run validation.
                    </div>
                </section>
            </main>
        </div>
    `;

    let selectedFile = null;
    let lastValidation = null;

    const fileInput = document.getElementById('layout-file-input');
    const modeSelect = document.getElementById('import-mode-select');
    const locationOptions = document.getElementById('location-code-options');
    const status = document.getElementById('import-status');
    const applyButton = document.getElementById('apply-import-btn');
    const validateButton = document.getElementById('validate-import-btn');

    document.getElementById('import-back-btn').addEventListener('click', () => {
        window.location.hash = '#/viewer';
    });

    document.getElementById('download-template-btn').addEventListener('click', () => {
        window.location.href = ImportLayoutAPI.templateUrl();
    });
    document.getElementById('download-code-template-btn').addEventListener('click', () => {
        window.location.href = ImportLayoutAPI.locationCodeTemplateUrl();
    });

    modeSelect.addEventListener('change', () => {
        const isLocationMode = modeSelect.value === 'location_codes';
        locationOptions.style.display = isLocationMode ? 'flex' : 'none';
        fileInput.accept = isLocationMode ? '.csv' : '.xlsx';
        selectedFile = null;
        fileInput.value = '';
        lastValidation = null;
        setApplyEnabled(false);
        status.textContent = isLocationMode
            ? 'Select a location-code CSV and run validation.'
            : 'Select an Excel workbook and run validation.';
    });

    fileInput.addEventListener('change', () => {
        selectedFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
        lastValidation = null;
        setApplyEnabled(false);
        status.innerHTML = selectedFile
            ? `Selected <strong>${escapeHtml(selectedFile.name)}</strong>. Run validation before applying.`
            : 'Select a workbook and run validation.';
    });

    validateButton.addEventListener('click', async () => {
        if (!selectedFile) {
            status.textContent = 'Choose a .xlsx workbook first.';
            return;
        }

        try {
            validateButton.disabled = true;
            validateButton.textContent = 'VALIDATING...';
            status.textContent = 'Parsing workbook and validating coordinates...';
            lastValidation = await uploadSelectedImport(selectedFile, true);
            renderImportResult(lastValidation, status);
            setApplyEnabled(lastValidation.errors.length === 0);
        } catch (error) {
            status.innerHTML = `<span style="color:#f87171;">${escapeHtml(error.message)}</span>`;
            setApplyEnabled(false);
        } finally {
            validateButton.disabled = false;
            validateButton.textContent = 'RUN VALIDATION';
        }
    });

    applyButton.addEventListener('click', async () => {
        if (!selectedFile || !lastValidation || lastValidation.errors.length > 0) {
            return;
        }

        try {
            setApplyEnabled(false);
            applyButton.textContent = 'IMPORTING...';
            const result = await uploadSelectedImport(selectedFile, false);
            renderImportResult(result, status);
            if (result.errors.length === 0 && result.applied) {
                applyButton.textContent = 'APPLIED';
                setTimeout(() => {
                    window.location.hash = '#/viewer';
                    window.location.reload();
                }, 900);
            }
        } catch (error) {
            status.innerHTML = `<span style="color:#f87171;">${escapeHtml(error.message)}</span>`;
            setApplyEnabled(true);
        }
    });

    function setApplyEnabled(enabled) {
        applyButton.disabled = !enabled;
        applyButton.style.background = enabled ? '#8b5cf6' : '#4b5563';
        applyButton.style.cursor = enabled ? 'pointer' : 'not-allowed';
        applyButton.textContent = 'APPLY IMPORT';
    }

    function uploadSelectedImport(file, dryRun) {
        if (modeSelect.value === 'excel') {
            return ImportLayoutAPI.uploadExcel(file, dryRun);
        }
        return ImportLayoutAPI.uploadLocationCodes(file, dryRun, {
            pattern: document.getElementById('lc-pattern').value,
            warehouseName: document.getElementById('lc-warehouse-name').value || 'NCL Logical Warehouse',
            aisleSpacing: document.getElementById('lc-aisle-spacing').value || '3.5',
            bayWidth: document.getElementById('lc-bay-width').value || '2.8',
            bayDepth: document.getElementById('lc-bay-depth').value || '1.2',
            floorLevelHeight: '0.0',
            upperLevelStep: document.getElementById('lc-level-step').value || '1.5',
        });
    }
}

function renderImportResult(result, container) {
    const hasErrors = result.errors && result.errors.length > 0;
    const counts = result.counts || {};
    const summaryColor = hasErrors ? '#f87171' : '#34d399';
    const summaryText = hasErrors ? 'Validation failed' : (result.applied ? 'Import applied' : 'Validation passed');
    const errorRows = hasErrors
        ? result.errors.map(error => `
            <tr>
                <td>${escapeHtml(error.sheet)}</td>
                <td>${escapeHtml(String(error.row))}</td>
                <td>${escapeHtml(error.column)}</td>
                <td>${escapeHtml(error.message)}</td>
            </tr>
        `).join('')
        : '';

    container.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:18px;">
            <div>
                <div style="color:${summaryColor}; font-weight:700; font-size:1.05rem;">${summaryText}</div>
                <div style="color:#9ca3af; margin-top:4px;">${escapeHtml(result.warehouse_name || 'Unnamed warehouse')}</div>
            </div>
            <div style="font-family:'JetBrains Mono', monospace; color:#9ca3af;">${result.dry_run ? 'DRY RUN' : 'APPLY'}</div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(5, minmax(120px, 1fr)); gap:10px; margin-bottom:20px;">
            ${metricCard('Zones', counts.zones)}
            ${metricCard('Aisles', counts.aisles)}
            ${metricCard('Bays', counts.bays)}
            ${metricCard('Positions', counts.storage_positions)}
            ${metricCard('Inventory', counts.inventory_rows)}
        </div>

        ${hasErrors ? `
            <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                <thead>
                    <tr style="color:#9ca3af; text-align:left;">
                        <th style="padding:8px; border-bottom:1px solid #333;">Sheet</th>
                        <th style="padding:8px; border-bottom:1px solid #333;">Row</th>
                        <th style="padding:8px; border-bottom:1px solid #333;">Column</th>
                        <th style="padding:8px; border-bottom:1px solid #333;">Message</th>
                    </tr>
                </thead>
                <tbody>${errorRows}</tbody>
            </table>
        ` : '<div style="color:#cbd5e1;">Workbook is valid. Apply import to replace the current warehouse layout.</div>'}
    `;
}

function metricCard(label, value) {
    return `
        <div style="background:#0f1217; border:1px solid #2f3540; border-radius:6px; padding:12px;">
            <div style="color:#9ca3af; font-size:0.78rem; text-transform:uppercase;">${label}</div>
            <div style="font-size:1.3rem; font-weight:700; margin-top:4px;">${Number(value || 0).toLocaleString()}</div>
        </div>
    `;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
