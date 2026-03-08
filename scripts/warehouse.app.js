// ═══════════════════════════════════════════════════════
//  SMATCH WAREHOUSE — APP BOOT
//  Initializes Three.js, wires up all subsystems,
//  and starts the render loop. This is the entry point.
// ═══════════════════════════════════════════════════════

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
    controls.maxDistance = 120;

    loader.update(25, 'Connecting to WebSocket Stream...');

    // Setup stream handlers
    window.handleSnapshot = (snapshotData) => {
        loader.update(30, 'Receiving initial warehouse state...');
        // Set WMS Data from the snapshot's inventory state
        wmsData = snapshotData.inventory_state.map(item => ({
            id: item.location_code,
            sku: item.sku || 'EMPTY',
            qty: item.quantity,
            occupied: item.status === 'OCCUPIED',
            type: 'PALLET', // In full version, mapped from DB schema
            zone: 'PALLET', // In full version, mapped from DB schema
            worldPos: { x: 0, y: 0, z: 0 },
            ...item
        }));

        // Mock remaining needed layout parsing for the current legacy envelope builder
        // The proper setup relies on the physical dimensions provided in snapshotData.layout

        loader.update(40, 'Building warehouse envelope...');
        createWarehouseEnvelope();

        loader.update(55, 'Placing racks and goods...');
        createInstancedWarehouse();

        loader.update(70, 'Painting aisle markings...');
        createAisleMarkings();

        loader.update(80, 'Adding aisle labels...');
        createAisleLabels();

        loader.update(85, 'Creating occupation badges...');
        createOccupationBadges();

        loader.update(90, 'Adding atmosphere...');
        createDustParticles();

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

    // Dust particle drift
    if (dustParticles) {
        const pos = dustParticles.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            let yy = pos.getY(i) + 0.003;
            if (yy > WAREHOUSE.height - 1) yy = 1;
            pos.setY(i, yy);
            pos.setX(i, pos.getX(i) + (Math.sin(Date.now() * 0.0001 + i) * 0.002));
        }
        pos.needsUpdate = true;
    }

    controls.update();
    renderer.render(scene, camera);
}

// ─── Boot ────────────────────────────────────────────
init();
// animate is now called after handleSnapshot establishes the data
