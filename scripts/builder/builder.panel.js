// ═══════════════════════════════════════════════════════
//  SMATCH WAREHOUSE BUILDER — UI PANEL
//  Handles HTML inputs and sliders for zone constraints
// ═══════════════════════════════════════════════════════

// Global entry point called by main.js router
function initBuilder() {
    console.log("[Builder] Initializing builder...");
    BuilderPanel.init();
    BuilderCanvas.init('canvas-wrapper');
}

const BuilderPanel = {
    containerId: 'builder-container',

    init() {
        console.log(`[BuilderPanel] Initializing UI controls`);
        this.renderPanel();
        this.bindEvents();
    },

    renderPanel() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const panelHTML = `
            <div id="builder-panel" style="position: absolute; top: 0; right: 0; width: 320px; height: 100vh; background: #1a1e24; border-left: 1px solid #333; padding: 20px; color: #fff; z-index: 10; display: flex; flex-direction: column; font-family: 'Outfit', sans-serif;">
                <h2 style="margin-top: 0; font-size: 1.2rem; border-bottom: 1px solid #333; padding-bottom: 15px;">Layout Tools</h2>
                
                <div id="new-warehouse-form" style="display: flex; flex-direction: column; gap: 15px; margin-top: 20px;">
                    <h3 style="font-size: 1rem; color: #aaa; margin: 0;">New Footprint</h3>
                    
                    <label style="display: flex; flex-direction: column; font-size: 0.9rem;">
                        Name:
                        <input type="text" id="bw-name" placeholder="Warehouse Name" value="Primary Facility" style="margin-top: 5px; padding: 8px; background: #12151a; border: 1px solid #444; color: #fff; outline: none; border-radius: 4px;">
                    </label>

                    <label style="display: flex; flex-direction: column; font-size: 0.9rem;">
                        Width (m):
                        <input type="number" id="bw-width" value="60" min="10" step="1" style="margin-top: 5px; padding: 8px; background: #12151a; border: 1px solid #444; color: #fff; outline: none; border-radius: 4px;">
                    </label>

                    <label style="display: flex; flex-direction: column; font-size: 0.9rem;">
                        Length (m):
                        <input type="number" id="bw-length" value="120" min="10" step="1" style="margin-top: 5px; padding: 8px; background: #12151a; border: 1px solid #444; color: #fff; outline: none; border-radius: 4px;">
                    </label>

                    <button id="bw-create-btn" style="margin-top: 10px; padding: 10px; background: #2563eb; color: #fff; border: none; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-weight: bold; cursor: pointer; transition: background 0.2s;">CREATE FOOTPRINT</button>
                </div>

                <div id="add-rack-zone-form" style="display: flex; flex-direction: column; gap: 15px; margin-top: 30px;">
                    <h3 style="font-size: 1rem; color: #aaa; margin: 0; display: flex; justify-content: space-between;">
                        <span>Add Rack Zone</span>
                        <span id="rz-stats" style="color: #60a5fa; font-size: 0.8rem; font-weight: normal; margin-top: 2px;">0 slots</span>
                    </h3>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <label style="display: flex; flex-direction: column; font-size: 0.8rem;">
                            Aisles:
                            <input type="number" id="rz-aisles" value="4" min="1" max="100" class="rz-input" style="margin-top: 5px; padding: 6px; background: #12151a; border: 1px solid #444; color: #fff; outline: none; border-radius: 4px;">
                        </label>
                        <label style="display: flex; flex-direction: column; font-size: 0.8rem;">
                            Spacing (m):
                            <input type="number" id="rz-spacing" value="3.5" min="1.0" step="0.5" class="rz-input" style="margin-top: 5px; padding: 6px; background: #12151a; border: 1px solid #444; color: #fff; outline: none; border-radius: 4px;">
                        </label>
                        <label style="display: flex; flex-direction: column; font-size: 0.8rem;">
                            Bays / Aisle:
                            <input type="number" id="rz-bays" value="10" min="1" max="100" class="rz-input" style="margin-top: 5px; padding: 6px; background: #12151a; border: 1px solid #444; color: #fff; outline: none; border-radius: 4px;">
                        </label>
                        <label style="display: flex; flex-direction: column; font-size: 0.8rem;">
                            Bay Width (m):
                            <input type="number" id="rz-bay-width" value="2.8" min="0.5" max="10" step="0.1" class="rz-input" style="margin-top: 5px; padding: 6px; background: #12151a; border: 1px solid #444; color: #fff; outline: none; border-radius: 4px;">
                        </label>
                        <label style="display: flex; flex-direction: column; font-size: 0.8rem;">
                            Levels (incl. floor):
                            <input type="number" id="rz-levels" value="5" min="1" max="50" class="rz-input" style="margin-top: 5px; padding: 6px; background: #12151a; border: 1px solid #444; color: #fff; outline: none; border-radius: 4px;">
                        </label>
                        <label style="display: flex; flex-direction: column; font-size: 0.8rem;">
                            Pallets / Bay:
                            <input type="number" id="rz-pallets" value="3" min="1" max="6" class="rz-input" style="margin-top: 5px; padding: 6px; background: #12151a; border: 1px solid #444; color: #fff; outline: none; border-radius: 4px;">
                        </label>
                    </div>

                    <label style="display: flex; flex-direction: column; font-size: 0.8rem; margin-top: 5px;">
                        Location Code Pattern (Python str.format):
                        <input type="text" id="rz-pattern" value="{zone_name}-A{aisle_num:02d}-B{bay_num:03d}-L{level_num}" style="margin-top: 5px; padding: 6px; background: #12151a; border: 1px solid #444; color: #fff; outline: none; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.75rem;">
                    </label>

                    <button id="rz-add-btn" style="margin-top: 5px; padding: 10px; background: #10b981; color: #fff; border: none; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-weight: bold; cursor: pointer; transition: background 0.2s;">DROP ZONE ON CANVAS</button>
                </div>

                <div id="add-bulk-zone-form" style="display: flex; flex-direction: column; gap: 15px; margin-top: 30px;">
                    <h3 style="font-size: 1rem; color: #aaa; margin: 0; display: flex; justify-content: space-between;">
                        <span>Add Floor Bulk Zone</span>
                        <span id="bz-stats" style="color: #60a5fa; font-size: 0.8rem; font-weight: normal; margin-top: 2px;">10 slots</span>
                    </h3>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                        <label style="display: flex; flex-direction: column; font-size: 0.8rem;">
                            Width (m):
                            <input type="number" id="bz-width" value="10" min="2" max="100" class="bz-input" style="margin-top: 5px; padding: 6px; background: #12151a; border: 1px solid #444; color: #fff; outline: none; border-radius: 4px;">
                        </label>
                        <label style="display: flex; flex-direction: column; font-size: 0.8rem;">
                            Length (m):
                            <input type="number" id="bz-length" value="10" min="2" max="100" class="bz-input" style="margin-top: 5px; padding: 6px; background: #12151a; border: 1px solid #444; color: #fff; outline: none; border-radius: 4px;">
                        </label>
                    </div>

                    <label style="display: flex; flex-direction: column; font-size: 0.8rem; margin-top: 5px;">
                        Location Code Pattern (Python str.format):
                        <input type="text" id="bz-pattern" value="{zone_name}-S{slot_num:03d}" style="margin-top: 5px; padding: 6px; background: #12151a; border: 1px solid #444; color: #fff; outline: none; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.75rem;">
                    </label>

                    <button id="bz-add-btn" style="margin-top: 5px; padding: 10px; background: #f59e0b; color: #fff; border: none; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-weight: bold; cursor: pointer; transition: background 0.2s;">DROP BULK ZONE</button>
                </div>
                
                <div style="flex-grow: 1;"></div>
                
                <button id="save-generate-btn" style="width: 100%; margin-top: 20px; padding: 15px; background: #8b5cf6; color: #fff; border: none; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-weight: bold; cursor: pointer; transition: background 0.2s; box-shadow: 0 4px 6px rgba(139, 92, 246, 0.3);">SAVE & GENERATE 3D</button>
            </div>
            
            <div id="canvas-wrapper" style="position: absolute; top: 0; left: 0; right: 320px; bottom: 0;"></div>
        `;

        container.innerHTML = panelHTML;
    },

    bindEvents() {
        document.getElementById('bw-create-btn').addEventListener('click', () => {
            const name = document.getElementById('bw-name').value || 'New Warehouse';
            const w = parseFloat(document.getElementById('bw-width').value);
            const l = parseFloat(document.getElementById('bw-length').value);

            if (!w || !l || w < 10 || l < 10) {
                alert('Invalid dimensions. Must be at least 10x10 meters.');
                return;
            }

            // Command Pattern integration for undo/redo Support
            // We store the state of the old group entirely so undoing restores it
            const oldWidth = BuilderCanvas.footprintGroup ? BuilderCanvas.bgRect.width() / BuilderCanvas.scale : null;
            const oldLength = BuilderCanvas.footprintGroup ? BuilderCanvas.bgRect.height() / BuilderCanvas.scale : null;

            const command = {
                execute: () => BuilderCanvas.createFootprint(w, l),
                undo: () => {
                    if (oldWidth !== null && oldLength !== null) {
                        BuilderCanvas.createFootprint(oldWidth, oldLength);
                    } else {
                        if (BuilderCanvas.footprintGroup) {
                            BuilderCanvas.footprintGroup.destroy();
                            BuilderCanvas.footprintGroup = null;
                        }
                        BuilderCanvas.zoneLayer.batchDraw();
                    }
                }
            };
            BuilderCommands.execute(command);
        });

        // Rack Zone Stat Auto-Calculation
        const rzInputs = document.querySelectorAll('.rz-input');
        const updateRzStats = () => {
            const aisles = parseInt(document.getElementById('rz-aisles').value) || 0;
            const bays = parseInt(document.getElementById('rz-bays').value) || 0;
            const levels = parseInt(document.getElementById('rz-levels').value) || 0;
            const pallets = parseInt(document.getElementById('rz-pallets').value) || 0;
            const total = aisles * 2 * bays * levels * pallets; // *2 because each aisle has two sides of racking conceptually, or it represents a block. Wait, the spec models Aisles having bays. Does an aisle equal a double-rack block? Let's assume 1 aisle = 1 line of racking for simplicity unless specified. Let's assume standard single-deep.
            document.getElementById('rz-stats').textContent = `${(aisles * bays * levels * pallets).toLocaleString()} slots`;
        };
        rzInputs.forEach(input => input.addEventListener('input', updateRzStats));
        updateRzStats();

        // Add Rack Zone Button
        document.getElementById('rz-add-btn').addEventListener('click', () => {
            if (!BuilderCanvas.footprintGroup) {
                alert("Please create a warehouse footprint first.");
                return;
            }

            const config = {
                id: 'zone-' + Date.now(),
                name: 'Rack Zone ' + (BuilderCanvas.zones.length + 1),
                type: 'STANDARD_RACK',
                color: '#2563eb',
                aisles: parseInt(document.getElementById('rz-aisles').value) || 4,
                spacing: parseFloat(document.getElementById('rz-spacing').value) || 3.5,
                bays: parseInt(document.getElementById('rz-bays').value) || 10,
                bayWidth: parseFloat(document.getElementById('rz-bay-width').value) || 2.8,
                levels: parseInt(document.getElementById('rz-levels').value) || 5,
                pallets: parseInt(document.getElementById('rz-pallets').value) || 3,
                pattern: document.getElementById('rz-pattern').value || "{zone_name}-A{aisle_num:02d}-B{bay_num:03d}-L{level_num}",
                x: 0,
                y: 0
            };

            const command = {
                execute: () => BuilderCanvas.addZone(config),
                undo: () => BuilderCanvas.removeZone(config.id)
            };

            BuilderCommands.execute(command);
        });

        // Bulk Zone Stat Auto-Calculation
        const bzInputs = document.querySelectorAll('.bz-input');
        const updateBzStats = () => {
            const w = parseFloat(document.getElementById('bz-width').value) || 0;
            const l = parseFloat(document.getElementById('bz-length').value) || 0;
            // Approx 1.5m^2 per floor slot
            const slots = Math.floor((w * l) / 1.5);
            document.getElementById('bz-stats').textContent = `~${slots.toLocaleString()} slots`;
        };
        bzInputs.forEach(input => input.addEventListener('input', updateBzStats));
        updateBzStats();

        // Add Bulk Zone Button
        document.getElementById('bz-add-btn').addEventListener('click', () => {
            if (!BuilderCanvas.footprintGroup) {
                alert("Please create a warehouse footprint first.");
                return;
            }

            const w = parseFloat(document.getElementById('bz-width').value) || 10;
            const l = parseFloat(document.getElementById('bz-length').value) || 10;
            const slots = Math.floor((w * l) / 1.5);

            const config = {
                id: 'zone-' + Date.now(),
                name: 'Bulk Zone ' + (BuilderCanvas.zones.length + 1),
                type: 'FLOOR_BULK',
                color: '#f59e0b', // amber
                floorSlots: slots,
                forcePhysicalWidth: w,   // Pass explicit dimensions
                forcePhysicalLength: l,
                pattern: document.getElementById('bz-pattern').value || "{zone_name}-S{slot_num:03d}",
                x: 0,
                y: 0
            };

            const command = {
                execute: () => BuilderCanvas.addZone(config),
                undo: () => BuilderCanvas.removeZone(config.id)
            };

            BuilderCommands.execute(command);
        });

        // Save and Generate 3D Button
        document.getElementById('save-generate-btn').addEventListener('click', async () => {
            const btn = document.getElementById('save-generate-btn');

            if (!BuilderCanvas.footprintGroup) {
                alert("Nothing to save. Create a footprint first.");
                return;
            }

            // Optional: check for validation errors visually
            let hasErrors = false;
            BuilderCanvas.zones.forEach(z => {
                if (z.getAttr('wasError')) hasErrors = true;
            });
            if (hasErrors) {
                if (!confirm("There are overlapping zones. Proceed anyway?")) {
                    return;
                }
            }

            const payload = BuilderCanvas.serialize();

            try {
                btn.disabled = true;
                btn.textContent = "SAVING...";
                btn.style.background = "#6b7280"; // gray out

                const result = await BuilderAPI.configureLayout(payload);
                if (result) {
                    btn.textContent = "SUCCESS!";
                    btn.style.background = "#10b981"; // green
                    setTimeout(() => {
                        // Switch back to 3D Viewer to see results auto-refresh
                        window.location.hash = '#/viewer';
                    }, 1000);
                }
            } catch (err) {
                btn.textContent = "SAVE FAILED";
                btn.style.background = "#ef4444"; // red
                console.error(err);
                setTimeout(() => {
                    btn.textContent = "SAVE & GENERATE 3D";
                    btn.style.background = "#8b5cf6";
                    btn.disabled = false;
                }, 3000);
            }
        });
    }
};
