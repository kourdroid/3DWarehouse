// ═══════════════════════════════════════════════════════
//  SMATCH WAREHOUSE — DATA & INSTANCED RENDERING
//  Generates mock WMS data and builds all InstancedMesh
//  objects for the rack structure and goods.
// ═══════════════════════════════════════════════════════

// ─── WMS Data Generation ────────────────────────────
// Future: Replace this with an API call to
//   GET /api/v1/warehouses/{id}/stock
function generateWMSData() {
    wmsData = [];
    itemLookup = {};
    let totalPositions = 0;
    let occupiedCount = 0;

    for (let a = 0; a < CONFIG.aisles; a++) {
        const isPickingZone = a >= CONFIG.palletZoneLimit;
        for (let b = 0; b < CONFIG.baysPerAisle; b++) {
            for (let l = 0; l < CONFIG.levels; l++) {
                const subSlots = isPickingZone ? 4 : 1;
                for (let s = 0; s < subSlots; s++) {
                    totalPositions++;
                    const occupied = Math.random() > 0.25;
                    if (occupied) occupiedCount++;
                    const id = `A${a}-B${b}-L${l}-${s}`;
                    const item = {
                        aisle: a, bay: b, level: l, subSlot: s,
                        type: isPickingZone ? 'BOX' : 'PALLET',
                        zone: isPickingZone ? 'PICKING' : 'PALLET',
                        occupied,
                        id,
                        sku: occupied ? `SKU-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}` : 'EMPTY',
                        velocity: Math.random(),
                        qty: occupied ? Math.floor(Math.random() * 50) + 1 : 0,
                        worldPos: { x: 0, y: 0, z: 0 },
                    };
                    wmsData.push(item);
                    if (occupied) itemLookup[id] = item;
                }
            }
        }
    }

    document.getElementById('stat-total').innerText = totalPositions.toLocaleString();
    document.getElementById('stat-occupied').innerText =
        `${occupiedCount.toLocaleString()} (${Math.round(occupiedCount / totalPositions * 100)}%)`;
}

// ─── Instanced Warehouse ────────────────────────────
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
        const { aisle: a, bay: b, level: l } = item;
        const z = a * (CONFIG.rackDepth + CONFIG.aisleWidth);
        const x = b * CONFIG.rackWidth;
        const y = l * CONFIG.levelHeight + 0.2;
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
