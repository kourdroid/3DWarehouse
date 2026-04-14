// ═══════════════════════════════════════════════════════
//  SMATCH WAREHOUSE BUILDER — CANVAS
//  Handles Konva.js rendering of the 2D footprint and zones
// ═══════════════════════════════════════════════════════

const BuilderCanvas = {
    stage: null,
    gridLayer: null,
    zoneLayer: null,
    footprintGroup: null,
    bgRect: null,
    scale: 20, // 20 pixels = 1 meter

    init(containerId) {
        console.log(`[BuilderCanvas] Initializing in #${containerId}`);
        const container = document.getElementById(containerId);
        if (!container) return;

        this.stage = new Konva.Stage({
            container: containerId,
            width: container.clientWidth,
            height: container.clientHeight,
            draggable: true
        });

        this.gridLayer = new Konva.Layer();
        this.zoneLayer = new Konva.Layer();

        this.stage.add(this.gridLayer);
        this.stage.add(this.zoneLayer);

        this.drawGrid();
        this.setupZoom();

        // Handle window resize
        window.addEventListener('resize', () => {
            if (container.offsetParent !== null) { // if visible
                this.stage.width(container.clientWidth);
                this.stage.height(container.clientHeight);
                this.drawGrid();
            }
        });

        // Load existing layout
        this.loadExistingLayout();
    },

    async loadExistingLayout() {
        const data = await BuilderAPI.loadLayout();
        if (data && data.name) {
            console.log("[BuilderCanvas] Restoring layout from DB...");

            // 1. Recreate footprint
            if (data.width_meters && data.length_meters) {
                this.createFootprint(data.width_meters, data.length_meters);
                // Update panel UI
                const bwName = document.getElementById('bw-name');
                const bwWidth = document.getElementById('bw-width');
                const bwLength = document.getElementById('bw-length');
                if (bwName) bwName.value = data.name;
                if (bwWidth) bwWidth.value = data.width_meters;
                if (bwLength) bwLength.value = data.length_meters;
            }

            // 2. Recreate Zones
            if (data.zones && Array.isArray(data.zones)) {
                data.zones.forEach(zData => {
                    const config = {
                        id: zData.id,
                        name: zData.name,
                        type: zData.type,
                        color: zData.color,
                        x: zData.x,
                        y: zData.y,
                        pattern: zData.pattern
                    };

                    // We extrapolate the visual UI inputs from the abstract width to make it draggable/resizable
                    if (config.type === 'STANDARD_RACK') {
                        // Rough assumption for rendering
                        config.aisles = Math.max(1, Math.floor(zData.width_meters / 3.0));
                        config.spacing = 3.0;
                        config.bays = Math.max(1, Math.floor(zData.length_meters / 2.8));
                        config.bayWidth = 2.8;
                    } else if (config.type === 'FLOOR_BULK') {
                        config.forcePhysicalWidth = zData.width_meters;
                        config.forcePhysicalLength = zData.length_meters;
                        config.floorSlots = zData.floorSlots;
                    }

                    this.addZone(config);
                });
            }
        }
    },

    setupZoom() {
        this.stage.on('wheel', (e) => {
            e.evt.preventDefault();
            const scaleBy = 1.1;
            const oldScale = this.stage.scaleX();
            const pointer = this.stage.getPointerPosition();

            const mousePointTo = {
                x: (pointer.x - this.stage.x()) / oldScale,
                y: (pointer.y - this.stage.y()) / oldScale,
            };

            let newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;

            // Limit zooming out
            if (newScale < 0.1) newScale = 0.1;
            if (newScale > 10) newScale = 10;

            this.stage.scale({ x: newScale, y: newScale });

            const newPos = {
                x: pointer.x - mousePointTo.x * newScale,
                y: pointer.y - mousePointTo.y * newScale,
            };
            this.stage.position(newPos);
            this.drawGrid();
        });

        this.stage.on('dragmove', () => {
            if (this.stage.isDragging()) {
                this.drawGrid();
            }
        });
    },

    drawGrid() {
        // Redraws the infinite background grid aligned to pan/zoom
        this.gridLayer.destroyChildren();

        const unscaledGridSize = 1; // 1 meter grid
        const gridSize = unscaledGridSize * this.scale * this.stage.scaleX();

        const width = this.stage.width();
        const height = this.stage.height();

        // Compute offset so grid lines stay aligned when panning
        const offsetX = this.stage.x() % gridSize;
        const offsetY = this.stage.y() % gridSize;

        for (let i = 0; i <= width / gridSize + 1; i++) {
            this.gridLayer.add(new Konva.Line({
                points: [Math.round(i * gridSize + offsetX), 0, Math.round(i * gridSize + offsetX), height],
                stroke: '#333333',
                strokeWidth: 1,
                opacity: 0.5
            }));
        }

        for (let j = 0; j <= height / gridSize + 1; j++) {
            this.gridLayer.add(new Konva.Line({
                points: [0, Math.round(j * gridSize + offsetY), width, Math.round(j * gridSize + offsetY)],
                stroke: '#333333',
                strokeWidth: 1,
                opacity: 0.5
            }));
        }

        this.gridLayer.batchDraw();
    },

    createFootprint(widthMeters, lengthMeters) {
        if (this.footprintGroup) {
            this.footprintGroup.destroy();
        }

        const pxWidth = widthMeters * this.scale;
        const pxLength = lengthMeters * this.scale;

        this.footprintGroup = new Konva.Group({
            x: 0,
            y: 0,
            id: 'footprint'
        });

        this.bgRect = new Konva.Rect({
            width: pxWidth,
            height: pxLength,
            fill: 'rgba(255, 255, 255, 0.05)',
            stroke: '#666',
            strokeWidth: 2,
        });

        const text = new Konva.Text({
            x: 10,
            y: 10,
            text: `WARHOUSE BOUNDARY\n${widthMeters}m x ${lengthMeters}m`,
            fontSize: 16,
            fontFamily: 'JetBrains Mono',
            fill: '#ccc'
        });

        this.footprintGroup.add(this.bgRect);
        this.footprintGroup.add(text);

        this.zoneLayer.add(this.footprintGroup);

        this.zoneLayer.batchDraw();
        this.drawGrid();
    },

    // Zone Management
    zones: [], // Array of zone Konva.Group objects
    transformer: null,

    setupTransformer() {
        if (!this.transformer) {
            this.transformer = new Konva.Transformer({
                nodes: [],
                ignoreStroke: true,
                padding: 1,
                boundBoxFunc: (oldBox, newBox) => {
                    // Min size limit
                    if (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 20) {
                        return oldBox;
                    }
                    return newBox;
                },
            });
            this.zoneLayer.add(this.transformer);

            // Click outside to deselect
            this.stage.on('click tap', (e) => {
                if (e.target === this.stage || e.target === this.bgRect) {
                    this.selectZone(null);
                }
            });
        }
    },

    selectZone(zoneGroup) {
        if (zoneGroup) {
            this.transformer.nodes([zoneGroup]);
        } else {
            this.transformer.nodes([]);
        }
        this.transformer.getLayer().batchDraw();
    },

    addZone(config) {
        if (!this.footprintGroup) return;

        this.setupTransformer();

        // Calculate visual dimensions based on physical mapping
        let pWidth = 0;
        let pLength = 0;

        if (config.type === 'STANDARD_RACK') {
            const rackDepth = 1.2;
            pWidth = Math.max(2, (config.aisles - 1) * config.spacing + rackDepth);
            pLength = config.bays * config.bayWidth;
        } else if (config.type === 'FLOOR_BULK') {
            pWidth = config.forcePhysicalWidth;
            pLength = config.forcePhysicalLength;
            config.width_meters = pWidth; // Ensure it serializes correctly later
            config.length_meters = pLength;
        }

        const group = new Konva.Group({
            x: config.x ?? 10 * this.scale,
            y: config.y ?? 10 * this.scale,
            id: config.id,
            draggable: true,
            name: 'zone'
        });

        // Add config data to the node for later serialization
        group.setAttr('zoneConfig', config);

        const rect = new Konva.Rect({
            width: pWidth * this.scale,
            height: pLength * this.scale,
            fill: config.color + '40', // 25% opacity
            stroke: config.color,
            strokeWidth: 2,
            name: 'zoneRect'
        });

        group.add(rect);

        // Internal rendering for aisles
        const linesGroup = new Konva.Group({ name: 'linesGroup' });
        group.add(linesGroup);
        this.redrawZoneInternals(group);

        // Name Tag
        const label = new Konva.Text({
            x: 5, y: 5,
            text: config.name,
            fontSize: 14,
            fontFamily: 'Outfit',
            fill: '#fff',
            name: 'zoneLabel'
        });
        group.add(label);

        // Interactions
        group.on('mouseenter', () => { document.body.style.cursor = 'move'; });
        group.on('mouseleave', () => { document.body.style.cursor = 'default'; });

        group.on('mousedown', () => {
            this.selectZone(group);
        });

        let startPos = { x: 0, y: 0 };
        group.on('dragstart', () => {
            startPos = { x: group.x(), y: group.y() };
        });

        group.on('dragmove', () => {
            this.checkBoundaryAndOverlap(group);
        });

        group.on('dragend', () => {
            if (this.hasOverlapError(group)) {
                // Return to start if invalid drag
                group.position(startPos);
                this.checkBoundaryAndOverlap(group);
                this.zoneLayer.batchDraw();
                // We don't record a command if cancelled
            } else {
                // Valid move, record to command stack (hacky implementation for simple undo, we really need robust diffs)
                const endPos = { x: group.x(), y: group.y() };
                if (startPos.x !== endPos.x || startPos.y !== endPos.y) {
                    const cmd = {
                        execute: () => { group.position(endPos); this.checkBoundaryAndOverlap(group); this.zoneLayer.batchDraw(); },
                        undo: () => { group.position(startPos); this.checkBoundaryAndOverlap(group); this.zoneLayer.batchDraw(); }
                    };
                    BuilderCommands.history.push(cmd);
                    BuilderCommands.position++;
                }
            }
        });

        group.on('transform', () => {
            // Reset scale, apply to width/height to keep strokes 1px
            const rectNode = group.findOne('.zoneRect');
            const newWidth = Math.max(5, rectNode.width() * group.scaleX());
            const newHeight = Math.max(5, rectNode.height() * group.scaleY());

            group.scaleX(1);
            group.scaleY(1);
            rectNode.width(newWidth);
            rectNode.height(newHeight);

            this.redrawZoneInternals(group);
            this.checkBoundaryAndOverlap(group);
        });

        this.footprintGroup.add(group);
        this.zones.push(group);
        this.selectZone(group);
        this.checkBoundaryAndOverlap(group);
        this.zoneLayer.batchDraw();
    },

    removeZone(id) {
        const idx = this.zones.findIndex(z => z.id() === id);
        if (idx !== -1) {
            const z = this.zones[idx];
            if (this.transformer && this.transformer.nodes()[0] === z) {
                this.selectZone(null);
            }
            z.destroy();
            this.zones.splice(idx, 1);
            this.zoneLayer.batchDraw();
        }
    },

    redrawZoneInternals(group) {
        const config = group.getAttr('zoneConfig');
        const linesGroup = group.findOne('.linesGroup');
        const rectNode = group.findOne('.zoneRect');
        linesGroup.destroyChildren();

        const w = rectNode.width();
        const h = rectNode.height();

        if (config.type === 'STANDARD_RACK') {
            const numAisles = config.aisles;

            // Draw vertical dashes representing aisles
            for (let i = 0; i < numAisles; i++) {
                const xPos = numAisles === 1 ? w / 2 : (w / (numAisles - 1)) * i;
                linesGroup.add(new Konva.Line({
                    points: [xPos, 0, xPos, h],
                    stroke: config.color,
                    strokeWidth: 2,
                    dash: [4, 4]
                }));
            }
        } else if (config.type === 'FLOOR_BULK') {
            // Draw a crosshatch / grid pattern for bulk
            const gridSize = 1.5 * this.scale; // Visual estimation of floor slots

            for (let x = gridSize; x < w; x += gridSize) {
                linesGroup.add(new Konva.Line({
                    points: [x, 0, x, h],
                    stroke: config.color,
                    strokeWidth: 1,
                    opacity: 0.3
                }));
            }
            for (let y = gridSize; y < h; y += gridSize) {
                linesGroup.add(new Konva.Line({
                    points: [0, y, w, y],
                    stroke: config.color,
                    strokeWidth: 1,
                    opacity: 0.3
                }));
            }
        }
    },

    hasOverlapError(targetNode) {
        // Simple bounding box intersection check against other zones and footprint bounds
        let isError = false;
        const box1 = targetNode.getClientRect();

        // 1. Check if outside footprint
        const fpBox = this.bgRect.getClientRect();
        if (
            box1.x < fpBox.x ||
            box1.y < fpBox.y ||
            box1.x + box1.width > fpBox.x + fpBox.width ||
            box1.y + box1.height > fpBox.y + fpBox.height
        ) {
            isError = true;
        }

        // 2. Check overlap with other zones
        if (!isError) {
            for (let i = 0; i < this.zones.length; i++) {
                const other = this.zones[i];
                if (other === targetNode) continue;

                const box2 = other.getClientRect();
                if (
                    box1.x < box2.x + box2.width &&
                    box1.x + box1.width > box2.x &&
                    box1.y < box2.y + box2.height &&
                    box1.y + box1.height > box2.y
                ) {
                    isError = true;
                    // Auto-flag the other zone red too temporarily
                    const oldStroke = other.findOne('.zoneRect').stroke();
                    if (oldStroke !== '#ef4444') {
                        other.findOne('.zoneRect').stroke('#ef4444');
                        other.setAttr('wasError', oldStroke);
                    }
                    break;
                }
            }
        }
        return isError;
    },

    checkBoundaryAndOverlap(targetNode) {
        // Reset all zones error states
        this.zones.forEach(z => {
            const oldStroke = z.getAttr('wasError');
            if (oldStroke) {
                z.findOne('.zoneRect').stroke(oldStroke);
                z.setAttr('wasError', null);
            }
        });

        const isError = this.hasOverlapError(targetNode);

        const rectNode = targetNode.findOne('.zoneRect');
        if (isError) {
            const currentStroke = rectNode.stroke();
            if (currentStroke !== '#ef4444') {
                targetNode.setAttr('wasError', currentStroke);
                rectNode.stroke('#ef4444');
                rectNode.strokeWidth(4);
            }
        } else {
            const oldStroke = targetNode.getAttr('wasError');
            if (oldStroke) {
                rectNode.stroke(oldStroke);
                rectNode.strokeWidth(2);
                targetNode.setAttr('wasError', null);
            }
        }
    },

    serialize() {
        if (!this.footprintGroup) {
            return null;
        }

        // 1. Get footprint dimensions (in meters)
        const width_meters = this.bgRect.width() / this.scale;
        const length_meters = this.bgRect.height() / this.scale;

        // 2. Map zones
        const zonesConfig = this.zones.map(group => {
            const config = group.getAttr('zoneConfig');

            // X, Y are relative to footprint bounds. Calculate physical meters.
            // Konva group x, y is relative to stage if added to layer, but here they are added to footprintGroup.
            // So group.x() / scale gives meters from footprint top-left.
            const x_m = group.x() / this.scale;
            const z_m = group.y() / this.scale; // Y in 2D is Z in 3D
            const rectNode = group.findOne('.zoneRect');
            const w_m = rectNode.width() / this.scale;
            const l_m = rectNode.height() / this.scale;

            return {
                name: config.name,
                color_hex: config.color,
                storage_type: config.type,
                position_x_meters: x_m,
                position_z_meters: z_m,
                width_meters: w_m,
                length_meters: l_m,

                // Fields required for LayoutBuilderService generation parameters
                aisles: config.aisles || 0,
                spacing: config.spacing || 0,
                bays_per_aisle: config.bays || 0,
                bay_width_meters: config.bayWidth || 0,
                levels: config.levels || 0,
                pallets_per_bay: config.pallets || 1,

                // Phase 6/7 parameters
                floor_slots: config.floorSlots || 0,
                location_code_pattern: config.pattern || "{zone_name}-A{aisle_num:02d}-B{bay_num:03d}-L{level_num}"
            };
        });

        // 3. Assemble full payload
        const payload = {
            name: document.getElementById('bw-name')?.value || "Custom Layout",
            total_width_meters: width_meters,
            total_length_meters: length_meters,
            zones: zonesConfig
        };

        return payload;
    }
};
