// ═══════════════════════════════════════════════════════
//  SMATCH WAREHOUSE — DATA & INSTANCED RENDERING
//  Generates mock WMS data and builds all InstancedMesh
//  objects for the rack structure and goods.
// ═══════════════════════════════════════════════════════

// ─── WMS Data Generation ────────────────────────────
// Previously hardcoded. Now obsolete; replaced by WebSocket Snapshot.
function generateWMSData() {
    console.warn("generateWMSData called but is deprecated via WS integration.");
}

// ─── Instanced Warehouse ────────────────────────────
function buildStructureFromLayout(layout) {
    if (!layout || !layout.zones) return;

    // 1. Calculate buffer sizes for InstancedMeshes
    let totalBays = 0, totalLevels = 0, totalBulkFloorUnits = 100;
    layout.zones.forEach(zone => {
        if (zone.storage_type === 'STANDARD_RACK') {
            zone.aisles.forEach(aisle => {
                totalBays += aisle.rack_bays.length;
                aisle.rack_bays.forEach(bay => {
                    totalLevels += bay.levels.length;
                });
            });
        }
    });

    // 2. Setup Geometries and Materials
    const uprightGeo = new THREE.BoxGeometry(0.08, Math.max((totalLevels / Math.max(totalBays, 1)) * 1.5, 6), 0.08);
    const beamGeo = new THREE.BoxGeometry(1.0, 0.10, 0.08); // Base 1m width, scaled per instance
    const palletGoodsGeo = new THREE.BoxGeometry(1.1, 0.85, 1.1);
    const palletBaseGeo = new THREE.BoxGeometry(1.2, 0.15, 1.2);
    const floorMarkingGeo = new THREE.PlaneGeometry(1.2, 1.2);

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x3a4555, roughness: 0.35, metalness: 0.65 });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0xffc30d, roughness: 0.6, metalness: 0.15 });
    const shrinkWrapMat = new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.88 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.85 });
    const floorZoneMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.9, transparent: true, opacity: 0.4 });

    // 3. Initialize Shared InstancedMeshes
    rackMesh = new THREE.InstancedMesh(uprightGeo, metalMat, totalBays * 2);
    beamMesh = new THREE.InstancedMesh(beamGeo, beamMat, totalLevels * 2);
    palletMesh = new THREE.InstancedMesh(palletGoodsGeo, shrinkWrapMat, totalLevels + totalBulkFloorUnits);
    palletBaseMesh = new THREE.InstancedMesh(palletBaseGeo, woodMat, totalLevels + totalBulkFloorUnits);

    // We repurpose emptyPalletRectFillMesh for Floor Bulk marking for simplicity in MVP
    emptyPalletRectFillMesh = new THREE.InstancedMesh(floorMarkingGeo, floorZoneMat, totalBulkFloorUnits);

    [rackMesh, beamMesh, palletMesh, palletBaseMesh].forEach(m => {
        m.castShadow = true; m.receiveShadow = true;
        scene.add(m);
        instanceDataMap[m.uuid] = {};
    });

    emptyPalletRectFillMesh.rotation.x = -Math.PI / 2;
    emptyPalletRectFillMesh.position.y = 0.01;
    scene.add(emptyPalletRectFillMesh);

    // Global Registry Counters
    let counters = { rack: 0, beam: 0, pallet: 0, floor: 0 };

    // 4. Dispatch construction per zone
    layout.zones.forEach(zone => {
        console.log(`[Layout] Zone: ${zone.name} (${zone.storage_type}) — ${zone.aisles ? zone.aisles.length : 0} aisles`);
        if (zone.storage_type === 'STANDARD_RACK') {
            buildRackZone(zone, counters);
        } else if (zone.storage_type === 'FLOOR_BULK') {
            buildFloorBulkZone(zone, counters);
        }
    });

    console.log(`[Layout] Final counters — racks: ${counters.rack}, beams: ${counters.beam}, pallets: ${counters.pallet}, floor: ${counters.floor}`);
    console.log(`[Layout] PHYSICAL_MAP has ${Object.keys(PHYSICAL_MAP).length} entries`);
    console.log(`[Layout] wmsData has ${wmsData.length} items`);

    // 5. Build Initial Inventory State
    buildInitialInventory(counters);

    // 6. Push Matrix updates to GPU
    [rackMesh, beamMesh, palletMesh, palletBaseMesh, emptyPalletRectFillMesh].forEach(m => {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
}

function buildRackZone(zone, counter) {
    const zoneColor = new THREE.Color(zone.color_hex || 0x2563eb);

    zone.aisles.forEach(aisle => {
        aisle.rack_bays.forEach(bay => {
            // Physical Anchors
            const bx = zone.position_x_meters + aisle.start_x_meters + (bay.sequence_number * bay.width_meters);
            const bz = zone.position_z_meters + aisle.start_z_meters;

            // Uprights
            dummy.scale.set(1, 1, 1);
            dummy.rotation.set(0, 0, 0);

            // Left Upright
            dummy.position.set(bx, 3, bz);
            dummy.updateMatrix();
            rackMesh.setMatrixAt(counter.rack++, dummy.matrix);

            // Right Upright
            dummy.position.set(bx + bay.width_meters, 3, bz);
            dummy.updateMatrix();
            rackMesh.setMatrixAt(counter.rack++, dummy.matrix);

            // Levels
            bay.levels.forEach(level => {
                const ly = level.height_meters * level.level_number + 0.2;

                // Front and Back Beams, scaling width dynamically
                dummy.scale.set(bay.width_meters, 1, 1);

                // Front Beam
                dummy.position.set(bx + bay.width_meters / 2, ly, bz + 0.5);
                dummy.updateMatrix();
                beamMesh.setMatrixAt(counter.beam, dummy.matrix);
                beamMesh.setColorAt(counter.beam++, zoneColor);

                // Back Beam
                dummy.position.set(bx + bay.width_meters / 2, ly, bz - 0.5);
                dummy.updateMatrix();
                beamMesh.setMatrixAt(counter.beam, dummy.matrix);
                beamMesh.setColorAt(counter.beam++, zoneColor);

                // Register physical coordinates map for live updates
                const perPalletWidth = bay.width_meters / bay.pallets_per_bay;

                for (let p_idx = 0; p_idx < bay.pallets_per_bay; p_idx++) {
                    let locCode = `${bay.identifier}-L${level.level_number}`;
                    if (bay.pallets_per_bay > 1) {
                        locCode += `-P${p_idx + 1}`;
                    }

                    // Offset center of this specific pallet slot
                    const palletCenterX = bx + (p_idx * perPalletWidth) + (perPalletWidth / 2);
                    PHYSICAL_MAP[locCode] = { x: palletCenterX, y: ly, z: bz };
                }
            });
        });
    });
}

function buildFloorBulkZone(zone, counter) {
    const floorColor = new THREE.Color(zone.color_hex || 0xf59e0b);

    // Simplistic scatter logic for floor mapping
    let gridX = 0, gridZ = 0;

    // This loops over generic Bulk IDs or if the WMS state matches
    // But since the Layout API doesn't list individual floor slots,
    // we use a predictable coordinate generator for BULK locations
    for (let i = 0; i < 50; i++) {
        const locCode = `BULK-${i}`;
        const bx = zone.position_x_meters + gridX * 1.5;
        const bz = zone.position_z_meters + gridZ * 1.5;

        // Wrap grid
        gridX++;
        if (gridX * 1.5 > zone.width_meters) { gridX = 0; gridZ++; }

        PHYSICAL_MAP[locCode] = { x: bx, y: 0, z: bz };

        // Floor painting
        dummy.position.set(bx, 0, bz);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        emptyPalletRectFillMesh.setMatrixAt(counter.floor, dummy.matrix);
        emptyPalletRectFillMesh.setColorAt(counter.floor++, floorColor);
    }
}

function buildInitialInventory(counter) {
    wmsData.forEach(item => {
        const pLoc = PHYSICAL_MAP[item.id];
        if (!pLoc) return; // Ignore items strictly outside our generated layout map

        const pX = pLoc.x, pY = pLoc.y, pZ = pLoc.z;

        if (item.occupied) {
            const baseY = pY + 0.1;

            // Pallet Base
            dummy.position.set(pX, baseY, pZ);
            dummy.updateMatrix();
            palletBaseMesh.setMatrixAt(counter.pallet, dummy.matrix);

            // Goods
            const gY = baseY + 0.5;
            dummy.position.set(pX, gY, pZ);
            dummy.updateMatrix();
            palletMesh.setMatrixAt(counter.pallet, dummy.matrix);

            color.setHex(item.type === 'BOX' ? 0xc4956a : 0xd0d5dc);
            palletMesh.setColorAt(counter.pallet, color);

            // Registration
            item.instanceId = counter.pallet;
            item.meshUuid = palletMesh.uuid;
            counter.pallet++;
        }
    });
}

function createInstancedWarehouse() {
    const totalBays = CONFIG.aisles * CONFIG.baysPerAisle;
    const totalLevels = totalBays * CONFIG.levels;
    const maxPallets = totalLevels;
    const maxBoxes = totalLevels * 4;

    let emptyPalletCount = 0, emptyBoxCount = 0, occupiedPalletCount = 0;
    for (const it of wmsData) {
        if (!it.occupied) {
            if (it.type === 'BOX') emptyBoxCount++; else emptyPalletCount++;
        } else if (it.type === 'PALLET') occupiedPalletCount++;
    }

    // ── Geometries ──
    const uprightGeo = new THREE.BoxGeometry(0.08, CONFIG.levels * CONFIG.levelHeight, 0.08);
    const beamGeo = new THREE.BoxGeometry(CONFIG.rackWidth, 0.10, 0.08);
    const palletGoodsGeo = new THREE.BoxGeometry(1.1, 0.85, 1.1);
    const palletCartonGeo = new THREE.BoxGeometry(0.35, 0.28, 0.35);
    const palletBaseGeo = new THREE.BoxGeometry(CONFIG.palletBaseWidth, CONFIG.palletBaseHeight, CONFIG.palletBaseDepth);
    const boxGeo = new THREE.BoxGeometry(0.38, 0.28, 0.55);
    const palletRectGeo = new THREE.PlaneGeometry(1.2, 1.2);
    const boxRectGeo = new THREE.PlaneGeometry(0.4, 0.6);
    const edgeGeo = new THREE.BoxGeometry(1, 1, 1);

    // ── Materials ──
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x3a4555, roughness: 0.35, metalness: 0.65 });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0xffc30d, roughness: 0.6, metalness: 0.15 });
    const shrinkWrapMat = new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.88 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.85 });
    const cardboardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78 });
    const rectFillMat = new THREE.MeshBasicMaterial({ color: 0x32ff6f, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
    const rectEdgeMat = new THREE.MeshBasicMaterial({ color: 0x00ff66, transparent: true, opacity: 0.9 });

    // ── Instanced Meshes ──
    rackMesh = new THREE.InstancedMesh(uprightGeo, metalMat, totalBays * 2);
    beamMesh = new THREE.InstancedMesh(beamGeo, beamMat, totalLevels * 2);
    palletMesh = new THREE.InstancedMesh(palletGoodsGeo, shrinkWrapMat, maxPallets);
    palletCartonMesh = new THREE.InstancedMesh(palletCartonGeo, cardboardMat, Math.max(occupiedPalletCount * 27, 1));
    palletBaseMesh = new THREE.InstancedMesh(palletBaseGeo, woodMat, Math.max(occupiedPalletCount, 1));
    boxMesh = new THREE.InstancedMesh(boxGeo, cardboardMat, maxBoxes);

    if (emptyPalletCount > 0) emptyPalletRectFillMesh = new THREE.InstancedMesh(palletRectGeo, rectFillMat, emptyPalletCount);
    if (emptyBoxCount > 0) emptyBoxRectFillMesh = new THREE.InstancedMesh(boxRectGeo, rectFillMat, emptyBoxCount);
    if (emptyPalletCount > 0) emptyPalletRectFrameMesh = new THREE.InstancedMesh(edgeGeo, rectEdgeMat, emptyPalletCount * 4);
    if (emptyBoxCount > 0) emptyBoxRectFrameMesh = new THREE.InstancedMesh(edgeGeo, rectEdgeMat, emptyBoxCount * 4);

    [rackMesh, beamMesh, palletMesh, palletCartonMesh, palletBaseMesh, boxMesh].forEach(m => {
        m.castShadow = true; m.receiveShadow = true;
        scene.add(m); instanceDataMap[m.uuid] = {};
    });
    [emptyPalletRectFillMesh, emptyBoxRectFillMesh, emptyPalletRectFrameMesh, emptyBoxRectFrameMesh].forEach(m => {
        if (m) { m.castShadow = false; m.receiveShadow = false; scene.add(m); }
    });

    let rackIdx = 0, beamIdx = 0, palletIdx = 0, palletCartonIdx = 0, boxIdx = 0, palletBaseIdx = 0;
    let ePFI = 0, eBFI = 0, ePFrI = 0, eBFrI = 0;

    wmsData.forEach(item => {
        // T018: Instead of hardcoded a,b,l grid logic, we would parse item.x / item.y / item.z 
        // derived from the DB layout coordinates. Since this MVP streams legacy ids, 
        // we parse the 'A0-B0-L0' legacy token to simulate layout mapping.

        let a = item.aisle || 0;
        let b = item.bay || 0;
        let l = item.level || 0;

        // Example parsing from legacy location string "A0-B1-L2-0"
        if (item.id && item.id.includes('-')) {
            const parts = item.id.split('-');
            if (parts[0]) a = parseInt(parts[0].replace('A', '')) || a;
            if (parts[1]) b = parseInt(parts[1].replace('B', '')) || b;
            if (parts[2]) l = parseInt(parts[2].replace('L', '')) || l;
            if (parts[3] && !item.subSlot) item.subSlot = parseInt(parts[3]) || 0;
        }

        const z = a * (CONFIG.rackDepth + CONFIG.aisleWidth);
        const x = b * CONFIG.rackWidth;
        const y = l * CONFIG.levelHeight + 0.2;

        // T019: Different visual rendering logic per zone type.
        // In the true layout mode, item.zoneType === 'FLOOR_BULK' vs 'STANDARD_RACK'
        // For the backward compatible logic, BOX logic here maps to picking/rack, PALLET mappings to bulk/rack.
        const isPicking = item.type === 'BOX';

        // ── Rack structure (uprights & beams) ──
        if (item.subSlot === 0) {
            dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0);
            if (l === 0) {
                dummy.position.set(x, (CONFIG.levels * CONFIG.levelHeight) / 2, z);
                dummy.updateMatrix(); rackMesh.setMatrixAt(rackIdx++, dummy.matrix);
                dummy.position.set(x + CONFIG.rackWidth, (CONFIG.levels * CONFIG.levelHeight) / 2, z);
                dummy.updateMatrix(); rackMesh.setMatrixAt(rackIdx++, dummy.matrix);
            }
            dummy.position.set(x + CONFIG.rackWidth / 2, y, z + CONFIG.rackDepth / 2 - 0.04);
            dummy.updateMatrix(); beamMesh.setMatrixAt(beamIdx++, dummy.matrix);
            dummy.position.set(x + CONFIG.rackWidth / 2, y, z - CONFIG.rackDepth / 2 + 0.04);
            dummy.updateMatrix(); beamMesh.setMatrixAt(beamIdx++, dummy.matrix);
        }

        // ── Occupied goods ──
        if (item.occupied) {
            if (isPicking) {
                // BOX
                const slotW = CONFIG.rackWidth / 4;
                const xOff = item.subSlot * slotW + slotW / 2;
                const pX = x + xOff, pY = y + 0.28, pZ = z;
                dummy.position.set(pX, pY, pZ);
                item.worldPos = { x: pX, y: pY, z: pZ };
                dummy.scale.set(1, 1, 1);
                dummy.rotation.set(0, (Math.random() - 0.5) * 0.15, 0);
                dummy.updateMatrix();
                boxMesh.setMatrixAt(boxIdx, dummy.matrix);
                color.setHex(0xc4956a);
                boxMesh.setColorAt(boxIdx, color);
                instanceDataMap[boxMesh.uuid][boxIdx] = item;
                item.instanceId = boxIdx; item.meshUuid = boxMesh.uuid;
                boxIdx++;
            } else {
                // PALLET
                const pX = x + CONFIG.rackWidth / 2, pZ = z;
                const baseY = y + CONFIG.palletBaseHeight / 2 + 0.02;

                // Pallet base (wood)
                dummy.position.set(pX, baseY, pZ);
                dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0);
                dummy.updateMatrix();
                palletBaseMesh.setMatrixAt(palletBaseIdx, dummy.matrix);
                color.setHex(0x8B6914);
                palletBaseMesh.setColorAt(palletBaseIdx, color);
                palletBaseIdx++;

                // Shrink wrap
                const pY = baseY + CONFIG.palletBaseHeight / 2 + 0.85 / 2;
                dummy.position.set(pX, pY, pZ);
                item.worldPos = { x: pX, y: pY, z: pZ };
                dummy.updateMatrix();
                palletMesh.setMatrixAt(palletIdx, dummy.matrix);
                color.setHex(0xd0d5dc);
                palletMesh.setColorAt(palletIdx, color);

                // Individual cartons (3×3 grid × 3 layers = 27)
                const cw = 0.35, ch = 0.28, cd = 0.35;
                const startX = pX - cw;
                const startZ = pZ - cd;
                const startY = baseY + CONFIG.palletBaseHeight / 2 + ch / 2;
                for (let ly = 0; ly < 3; ly++) {
                    for (let rx = 0; rx < 3; rx++) {
                        for (let rz = 0; rz < 3; rz++) {
                            dummy.position.set(startX + rx * cw, startY + ly * ch + 0.01, startZ + rz * cd);
                            dummy.scale.set(0.96, 0.96, 0.96);
                            dummy.updateMatrix();
                            palletCartonMesh.setMatrixAt(palletCartonIdx++, dummy.matrix);
                        }
                    }
                }
                dummy.scale.set(1, 1, 1);

                instanceDataMap[palletMesh.uuid][palletIdx] = item;
                item.instanceId = palletIdx; item.meshUuid = palletMesh.uuid;
                palletIdx++;
            }
        } else {
            // ── Empty slot markers ──
            if (isPicking) {
                const slotW = CONFIG.rackWidth / 4;
                const xOff = item.subSlot * slotW + slotW / 2;
                const pX = x + xOff, pZ = z, pYR = y + 0.02;
                dummy.rotation.set(-Math.PI / 2, 0, 0);
                dummy.position.set(pX, pYR, pZ); dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                if (emptyBoxRectFillMesh) emptyBoxRectFillMesh.setMatrixAt(eBFI++, dummy.matrix);
                if (emptyBoxRectFrameMesh) {
                    const hx = 0.2, hz = 0.3, t = 0.025;
                    dummy.rotation.set(0, 0, 0);
                    dummy.scale.set(0.4, t, t); dummy.position.set(pX, pYR, pZ + hz); dummy.updateMatrix(); emptyBoxRectFrameMesh.setMatrixAt(eBFrI++, dummy.matrix);
                    dummy.scale.set(0.4, t, t); dummy.position.set(pX, pYR, pZ - hz); dummy.updateMatrix(); emptyBoxRectFrameMesh.setMatrixAt(eBFrI++, dummy.matrix);
                    dummy.scale.set(t, t, 0.6); dummy.position.set(pX + hx, pYR, pZ); dummy.updateMatrix(); emptyBoxRectFrameMesh.setMatrixAt(eBFrI++, dummy.matrix);
                    dummy.scale.set(t, t, 0.6); dummy.position.set(pX - hx, pYR, pZ); dummy.updateMatrix(); emptyBoxRectFrameMesh.setMatrixAt(eBFrI++, dummy.matrix);
                }
            } else {
                const pX = x + CONFIG.rackWidth / 2, pZ = z, pYR = y + 0.02;
                dummy.rotation.set(-Math.PI / 2, 0, 0);
                dummy.position.set(pX, pYR, pZ); dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                if (emptyPalletRectFillMesh) emptyPalletRectFillMesh.setMatrixAt(ePFI++, dummy.matrix);
                if (emptyPalletRectFrameMesh) {
                    const hx = 0.6, hz = 0.6, t = 0.025;
                    dummy.rotation.set(0, 0, 0);
                    dummy.scale.set(1.2, t, t); dummy.position.set(pX, pYR, pZ + hz); dummy.updateMatrix(); emptyPalletRectFrameMesh.setMatrixAt(ePFrI++, dummy.matrix);
                    dummy.scale.set(1.2, t, t); dummy.position.set(pX, pYR, pZ - hz); dummy.updateMatrix(); emptyPalletRectFrameMesh.setMatrixAt(ePFrI++, dummy.matrix);
                    dummy.scale.set(t, t, 1.2); dummy.position.set(pX + hx, pYR, pZ); dummy.updateMatrix(); emptyPalletRectFrameMesh.setMatrixAt(ePFrI++, dummy.matrix);
                    dummy.scale.set(t, t, 1.2); dummy.position.set(pX - hx, pYR, pZ); dummy.updateMatrix(); emptyPalletRectFrameMesh.setMatrixAt(ePFrI++, dummy.matrix);
                }
            }
        }
    });

    // ── Flag GPU upload ──
    [rackMesh, beamMesh, palletMesh, palletCartonMesh, palletBaseMesh, boxMesh].forEach(m => {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
    [emptyPalletRectFillMesh, emptyBoxRectFillMesh, emptyPalletRectFrameMesh, emptyBoxRectFrameMesh].forEach(m => {
        if (m) m.instanceMatrix.needsUpdate = true;
    });
}

// ─── Live Update Handler ──────────────────────────
// Hooked by warehouse.stream.js upon receiving an UPDATE event
window.handleUpdateDelta = (deltaData) => {
    console.log(`[Stream] Processing live update for ${deltaData.location_code}`);

    const item = wmsData.find(i => i.id === deltaData.location_code);

    // If we've never seen it, and it maps to the physical map, register it
    if (!item && PHYSICAL_MAP[deltaData.location_code]) {
        console.log(`[Stream] Late registering location: ${deltaData.location_code}`);
        // Memory resize for meshes is omitted for brevity in MVP/delta scope
        return;
    } else if (!item) {
        return;
    }

    item.occupied = deltaData.status === 'OCCUPIED';
    item.qty = deltaData.quantity;
    item.sku = deltaData.sku || 'EMPTY';

    const targetMesh = scene.getObjectByProperty('uuid', item.meshUuid);
    if (!targetMesh || item.instanceId === undefined) return;

    const updateColor = new THREE.Color();
    if (item.occupied) {
        updateColor.setHex(item.type === 'BOX' ? 0xc4956a : 0xd0d5dc);
    } else {
        updateColor.setHex(0x32ff6f);
    }

    targetMesh.setColorAt(item.instanceId, updateColor);
    targetMesh.instanceColor.needsUpdate = true;

    highlightPulseOnce(targetMesh, item.instanceId);
};

// Simple utility to flash an item temporarily
function highlightPulseOnce(mesh, instanceId) {
    const backupColor = new THREE.Color();
    mesh.getColorAt(instanceId, backupColor);

    const highlight = new THREE.Color(0xff0000); // Red flash
    mesh.setColorAt(instanceId, highlight);
    mesh.instanceColor.needsUpdate = true;

    setTimeout(() => {
        mesh.setColorAt(instanceId, backupColor);
        mesh.instanceColor.needsUpdate = true;
    }, 400); // revert after 400ms
}
