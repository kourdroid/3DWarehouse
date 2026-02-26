// ═══════════════════════════════════════════════════════
//  SMATCH WAREHOUSE — 3D DIGITAL TWIN (V3.0)
//  Phase 1: Visual Realism
//  Phase 2: Smart Interaction
//  Phase 3: Polish & Atmosphere
// ═══════════════════════════════════════════════════════

// --- CONFIGURATION ---
const CONFIG = {
    aisles: 6,
    baysPerAisle: 12,
    levels: 6,
    rackDepth: 1.6,
    rackWidth: 2.8,
    aisleWidth: 3.5,
    levelHeight: 1.8,
    palletZoneLimit: 3,
    palletBaseHeight: 0.15,
    palletBaseWidth: 1.3,
    palletBaseDepth: 1.3,
    wallHeight: 14,
    wallPadding: 4,
};

const WAREHOUSE = {
    get width() { return CONFIG.baysPerAisle * CONFIG.rackWidth + CONFIG.wallPadding * 2; },
    get depth() { return CONFIG.aisles * (CONFIG.rackDepth + CONFIG.aisleWidth) + CONFIG.wallPadding; },
    get height() { return CONFIG.wallHeight; },
    get originX() { return -CONFIG.wallPadding; },
    get originZ() { return -CONFIG.aisleWidth; },
};

const ZONE_COLORS = {
    PALLET: 0x2563eb,
    PICKING: 0xf59e0b,
};

// --- THREE.JS GLOBALS ---
let scene, camera, renderer, controls, raycaster, mouse;
let instanceDataMap = {};

// Interaction
let highlightState = { mesh: null, instanceId: null, originalColor: null };
let selectedItem = null; // Click-locked item
let pulseTime = 0;

// Instanced Meshes
let rackMesh, beamMesh, palletMesh, boxMesh, palletBaseMesh, palletCartonMesh;
let emptyPalletRectFillMesh, emptyBoxRectFillMesh;
let emptyPalletRectFrameMesh, emptyBoxRectFrameMesh;

// Particles (Phase 3)
let dustParticles;

// Occupation Badges (sprites per aisle)
let aisleOccBadges = [];

// Helpers
let pickPathLine = null;
const dummy = new THREE.Object3D();
const color = new THREE.Color();

// Data
let wmsData = [];
let itemLookup = {};

// Camera Animation
let isAnimatingCamera = false;
let cameraTargetPos = new THREE.Vector3();
let cameraTargetLookAt = new THREE.Vector3();

// Zone visibility state
let zoneVisibility = { PALLET: true, PICKING: true, EMPTY: true };

// Loading
const loader = {
    bar: null, status: null, screen: null,
    update(pct, msg) {
        if (this.bar) this.bar.style.width = pct + '%';
        if (this.status) this.status.textContent = msg;
    },
    finish() {
        this.update(100, 'Warehouse ready.');
        setTimeout(() => { if (this.screen) this.screen.classList.add('fade-out'); }, 400);
    }
};

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
function init() {
    loader.bar = document.getElementById('loader-bar');
    loader.status = document.getElementById('loader-status');
    loader.screen = document.getElementById('loading-screen');
    loader.update(5, 'Creating scene...');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x12151a);
    scene.fog = new THREE.FogExp2(0x12151a, 0.012);

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.set(-15, 22, 35);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    loader.update(15, 'Setting up lighting...');

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x111111, 0.5);
    scene.add(hemiLight);

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

    const fillLight = new THREE.DirectionalLight(0xaaccff, 0.3);
    fillLight.position.set(30, 20, 30);
    scene.add(fillLight);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 3;
    controls.maxDistance = 120;

    loader.update(25, 'Generating WMS data...');
    generateWMSData();

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

    // Interaction listeners
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onClick);
    window.addEventListener('resize', onWindowResize);

    // Search autocomplete
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', onSearchInput);
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
    searchInput.addEventListener('blur', () => {
        setTimeout(() => hideSuggestions(), 150);
    });

    loader.finish();
}

// ═══════════════════════════════════════════════════════
//  WMS DATA GENERATION
// ═══════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════
//  WAREHOUSE ENVELOPE
// ═══════════════════════════════════════════════════════
function createWarehouseEnvelope() {
    const W = WAREHOUSE.width, D = WAREHOUSE.depth, H = WAREHOUSE.height;
    const oX = WAREHOUSE.originX, oZ = WAREHOUSE.originZ;

    const floorGeo = new THREE.PlaneGeometry(W + 20, D + 20);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.92, metalness: 0.05 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(oX + W / 2, 0, oZ + D / 2);
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(Math.max(W, D) + 20, 80, 0x222528, 0x1a1d21);
    grid.position.set(oX + W / 2, 0.01, oZ + D / 2);
    scene.add(grid);

    const wallMat = new THREE.MeshStandardMaterial({
        color: 0x1a1d22, roughness: 0.95, transparent: true, opacity: 0.6, side: THREE.DoubleSide
    });

    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(W + 10, H), wallMat);
    backWall.position.set(oX + W / 2, H / 2, oZ + D + 3);
    scene.add(backWall);

    const sideWallGeo = new THREE.PlaneGeometry(D + 10, H);
    const leftWall = new THREE.Mesh(sideWallGeo, wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(oX - 3, H / 2, oZ + D / 2);
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(oX + W + 3, H / 2, oZ + D / 2);
    scene.add(rightWall);

    const ceilingMat = new THREE.MeshStandardMaterial({
        color: 0x151820, roughness: 1.0, transparent: true, opacity: 0.3, side: THREE.DoubleSide
    });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W + 10, D + 10), ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(oX + W / 2, H, oZ + D / 2);
    scene.add(ceiling);
}

// ═══════════════════════════════════════════════════════
//  AISLE FLOOR MARKINGS
// ═══════════════════════════════════════════════════════
function createAisleMarkings() {
    const stripeMat = new THREE.MeshBasicMaterial({
        color: 0xFFC30D, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide
    });
    const zoneFillMat = (c) => new THREE.MeshBasicMaterial({
        color: c, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide
    });
    const dashMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide
    });

    const aisleLen = CONFIG.baysPerAisle * CONFIG.rackWidth;
    const sw = 0.08;

    for (let a = 0; a < CONFIG.aisles; a++) {
        const z = a * (CONFIG.rackDepth + CONFIG.aisleWidth);
        const ac = z + CONFIG.rackDepth / 2 + CONFIG.aisleWidth / 2;
        const isPick = a >= CONFIG.palletZoneLimit;

        // Zone fill
        const zf = new THREE.Mesh(
            new THREE.PlaneGeometry(aisleLen, CONFIG.aisleWidth - 0.5),
            zoneFillMat(isPick ? ZONE_COLORS.PICKING : ZONE_COLORS.PALLET)
        );
        zf.rotation.x = -Math.PI / 2; zf.position.set(aisleLen / 2, 0.015, ac);
        scene.add(zf);

        // Yellow edge stripes
        const stripeGeo = new THREE.PlaneGeometry(aisleLen + 2, sw);
        const ls = new THREE.Mesh(stripeGeo, stripeMat);
        ls.rotation.x = -Math.PI / 2; ls.position.set(aisleLen / 2, 0.02, z + CONFIG.rackDepth + 0.2);
        scene.add(ls);
        const rs = new THREE.Mesh(stripeGeo, stripeMat);
        rs.rotation.x = -Math.PI / 2; rs.position.set(aisleLen / 2, 0.02, z + CONFIG.rackDepth + CONFIG.aisleWidth - 0.2);
        scene.add(rs);

        // Dashed center
        const dashGeo = new THREE.PlaneGeometry(1.2, sw * 0.6);
        for (let dx = 0; dx < aisleLen; dx += 2) {
            const dash = new THREE.Mesh(dashGeo, dashMat);
            dash.rotation.x = -Math.PI / 2; dash.position.set(dx + 0.6, 0.02, ac);
            scene.add(dash);
        }
    }
}

// ═══════════════════════════════════════════════════════
//  AISLE LABELS (Clickable Sprites)
// ═══════════════════════════════════════════════════════
let aisleSprites = []; // Store for click detection

function createAisleLabels() {
    for (let a = 0; a < CONFIG.aisles; a++) {
        const z = a * (CONFIG.rackDepth + CONFIG.aisleWidth);
        const ac = z + CONFIG.rackDepth / 2 + CONFIG.aisleWidth / 2;
        const isPick = a >= CONFIG.palletZoneLimit;
        const label = `AISLE ${a + 1}`;
        const sub = isPick ? 'PICKING' : 'PALLET';
        const accent = isPick ? '#f59e0b' : '#2563eb';

        const sp1 = makeTextSprite(label, sub, accent);
        sp1.position.set(-2.5, 1.8, ac);
        sp1.scale.set(3.5, 1.8, 1);
        sp1.userData = { aisleIndex: a };
        scene.add(sp1);
        aisleSprites.push(sp1);

        const sp2 = makeTextSprite(label, sub, accent);
        sp2.position.set(CONFIG.baysPerAisle * CONFIG.rackWidth + 2, 1.8, ac);
        sp2.scale.set(3.5, 1.8, 1);
        sp2.userData = { aisleIndex: a };
        scene.add(sp2);
        aisleSprites.push(sp2);
    }
}

function makeTextSprite(text, subText, accentColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(11, 14, 17, 0.75)';
    ctx.beginPath(); ctx.roundRect(20, 20, 472, 216, 8); ctx.fill();

    ctx.fillStyle = accentColor;
    ctx.fillRect(20, 20, 6, 216);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 266, 105);

    ctx.fillStyle = accentColor;
    ctx.font = '32px monospace';
    ctx.fillText(subText, 266, 175);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
}

// ═══════════════════════════════════════════════════════
//  OCCUPATION BADGES (floating % above each aisle)
// ═══════════════════════════════════════════════════════
function createOccupationBadges() {
    for (let a = 0; a < CONFIG.aisles; a++) {
        const aisleItems = wmsData.filter(d => d.aisle === a);
        const occupied = aisleItems.filter(d => d.occupied).length;
        const pct = Math.round(occupied / aisleItems.length * 100);

        const z = a * (CONFIG.rackDepth + CONFIG.aisleWidth);
        const ac = z + CONFIG.rackDepth / 2 + CONFIG.aisleWidth / 2;
        const midX = (CONFIG.baysPerAisle * CONFIG.rackWidth) / 2;

        const badge = makeOccBadge(pct);
        badge.position.set(midX, CONFIG.levels * CONFIG.levelHeight + 1.5, ac);
        badge.scale.set(2.8, 1.2, 1);
        scene.add(badge);
        aisleOccBadges.push(badge);
    }
}

function makeOccBadge(pct) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 96;
    const ctx = canvas.getContext('2d');

    // Background pill
    ctx.fillStyle = 'rgba(11, 14, 17, 0.8)';
    ctx.beginPath(); ctx.roundRect(8, 8, 240, 80, 12); ctx.fill();

    // Bar track
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.roundRect(20, 56, 216, 8, 4); ctx.fill();

    // Bar fill
    const barColor = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#22c55e';
    ctx.fillStyle = barColor;
    ctx.beginPath(); ctx.roundRect(20, 56, 216 * (pct / 100), 8, 4); ctx.fill();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${pct}%`, 128, 35);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
}

// ═══════════════════════════════════════════════════════
//  DUST PARTICLES (Phase 3 — Atmosphere)
// ═══════════════════════════════════════════════════════
function createDustParticles() {
    const count = 500;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const W = WAREHOUSE.width, D = WAREHOUSE.depth, H = WAREHOUSE.height;
    const oX = WAREHOUSE.originX, oZ = WAREHOUSE.originZ;

    for (let i = 0; i < count; i++) {
        positions[i * 3] = oX + Math.random() * W;
        positions[i * 3 + 1] = 1 + Math.random() * (H - 2);
        positions[i * 3 + 2] = oZ + Math.random() * D;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
        color: 0xaabbcc,
        size: 0.06,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
    });

    dustParticles = new THREE.Points(geo, mat);
    scene.add(dustParticles);
}

// ═══════════════════════════════════════════════════════
//  INSTANCED WAREHOUSE
// ═══════════════════════════════════════════════════════
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

    // Geometries
    const uprightGeo = new THREE.BoxGeometry(0.08, CONFIG.levels * CONFIG.levelHeight, 0.08);
    const beamGeo = new THREE.BoxGeometry(CONFIG.rackWidth, 0.10, 0.08);
    const palletGoodsGeo = new THREE.BoxGeometry(1.1, 0.85, 1.1);
    const palletCartonGeo = new THREE.BoxGeometry(0.35, 0.28, 0.35);
    const palletBaseGeo = new THREE.BoxGeometry(CONFIG.palletBaseWidth, CONFIG.palletBaseHeight, CONFIG.palletBaseDepth);
    const boxGeo = new THREE.BoxGeometry(0.38, 0.28, 0.55);
    const palletRectGeo = new THREE.PlaneGeometry(1.2, 1.2);
    const boxRectGeo = new THREE.PlaneGeometry(0.4, 0.6);
    const edgeGeo = new THREE.BoxGeometry(1, 1, 1);

    // Materials
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x3a4555, roughness: 0.35, metalness: 0.65 });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0xffc30d, roughness: 0.6, metalness: 0.15 });
    const shrinkWrapMat = new THREE.MeshStandardMaterial({ color: 0xd8dde3, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.88 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.85 });
    const cardboardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78 });
    const rectFillMat = new THREE.MeshBasicMaterial({ color: 0x32ff6f, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
    const rectEdgeMat = new THREE.MeshBasicMaterial({ color: 0x00ff66, transparent: true, opacity: 0.9 });

    // Instanced Meshes
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

        // Rack structure
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

        // Goods
        if (item.occupied) {
            if (isPicking) {
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
                const pX = x + CONFIG.rackWidth / 2, pZ = z;
                const baseY = y + CONFIG.palletBaseHeight / 2 + 0.02;
                dummy.position.set(pX, baseY, pZ);
                dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0);
                dummy.updateMatrix();
                palletBaseMesh.setMatrixAt(palletBaseIdx, dummy.matrix);
                color.setHex(0x8B6914);
                palletBaseMesh.setColorAt(palletBaseIdx, color);
                palletBaseIdx++;

                const pY = baseY + CONFIG.palletBaseHeight / 2 + 0.85 / 2;
                dummy.position.set(pX, pY, pZ);
                item.worldPos = { x: pX, y: pY, z: pZ };
                dummy.updateMatrix();
                palletMesh.setMatrixAt(palletIdx, dummy.matrix);
                color.setHex(0xd0d5dc);
                palletMesh.setColorAt(palletIdx, color);

                // Instanced cartons inside the wrap (3x3 grid, 3 layers = 27 cartons)
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
            // Empty markers
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

    // Flag GPU upload
    [rackMesh, beamMesh, palletMesh, palletCartonMesh, palletBaseMesh, boxMesh].forEach(m => {
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
    [emptyPalletRectFillMesh, emptyBoxRectFillMesh, emptyPalletRectFrameMesh, emptyBoxRectFrameMesh].forEach(m => {
        if (m) m.instanceMatrix.needsUpdate = true;
    });
}

// ═══════════════════════════════════════════════════════
//  SEARCH + AUTOCOMPLETE (Phase 2)
// ═══════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════
//  CLICK-TO-SELECT + DETAIL PANEL (Phase 2)
// ═══════════════════════════════════════════════════════
function onClick(event) {
    // Ignore clicks on UI elements
    if (event.target.closest('#ui-layer, #controls, #detail-panel')) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // Check aisle label clicks first (flythrough)
    const spriteHits = raycaster.intersectObjects(aisleSprites);
    if (spriteHits.length > 0) {
        const aisleIdx = spriteHits[0].object.userData.aisleIndex;
        flyIntoAisle(aisleIdx);
        return;
    }

    // Check goods clicks
    const hits = raycaster.intersectObjects([palletMesh, boxMesh]);
    if (hits.length > 0) {
        const hit = hits[0];
        const data = instanceDataMap[hit.object.uuid][hit.instanceId];
        if (data) selectItem(data);
    } else {
        deselectItem();
    }
}

function selectItem(item) {
    // Clear old highlight
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
    document.getElementById('dp-aisle').innerText = `Aisle ${item.aisle + 1}`;
    document.getElementById('dp-bay').innerText = `Bay ${item.bay + 1}`;
    document.getElementById('dp-level').innerText = `Level ${item.level}`;
    document.getElementById('dp-sku').innerText = item.sku;
    document.getElementById('dp-qty').innerText = item.qty;
    document.getElementById('dp-velocity').innerText = `${Math.round(item.velocity * 100)}% (${item.velocity > 0.7 ? 'HIGH' : item.velocity > 0.3 ? 'MED' : 'LOW'})`;
    document.getElementById('dp-status').innerText = item.occupied ? '● OCCUPIED' : '○ EMPTY';

    drawPickPath(item);
}

function drawPickPath(item) {
    if (pickPathLine) {
        scene.remove(pickPathLine);
        pickPathLine.geometry.dispose();
        pickPathLine.material.dispose();
        pickPathLine = null;
    }
    if (!item) return;

    // Aisle center Z
    const z = item.aisle * (CONFIG.rackDepth + CONFIG.aisleWidth);
    const ac = z + CONFIG.rackDepth / 2 + CONFIG.aisleWidth / 2;

    // Smooth points from corner of warehouse to the item
    const points = [
        new THREE.Vector3(-2, 0.1, -2),
        new THREE.Vector3(-2, 0.1, ac - 1.5),
        new THREE.Vector3(-0.5, 0.1, ac),
        new THREE.Vector3(item.worldPos.x, 0.1, ac),
    ];

    // If it's on a shelf, draw a vertical line up to it? No, stick to floor.
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.1);
    const geo = new THREE.TubeGeometry(curve, 100, 0.08, 8, false);
    const mat = new THREE.MeshBasicMaterial({ color: 0x32ff6f, transparent: true, opacity: 0.8 });

    pickPathLine = new THREE.Mesh(geo, mat);
    scene.add(pickPathLine);
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

// ═══════════════════════════════════════════════════════
//  AISLE FLYTHROUGH (Phase 2)
// ═══════════════════════════════════════════════════════
function flyIntoAisle(aisleIdx) {
    const z = aisleIdx * (CONFIG.rackDepth + CONFIG.aisleWidth);
    const ac = z + CONFIG.rackDepth / 2 + CONFIG.aisleWidth / 2;
    const midX = (CONFIG.baysPerAisle * CONFIG.rackWidth) / 2;

    // Position camera at the start of the aisle, slightly elevated and offset
    // so OrbitControls still have a healthy radius to orbit around
    cameraTargetPos.set(-2, 5, ac + 3);
    cameraTargetLookAt.set(midX, 2, ac);
    isAnimatingCamera = true;
}

function resetView() {
    cameraTargetPos.set(-15, 22, 35);
    cameraTargetLookAt.set(
        (CONFIG.baysPerAisle * CONFIG.rackWidth) / 2,
        2,
        (CONFIG.aisles * (CONFIG.rackDepth + CONFIG.aisleWidth)) / 2
    );
    isAnimatingCamera = true;
    deselectItem();
}

// ═══════════════════════════════════════════════════════
//  ZONE FILTERING (Phase 2)
// ═══════════════════════════════════════════════════════
function toggleZoneFilter(checkbox) {
    const zone = checkbox.dataset.zone;
    zoneVisibility[zone] = checkbox.checked;
    applyZoneVisibility();
}

function toggleEmptySlots(checkbox) {
    zoneVisibility.EMPTY = checkbox.checked;
    applyZoneVisibility();
}

function applyZoneVisibility() {
    // Pallets (PALLET zone)
    for (const [id, data] of Object.entries(instanceDataMap[palletMesh.uuid])) {
        const idx = parseInt(id);
        palletMesh.getMatrixAt(idx, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

        if (!zoneVisibility.PALLET) {
            dummy.scale.set(0, 0, 0);
        } else {
            dummy.scale.set(1, 1, 1);
        }
        dummy.updateMatrix();
        palletMesh.setMatrixAt(idx, dummy.matrix);
    }

    // Boxes (PICKING zone)
    for (const [id, data] of Object.entries(instanceDataMap[boxMesh.uuid])) {
        const idx = parseInt(id);
        boxMesh.getMatrixAt(idx, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

        if (!zoneVisibility.PICKING) {
            dummy.scale.set(0, 0, 0);
        } else {
            dummy.scale.set(1, 1, 1);
        }
        dummy.updateMatrix();
        boxMesh.setMatrixAt(idx, dummy.matrix);
    }

    palletMesh.instanceMatrix.needsUpdate = true;
    boxMesh.instanceMatrix.needsUpdate = true;

    // Pallet bases
    if (palletBaseMesh) {
        palletBaseMesh.visible = zoneVisibility.PALLET;
    }

    // Empty slots
    if (emptyPalletRectFillMesh) emptyPalletRectFillMesh.visible = zoneVisibility.EMPTY && zoneVisibility.PALLET;
    if (emptyBoxRectFillMesh) emptyBoxRectFillMesh.visible = zoneVisibility.EMPTY && zoneVisibility.PICKING;
    if (emptyPalletRectFrameMesh) emptyPalletRectFrameMesh.visible = zoneVisibility.EMPTY && zoneVisibility.PALLET;
    if (emptyBoxRectFrameMesh) emptyBoxRectFrameMesh.visible = zoneVisibility.EMPTY && zoneVisibility.PICKING;
}

// ═══════════════════════════════════════════════════════
//  MOUSE HOVER (lightweight tooltip)
// ═══════════════════════════════════════════════════════
function onMouseMove(event) {
    event.preventDefault();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    if (isAnimatingCamera) return;

    raycaster.setFromCamera(mouse, camera);
    const intersection = raycaster.intersectObjects([palletMesh, boxMesh]);
    const tooltip = document.getElementById('tooltip');

    if (intersection.length > 0) {
        const hit = intersection[0];
        const data = instanceDataMap[hit.object.uuid][hit.instanceId];
        if (data) {
            tooltip.style.display = 'block';
            tooltip.style.left = (event.clientX + 18) + 'px';
            tooltip.style.top = (event.clientY + 18) + 'px';
            tooltip.style.transform = 'none';
            document.getElementById('tt-id').innerText = data.id;
            document.getElementById('tt-sku').innerText = data.sku;
            document.getElementById('tt-qty').innerText = data.qty;
            document.body.style.cursor = 'pointer';
        }
    } else {
        tooltip.style.display = 'none';
        document.body.style.cursor = 'default';
    }
}

// ═══════════════════════════════════════════════════════
//  VIEW MODES
// ═══════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════
//  RESIZE & ANIMATE
// ═══════════════════════════════════════════════════════
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    // Camera fly-to
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

    // Animate dust particles (slow drift)
    if (dustParticles) {
        const pos = dustParticles.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            let yy = pos.getY(i);
            yy += 0.003;
            if (yy > WAREHOUSE.height - 1) yy = 1;
            pos.setY(i, yy);

            let xx = pos.getX(i) + (Math.sin(Date.now() * 0.0001 + i) * 0.002);
            pos.setX(i, xx);
        }
        pos.needsUpdate = true;
    }

    controls.update();
    renderer.render(scene, camera);
}

// ═══════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════
init();
animate();
