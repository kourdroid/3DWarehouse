// ═══════════════════════════════════════════════════════
//  SMATCH WAREHOUSE — SCENE CONSTRUCTION
//  Responsible for all static geometry that represents the
//  physical building: floor, walls, ceiling, aisle stripes,
//  text labels, occupation badges, and dust particles.
// ═══════════════════════════════════════════════════════

// ─── Warehouse Envelope ──────────────────────────────
function createWarehouseEnvelope() {
    const W = WAREHOUSE.width, D = WAREHOUSE.depth, H = WAREHOUSE.height;
    const oX = WAREHOUSE.originX, oZ = WAREHOUSE.originZ;

    // Floor
    const floorGeo = new THREE.PlaneGeometry(W + 20, D + 20);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.92, metalness: 0.05 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(oX + W / 2, 0, oZ + D / 2);
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid
    const grid = new THREE.GridHelper(Math.max(W, D) + 20, 80, 0x222528, 0x1a1d21);
    grid.position.set(oX + W / 2, 0.01, oZ + D / 2);
    scene.add(grid);

    // Walls
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

    // Ceiling
    const ceilingMat = new THREE.MeshStandardMaterial({
        color: 0x151820, roughness: 1.0, transparent: true, opacity: 0.3, side: THREE.DoubleSide
    });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W + 10, D + 10), ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(oX + W / 2, H, oZ + D / 2);
    scene.add(ceiling);
}

// ─── Aisle Floor Markings ────────────────────────────
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

        // Dashed center line
        const dashGeo = new THREE.PlaneGeometry(1.2, sw * 0.6);
        for (let dx = 0; dx < aisleLen; dx += 2) {
            const dash = new THREE.Mesh(dashGeo, dashMat);
            dash.rotation.x = -Math.PI / 2; dash.position.set(dx + 0.6, 0.02, ac);
            scene.add(dash);
        }
    }
}

// ─── Aisle Labels (Clickable Sprites) ───────────────
function createAisleLabels() {
    for (let a = 0; a < CONFIG.aisles; a++) {
        const z = a * (CONFIG.rackDepth + CONFIG.aisleWidth);
        const ac = z + CONFIG.rackDepth / 2 + CONFIG.aisleWidth / 2;
        const isPick = a >= CONFIG.palletZoneLimit;
        const label = `AISLE ${a + 1}`;
        const sub = isPick ? 'PICKING' : 'PALLET';
        const accent = isPick ? '#f59e0b' : '#2563eb';

        [
            { xPos: -2.5 },
            { xPos: CONFIG.baysPerAisle * CONFIG.rackWidth + 2 }
        ].forEach(({ xPos }) => {
            const sp = makeTextSprite(label, sub, accent);
            sp.position.set(xPos, 1.8, ac);
            sp.scale.set(3.5, 1.8, 1);
            sp.userData = { aisleIndex: a };
            scene.add(sp);
            aisleSprites.push(sp);
        });
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

// ─── Occupation Badges ──────────────────────────────
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

    ctx.fillStyle = 'rgba(11, 14, 17, 0.8)';
    ctx.beginPath(); ctx.roundRect(8, 8, 240, 80, 12); ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.roundRect(20, 56, 216, 8, 4); ctx.fill();

    const barColor = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#22c55e';
    ctx.fillStyle = barColor;
    ctx.beginPath(); ctx.roundRect(20, 56, 216 * (pct / 100), 8, 4); ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`${pct}%`, 128, 35);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
}

// ─── Dust Particles ─────────────────────────────────
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
        color: 0xaabbcc, size: 0.06,
        transparent: true, opacity: 0.35, depthWrite: false,
    });
    dustParticles = new THREE.Points(geo, mat);
    scene.add(dustParticles);
}
