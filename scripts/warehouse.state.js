// ═══════════════════════════════════════════════════════
//  SMATCH WAREHOUSE — GLOBAL STATE
//  All mutable runtime variables live here. Modules read
//  and write to these via the shared window scope.
//  NOTE: Migrating to ES Modules (import/export) is
//  planned for Phase 6 (API integration).
// ═══════════════════════════════════════════════════════

// Three.js core objects
let scene, camera, renderer, controls, raycaster, mouse;

// Instanced mesh registry — maps mesh UUID to { instanceId: itemData }
let instanceDataMap = {};

// Interaction state
let highlightState = { mesh: null, instanceId: null, originalColor: null };
let selectedItem = null;
let pulseTime = 0;

// Instanced Meshes
let rackMesh, beamMesh, palletMesh, boxMesh, palletBaseMesh, palletCartonMesh;
let emptyPalletRectFillMesh, emptyBoxRectFillMesh;
let emptyPalletRectFrameMesh, emptyBoxRectFrameMesh;

// Particles
let dustParticles;

// Occupation Badges (sprites per aisle)
let aisleOccBadges = [];

// Aisle sprites (for flythrough click detection)
let aisleSprites = [];

// Pick Path Line
let pickPathLine = null;

// Three.js helpers (shared across modules)
const dummy = new THREE.Object3D();
const color = new THREE.Color();

// WMS Data
let wmsData = [];
let itemLookup = {};

// Camera Animation
let isAnimatingCamera = false;
let cameraTargetPos = new THREE.Vector3();
let cameraTargetLookAt = new THREE.Vector3();

// Zone visibility state
let zoneVisibility = { PALLET: true, PICKING: true, EMPTY: true };

// Loading screen helper
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
