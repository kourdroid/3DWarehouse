// ═══════════════════════════════════════════════════════
//  SMATCH WAREHOUSE — APP BOOT
//  Initializes Three.js, wires up all subsystems,
//  and starts the render loop. This is the entry point.
// ═══════════════════════════════════════════════════════

function parseLocationCode(locationCode) {
    if (!locationCode) {
        return { aisle: null, bay: null, level: null, subSlot: 0 };
    }

    const rackMatch = locationCode.match(/A(\d+)-B(\d+)-L(\d+)(?:-(\d+)|-P(\d+))?/i);
    if (!rackMatch) {
        return { aisle: null, bay: null, level: null, subSlot: 0 };
    }

    return {
        aisle: Number.parseInt(rackMatch[1], 10),
        bay: Number.parseInt(rackMatch[2], 10),
        level: Number.parseInt(rackMatch[3], 10),
        subSlot: Number.parseInt(rackMatch[4] || rackMatch[5] || '0', 10),
    };
}

function normalizeInventoryItem(rawItem) {
    const parsed = parseLocationCode(rawItem.location_code || rawItem.id);
    const status = rawItem.status || 'EMPTY';
    const occupied = status === 'OCCUPIED' || Number(rawItem.quantity) > 0;
    const quantity = Number.isFinite(Number(rawItem.quantity)) ? Number(rawItem.quantity) : 0;
    const velocity = Number.isFinite(Number(rawItem.velocity))
        ? Number(rawItem.velocity)
        : Math.max(0, Math.min(1, (Number(rawItem.fill_percentage) || quantity) / 100));
    const type = rawItem.storage_kind || rawItem.type || rawItem.unit_type || (parsed.subSlot > 0 ? 'BOX' : 'PALLET');
    const zone = rawItem.zone || rawItem.zone_type || (type === 'BOX' ? 'PICKING' : 'PALLET');
    const hasResolvedPosition = ['x_meters', 'y_meters', 'z_meters'].every((key) => Number.isFinite(Number(rawItem[key])));

    return {
        ...rawItem,
        id: rawItem.location_code || rawItem.id,
        sku: rawItem.sku || 'EMPTY',
        qty: quantity,
        status,
        occupied,
        type,
        zone,
        aisle: Number.isInteger(parsed.aisle) ? parsed.aisle : null,
        bay: Number.isInteger(parsed.bay) ? parsed.bay : null,
        level: Number.isInteger(parsed.level) ? parsed.level : null,
        subSlot: Number.isInteger(parsed.subSlot) ? parsed.subSlot : 0,
        velocity,
        widthMeters: Number(rawItem.width_meters) || CONFIG.palletBaseWidth,
        depthMeters: Number(rawItem.depth_meters) || CONFIG.palletBaseDepth,
        heightMeters: Number(rawItem.height_meters) || 1.2,
        hasResolvedPosition,
        worldPos: hasResolvedPosition
            ? { x: Number(rawItem.x_meters), y: Number(rawItem.y_meters), z: Number(rawItem.z_meters) }
            : { x: 0, y: 0, z: 0 },
    };
}

function computeLayoutBounds(layout) {
    const bounds = {
        minX: Infinity,
        maxX: -Infinity,
        minZ: Infinity,
        maxZ: -Infinity,
    };

    if (!layout || !Array.isArray(layout.zones)) {
        return null;
    }

    for (const zone of layout.zones) {
        const zoneMinX = Number(zone.position_x_meters) || 0;
        const zoneMinZ = Number(zone.position_z_meters) || 0;
        const zoneMaxX = zoneMinX + (Number(zone.width_meters) || 0);
        const zoneMaxZ = zoneMinZ + (Number(zone.length_meters) || 0);
        bounds.minX = Math.min(bounds.minX, zoneMinX);
        bounds.maxX = Math.max(bounds.maxX, zoneMaxX);
        bounds.minZ = Math.min(bounds.minZ, zoneMinZ);
        bounds.maxZ = Math.max(bounds.maxZ, zoneMaxZ);
    }

    if (!Number.isFinite(bounds.minX)) {
        return null;
    }

    return {
        width: Math.max(bounds.maxX - bounds.minX + CONFIG.wallPadding * 2, 20),
        depth: Math.max(bounds.maxZ - bounds.minZ + CONFIG.wallPadding * 2, 20),
        height: CONFIG.wallHeight,
        originX: bounds.minX - CONFIG.wallPadding,
        originZ: bounds.minZ - CONFIG.wallPadding,
    };
}

function updateHudStats() {
    const totalPositions = wmsData.length;
    const occupiedCount = wmsData.filter(item => item.occupied).length;
    const totalEl = document.getElementById('stat-total');
    const occupiedEl = document.getElementById('stat-occupied');

    if (totalEl) {
        totalEl.innerText = totalPositions.toLocaleString();
    }
    if (occupiedEl) {
        const rate = totalPositions > 0 ? Math.round((occupiedCount / totalPositions) * 100) : 0;
        occupiedEl.innerText = `${occupiedCount.toLocaleString()} (${rate}%)`;
    }
}

function positionPresentationCamera() {
    const bounds = getWarehouseBounds();
    const centerX = bounds.originX + bounds.width / 2;
    const centerZ = bounds.originZ + bounds.depth / 2;

    controls.target.set(centerX, 2, centerZ);
    cameraTargetLookAt.set(centerX, 2, centerZ);
    camera.position.set(centerX - bounds.width * 0.65, Math.max(18, bounds.height * 0.9), centerZ + bounds.depth * 0.8);
    cameraTargetPos.copy(camera.position);
    controls.update();
}

function init() {
    loader.bar = document.getElementById('loader-bar');
    loader.status = document.getElementById('loader-status');
    loader.screen = document.getElementById('loading-screen');
    loader.update(5, 'Creating scene...');

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x12151a);
    scene.fog = new THREE.FogExp2(0x12151a, 0.012);

    // Camera
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.set(-15, 22, 35);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    loader.update(15, 'Setting up lighting...');

    // Hemisphere light
    scene.add(new THREE.HemisphereLight(0xddeeff, 0x111111, 0.5));

    // Main directional (shadow-casting)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(-20, 50, -20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 150;
    dirLight.shadow.bias = -0.0004;
    dirLight.shadow.radius = 4;
    const d = 60;
    dirLight.shadow.camera.left = -d; dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d; dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0xaaccff, 0.3);
    fillLight.position.set(30, 20, 30);
    scene.add(fillLight);

    // OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 3;
    controls.maxDistance = 110;
    controls.rotateSpeed = 0.75;
    controls.zoomSpeed = 1.05;
    controls.panSpeed = 0.9;
    controls.screenSpacePanning = true;

    loader.update(25, 'Connecting to WebSocket Stream...');

    // Setup stream handlers
    window.handleSnapshot = (snapshotData) => {
        loader.update(30, 'Receiving initial warehouse state...');
        clearWarehouseBoundsOverride();
        currentLayout = snapshotData.layout || null;
        wmsData = (snapshotData.inventory_state || []).map(normalizeInventoryItem);
        itemLookup = {};
        PHYSICAL_MAP = {};
        instanceDataMap = {};
        wmsData.forEach((item) => {
            itemLookup[item.id] = item;
        });
        updateHudStats();

        if (currentLayout) {
            const layoutBounds = computeLayoutBounds(currentLayout);
            if (layoutBounds) {
                setWarehouseBoundsOverride(layoutBounds);
            }
            loader.update(45, 'Building data-driven structure...');
            createWarehouseEnvelope();
            buildStructureFromLayout(currentLayout);
        } else if (wmsData.length > 0) {
            loader.update(40, 'Building legacy envelope...');
            createWarehouseEnvelope();
            loader.update(55, 'Placing legacy racks and goods...');
            createInstancedWarehouse();
        } else {
            loader.status.innerHTML = "<span style='color: #ef4444;'>No warehouse configured. Please seed the database.</span>";
            return;
        }

        if (!currentLayout) {
            loader.update(70, 'Painting aisle markings...');
            createAisleMarkings();

            loader.update(80, 'Adding aisle labels...');
            createAisleLabels();

            loader.update(85, 'Creating occupation badges...');
            createOccupationBadges();
        }

        loader.update(90, 'Adding atmosphere...');
        createDustParticles();

        positionPresentationCamera();

        loader.update(95, 'Setting up interactions...');

        // Event listeners
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('click', onClick);
        window.addEventListener('resize', onWindowResize);

        // Search autocomplete
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', onSearchInput);
        searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
        searchInput.addEventListener('blur', () => { setTimeout(() => hideSuggestions(), 150); });

        loader.finish();

        // Finalize boot loop
        animate();
    };

    // Replace synchronous mock WMS generation with async WebSocket call
    warehouseStream.connect();
}


// ─── Render / Animation Loop ─────────────────────────
function animate() {
    requestAnimationFrame(animate);
    dustAnimationTick++;

    // Smooth camera fly-to
    if (isAnimatingCamera) {
        camera.position.lerp(cameraTargetPos, 0.045);
        controls.target.lerp(cameraTargetLookAt, 0.045);
        if (camera.position.distanceTo(cameraTargetPos) < 0.1) isAnimatingCamera = false;
    }

    // Pulse highlight on selected item
    if (selectedItem && highlightState.mesh) {
        pulseTime += 0.08;
        const sine = (Math.sin(pulseTime) + 1) / 2;
        color.setHex(0xffc30d);
        color.lerp(new THREE.Color(0xffffff), sine * 0.4);
        highlightState.mesh.setColorAt(highlightState.instanceId, color);
        highlightState.mesh.instanceColor.needsUpdate = true;
    }

    if (typeof updateHoverInteraction === 'function') {
        updateHoverInteraction();
    }

    // Dust particle drift
    if (dustParticles && dustAnimationTick % 2 === 0) {
        const pos = dustParticles.geometry.attributes.position;
        const bounds = getWarehouseBounds();
        const driftTime = performance.now() * 0.00012;
        for (let i = 0; i < pos.count; i++) {
            let yy = pos.getY(i) + 0.003;
            if (yy > bounds.height - 1) yy = 1;
            pos.setY(i, yy);
            pos.setX(i, pos.getX(i) + (Math.sin(driftTime + i) * 0.0015));
        }
        pos.needsUpdate = true;
    }

    controls.update();
    renderer.render(scene, camera);
}

// ─── Boot ────────────────────────────────────────────
// init is called by main.js router
// animate is now called after handleSnapshot establishes the data
