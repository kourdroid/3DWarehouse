// ═══════════════════════════════════════════════════════
//  SMATCH WAREHOUSE — INTERACTION LAYER
//  Handles all user input: mouse events, click-to-select,
//  hover tooltips, search/autocomplete, zone filtering,
//  view modes, aisle flythrough, pick path, camera reset.
// ═══════════════════════════════════════════════════════

function formatIndexedLabel(prefix, value) {
    return Number.isInteger(value) ? `${prefix} ${value + 1}` : 'N/A';
}

function formatVelocityLabel(value) {
    const normalized = Number.isFinite(value) ? value : 0;
    const level = normalized > 0.7 ? 'HIGH' : normalized > 0.3 ? 'MED' : 'LOW';
    return `${Math.round(normalized * 100)}% (${level})`;
}

function clearHoverState() {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
    document.body.style.cursor = 'default';
}

// ─── Mouse Hover (Tooltip) ──────────────────────────
function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    hoverPointer.screenX = event.clientX;
    hoverPointer.screenY = event.clientY;
    hoverPointer.dirty = true;

    if (isAnimatingCamera) {
        clearHoverState();
    }
}

function updateHoverInteraction() {
    if (isAnimatingCamera) {
        hoverPointer.dirty = false;
        clearHoverState();
        return;
    }

    const now = performance.now();
    if (!hoverPointer.dirty || now - lastHoverPickAt < 32) {
        return;
    }

    lastHoverPickAt = now;
    hoverPointer.dirty = false;
    raycaster.setFromCamera(mouse, camera);

    const intersection = raycaster.intersectObjects([palletMesh, boxMesh]);
    const tooltip = document.getElementById('tooltip');

    if (!intersection.length) {
        clearHoverState();
        return;
    }

    const hit = intersection[0];
    const data = instanceDataMap[hit.object.uuid][hit.instanceId];
    if (!data) {
        clearHoverState();
        return;
    }

    tooltip.style.display = 'block';
    tooltip.style.left = `${hoverPointer.screenX + 18}px`;
    tooltip.style.top = `${hoverPointer.screenY + 18}px`;
    tooltip.style.transform = 'none';
    document.getElementById('tt-id').innerText = data.id;
    document.getElementById('tt-sku').innerText = data.sku;
    document.getElementById('tt-qty').innerText = data.qty;
    document.body.style.cursor = 'pointer';
}

// ─── Click → Select or Flythrough ───────────────────
function onClick(event) {
    if (event.target.closest('#ui-layer, #controls, #detail-panel')) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // Aisle label → flythrough
    const spriteHits = raycaster.intersectObjects(aisleSprites);
    if (spriteHits.length > 0) {
        flyIntoAisle(spriteHits[0].object.userData.aisleIndex);
        return;
    }

    // Goods → detail panel
    const hits = raycaster.intersectObjects([palletMesh, boxMesh]);
    if (hits.length > 0) {
        const data = instanceDataMap[hits[0].object.uuid][hits[0].instanceId];
        if (data) selectItem(data);
    } else {
        deselectItem();
    }
}

// ─── Select / Deselect Item ─────────────────────────
function selectItem(item) {
    // Clear previous yellow highlight
    if (highlightState.mesh && highlightState.originalColor) {
        highlightState.mesh.setColorAt(highlightState.instanceId, highlightState.originalColor);
        highlightState.mesh.instanceColor.needsUpdate = true;
    }

    const mesh = item.type === 'BOX' ? boxMesh : palletMesh;
    const origColor = new THREE.Color();
    mesh.getColorAt(item.instanceId, origColor);
    highlightState = { mesh, instanceId: item.instanceId, originalColor: origColor };
    selectedItem = item;

    color.setHex(0xffc30d);
    mesh.setColorAt(item.instanceId, color);
    mesh.instanceColor.needsUpdate = true;

    // Populate detail panel
    const dp = document.getElementById('detail-panel');
    dp.classList.remove('hidden');
    document.getElementById('dp-id').innerText = item.id;
    document.getElementById('dp-type').innerText = item.type;
    document.getElementById('dp-zone').innerText = item.zone;
    document.getElementById('dp-aisle').innerText = formatIndexedLabel('Aisle', item.aisle);
    document.getElementById('dp-bay').innerText = formatIndexedLabel('Bay', item.bay);
    document.getElementById('dp-level').innerText = formatIndexedLabel('Level', item.level);
    document.getElementById('dp-sku').innerText = item.sku;
    document.getElementById('dp-qty').innerText = item.qty;
    document.getElementById('dp-velocity').innerText = formatVelocityLabel(item.velocity);
    document.getElementById('dp-status').innerText = item.occupied ? '● OCCUPIED' : `○ ${item.status || 'EMPTY'}`;

    drawPickPath(item);
}

function deselectItem() {
    if (highlightState.mesh && highlightState.originalColor) {
        highlightState.mesh.setColorAt(highlightState.instanceId, highlightState.originalColor);
        highlightState.mesh.instanceColor.needsUpdate = true;
    }
    highlightState = { mesh: null, instanceId: null, originalColor: null };
    selectedItem = null;
    document.getElementById('detail-panel').classList.add('hidden');
    drawPickPath(null);
}

function closeDetailPanel() { deselectItem(); }

// ─── Pick Path Visualization ─────────────────────────
function drawPickPath(item) {
    if (pickPathLine) {
        scene.remove(pickPathLine);
        pickPathLine.geometry.dispose();
        pickPathLine.material.dispose();
        pickPathLine = null;
    }
    if (!item) return;

    const hasAisleIndex = Number.isInteger(item.aisle);
    const ac = hasAisleIndex
        ? item.aisle * (CONFIG.rackDepth + CONFIG.aisleWidth) + CONFIG.rackDepth / 2 + CONFIG.aisleWidth / 2
        : item.worldPos.z;

    const points = [
        new THREE.Vector3(getWarehouseBounds().originX + 2, 0.1, getWarehouseBounds().originZ + 2),
        new THREE.Vector3(getWarehouseBounds().originX + 2, 0.1, ac - 1.5),
        new THREE.Vector3(item.worldPos.x - 1.2, 0.1, ac),
        new THREE.Vector3(item.worldPos.x, 0.1, ac),
    ];

    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.1);
    const geo = new THREE.TubeGeometry(curve, 100, 0.08, 8, false);
    const mat = new THREE.MeshBasicMaterial({ color: 0x32ff6f, transparent: true, opacity: 0.8 });
    pickPathLine = new THREE.Mesh(geo, mat);
    scene.add(pickPathLine);
}

// ─── Aisle Flythrough ────────────────────────────────
function flyIntoAisle(aisleIdx) {
    const z = aisleIdx * (CONFIG.rackDepth + CONFIG.aisleWidth);
    const ac = z + CONFIG.rackDepth / 2 + CONFIG.aisleWidth / 2;
    const midX = (CONFIG.baysPerAisle * CONFIG.rackWidth) / 2;
    cameraTargetPos.set(-2, 5, ac + 3);
    cameraTargetLookAt.set(midX, 2, ac);
    isAnimatingCamera = true;
}

function resetView() {
    const bounds = getWarehouseBounds();
    const centerX = bounds.originX + bounds.width / 2;
    const centerZ = bounds.originZ + bounds.depth / 2;
    cameraTargetPos.set(centerX - bounds.width * 0.65, Math.max(18, bounds.height * 0.9), centerZ + bounds.depth * 0.8);
    cameraTargetLookAt.set(centerX, 2, centerZ);
    isAnimatingCamera = true;
    deselectItem();
}

// ─── Search / Autocomplete ───────────────────────────
function onSearchInput(e) {
    const val = e.target.value.trim().toUpperCase();
    const sugBox = document.getElementById('search-suggestions');
    if (val.length < 2) { hideSuggestions(); return; }

    const matches = Object.keys(itemLookup)
        .filter(k => k.toUpperCase().includes(val))
        .slice(0, 8);

    if (matches.length === 0) { hideSuggestions(); return; }

    sugBox.innerHTML = matches.map(id => {
        const it = itemLookup[id];
        return `<div class="search-suggestion-item" onmousedown="selectSuggestion('${id}')">
            <span>${id}</span>
            <span class="sug-sku">${it.sku}</span>
        </div>`;
    }).join('');
    sugBox.classList.add('visible');
}

function selectSuggestion(id) {
    document.getElementById('search-input').value = id;
    hideSuggestions();
    performSearch();
}

function hideSuggestions() {
    document.getElementById('search-suggestions').classList.remove('visible');
}

function performSearch() {
    const input = document.getElementById('search-input');
    const id = input.value.trim();
    if (!id) return;
    hideSuggestions();

    const item = itemLookup[id] || itemLookup[Object.keys(itemLookup).find(k => k.toLowerCase().includes(id.toLowerCase()))];
    if (item) {
        cameraTargetLookAt.set(item.worldPos.x, item.worldPos.y, item.worldPos.z);
        cameraTargetPos.set(item.worldPos.x, item.worldPos.y + 2.5, item.worldPos.z + 7);
        isAnimatingCamera = true;
        selectItem(item);
        input.value = item.id;
    } else {
        alert('ID not found.');
    }
}

// ─── Zone Filtering ──────────────────────────────────
function toggleZoneFilter(checkbox) {
    zoneVisibility[checkbox.dataset.zone] = checkbox.checked;
    applyZoneVisibility();
}

function toggleEmptySlots(checkbox) {
    zoneVisibility.EMPTY = checkbox.checked;
    applyZoneVisibility();
}

function applyZoneVisibility() {
    if (palletMesh) palletMesh.visible = zoneVisibility.PALLET;
    if (palletBaseMesh) palletBaseMesh.visible = zoneVisibility.PALLET;
    if (palletCartonMesh) palletCartonMesh.visible = zoneVisibility.PALLET;
    if (boxMesh) boxMesh.visible = zoneVisibility.PICKING;
    if (emptyPalletRectFillMesh) emptyPalletRectFillMesh.visible = zoneVisibility.EMPTY && zoneVisibility.PALLET;
    if (emptyBoxRectFillMesh) emptyBoxRectFillMesh.visible = zoneVisibility.EMPTY && zoneVisibility.PICKING;
    if (emptyPalletRectFrameMesh) emptyPalletRectFrameMesh.visible = zoneVisibility.EMPTY && zoneVisibility.PALLET;
    if (emptyBoxRectFrameMesh) emptyBoxRectFrameMesh.visible = zoneVisibility.EMPTY && zoneVisibility.PICKING;
}

// ─── View Modes (Heatmap / Occupation) ──────────────
function viewMode(mode, btnEl) {
    document.querySelectorAll('#controls .btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    for (const [id, data] of Object.entries(instanceDataMap[palletMesh.uuid])) {
        const idx = parseInt(id);
        if (mode === 'heatmap') color.setHSL((1.0 - data.velocity) * 0.6, 1.0, 0.5);
        else if (mode === 'occupation') color.setHex(data.occupied ? 0x22c55e : 0xef4444);
        else color.setHex(0xd0d5dc);
        palletMesh.setColorAt(idx, color);
    }
    for (const [id, data] of Object.entries(instanceDataMap[boxMesh.uuid])) {
        const idx = parseInt(id);
        if (mode === 'heatmap') color.setHSL((1.0 - data.velocity) * 0.6, 1.0, 0.5);
        else if (mode === 'occupation') color.setHex(data.occupied ? 0x22c55e : 0xef4444);
        else color.setHex(0xc4956a);
        boxMesh.setColorAt(idx, color);
    }
    palletMesh.instanceColor.needsUpdate = true;
    boxMesh.instanceColor.needsUpdate = true;
}

// ─── Window Resize ───────────────────────────────────
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
