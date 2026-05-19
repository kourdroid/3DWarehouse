
// --- CONFIGURATION ---
        const CONFIG = {
            aisles: 6,
            baysPerAisle: 12,
            levels: 6,
            // Dimensions
            rackDepth: 1.6,
            rackWidth: 2.8,
            aisleWidth: 3.5,
            levelHeight: 1.8,
            // Zone Definitions
            palletZoneLimit: 3 
        };

        // --- THREE.JS GLOBALS ---
        let scene, camera, renderer, controls, raycaster, mouse;
        let meshMap = {}; 
        let instanceDataMap = {}; 
        
        // Interaction Globals (Defined here to avoid TDZ ReferenceError)
        let highlightState = { mesh: null, instanceId: null, originalColor: new THREE.Color() };
        let pulseTime = 0;

        // InstancedMesh Containers
        let rackMesh, beamMesh, braceMesh, palletMesh, boxMesh, loadPalletMesh, boxPalletMesh, emptyPalletRectFillMesh, emptyBoxRectFillMesh, emptyPalletRectFrameMesh, emptyBoxRectFrameMesh; 
        let warehouseShellMaterials = [];
        let warehouseShellBounds = null;
        
        // Helper math objects
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();

        // Mock WMS Data
        let wmsData = [];
        let itemLookup = {}; // Quick lookup map for search

        // Animation State
        let isAnimatingCamera = false;
        let cameraTargetPos = new THREE.Vector3();
        let cameraTargetLookAt = new THREE.Vector3();

        // --- FUNCTIONS ---

        function init() {
            // 1. Scene Setup
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x15181b); // Slightly lighter for tone mapping
            scene.fog = new THREE.Fog(0x15181b, 20, 80); // Softer fog

            // 2. Camera
            camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
            camera.position.set(-30, 25, 30);

            // 3. Renderer (Enhanced for Soft Look)
            renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Soft shadows
            
            // TONE MAPPING - The secret to "Soft/Realistic" look
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.0;
            renderer.outputEncoding = THREE.sRGBEncoding;

            document.getElementById('canvas-container').appendChild(renderer.domElement);

            // 4. Lighting (Cinematic Soft Setup)
            
            // Hemisphere Light: Soft ambient gradient (Sky color vs Ground color)
            const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x222222, 0.6);
            scene.add(hemiLight);

            // Directional Light: The "Sun" or main warehouse light
            const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
            dirLight.position.set(-30, 60, -30);
            dirLight.castShadow = true;
            // Soften shadows
            dirLight.shadow.mapSize.width = 2048;
            dirLight.shadow.mapSize.height = 2048;
            dirLight.shadow.camera.near = 0.5;
            dirLight.shadow.camera.far = 200;
            dirLight.shadow.bias = -0.0005;
            dirLight.shadow.radius = 4; // Blurs shadow edges
            
            // Widen shadow camera coverage
            const d = 60;
            dirLight.shadow.camera.left = -d; dirLight.shadow.camera.right = d;
            dirLight.shadow.camera.top = d; dirLight.shadow.camera.bottom = -d;
            scene.add(dirLight);

            // 5. Controls
            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.maxPolarAngle = Math.PI / 2 - 0.02;

            // 6. Initialize Data & Geometry
            generateWMSData();
            createInstancedWarehouse();

            // 7. Listeners
            raycaster = new THREE.Raycaster();
            mouse = new THREE.Vector2();
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('resize', onWindowResize);
            
            // Add Enter key listener for search
            document.getElementById('search-input').addEventListener('keypress', function (e) {
                if (e.key === 'Enter') performSearch();
            });
        }

        function generateWMSData() {
            wmsData = [];
            itemLookup = {};
            let totalPositions = 0;

            for(let a=0; a<CONFIG.aisles; a++) {
                const isPickingZone = a >= CONFIG.palletZoneLimit;
                for(let b=0; b<CONFIG.baysPerAisle; b++) {
                    for(let l=0; l<CONFIG.levels; l++) {
                        const subSlots = isPickingZone ? 4 : 1;
                        for(let s=0; s<subSlots; s++) {
                            totalPositions++;
                            const occupied = Math.random() > 0.25;
                            const id = `A${a}-B${b}-L${l}-${s}`;
                            
                            const item = {
                                aisle: a, bay: b, level: l, subSlot: s,
                                type: isPickingZone ? 'BOX' : 'PALLET',
                                occupied: occupied,
                                id: id,
                                sku: occupied ? `SKU-${Math.floor(Math.random()*9999)}` : 'EMPTY',
                                velocity: Math.random(),
                                qty: occupied ? Math.floor(Math.random() * 50) + 1 : 0
                            };
                            wmsData.push(item);
                            if(occupied) itemLookup[id] = item; // Add to lookup map
                        }
                    }
                }
            }
            document.getElementById('stat-total').innerText = totalPositions.toLocaleString();
        }

        function getWarehouseLayout() {
            const width = CONFIG.baysPerAisle * CONFIG.rackWidth;
            const minZ = -CONFIG.rackDepth / 2;
            const maxZ = ((CONFIG.aisles - 1) * (CONFIG.rackDepth + CONFIG.aisleWidth)) + (CONFIG.rackDepth / 2);
            const depth = maxZ - minZ;
            const height = CONFIG.levels * CONFIG.levelHeight;

            return {
                width,
                depth,
                height,
                minX: 0,
                maxX: width,
                minZ,
                maxZ,
                centerX: width / 2,
                centerZ: minZ + (depth / 2)
            };
        }

        function setInstanceTransform(mesh, index, x, y, z, scaleX, scaleY, scaleZ, rotX = 0, rotY = 0, rotZ = 0) {
            dummy.position.set(x, y, z);
            dummy.scale.set(scaleX, scaleY, scaleZ);
            dummy.rotation.set(rotX, rotY, rotZ);
            dummy.updateMatrix();
            mesh.setMatrixAt(index, dummy.matrix);
        }

        function registerShellMaterial(material, baseOpacity) {
            material.transparent = true;
            material.opacity = baseOpacity;
            warehouseShellMaterials.push({ material, baseOpacity });
        }

        function updateWarehouseShellVisibility() {
            if (!warehouseShellBounds || warehouseShellMaterials.length === 0) return;

            const target = controls ? controls.target : camera.position;
            const isInExplorationZone =
                target.x >= warehouseShellBounds.minX &&
                target.x <= warehouseShellBounds.maxX &&
                target.z >= warehouseShellBounds.minZ &&
                target.z <= warehouseShellBounds.maxZ;

            const isCameraInsideShell =
                camera.position.x >= warehouseShellBounds.minX &&
                camera.position.x <= warehouseShellBounds.maxX &&
                camera.position.y <= warehouseShellBounds.maxY &&
                camera.position.z >= warehouseShellBounds.minZ &&
                camera.position.z <= warehouseShellBounds.maxZ;

            const targetOpacity = (isInExplorationZone || isCameraInsideShell) ? 0.04 : 0.9;

            warehouseShellMaterials.forEach(({ material, baseOpacity }) => {
                material.opacity += ((baseOpacity * targetOpacity) - material.opacity) * 0.14;
                material.depthWrite = material.opacity > 0.35;
                material.needsUpdate = true;
            });
        }

        function createWarehouseShell(layout) {
            const wallThickness = 0.35;
            const sidePadding = 5.5;
            const backPadding = 4.5;
            const ceilingY = layout.height + 1.2;
            const roomHeight = layout.height + 3.5;
            const roomDepth = layout.depth + (backPadding * 2);
            const wallMat = new THREE.MeshStandardMaterial({
                color: 0x242b31,
                roughness: 0.88,
                metalness: 0.08
            });
            const trimMat = new THREE.MeshStandardMaterial({
                color: 0x4e5a64,
                roughness: 0.55,
                metalness: 0.45
            });
            const ceilingMat = new THREE.MeshStandardMaterial({
                color: 0x303841,
                roughness: 0.82,
                metalness: 0.15
            });
            const glowMat = new THREE.MeshStandardMaterial({
                color: 0xf4e3b1,
                emissive: 0xf4ddb0,
                emissiveIntensity: 1.2,
                roughness: 0.45,
                metalness: 0.1
            });
            registerShellMaterial(wallMat, 0.92);
            registerShellMaterial(ceilingMat, 0.86);

            warehouseShellBounds = {
                minX: layout.minX - sidePadding + 0.8,
                maxX: layout.maxX + sidePadding - 0.8,
                minZ: layout.minZ - backPadding + 0.8,
                maxZ: layout.maxZ + backPadding - 0.8,
                maxY: roomHeight
            };

            const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, roomHeight, roomDepth), wallMat);
            leftWall.position.set(layout.minX - sidePadding, roomHeight / 2, layout.centerZ);
            leftWall.receiveShadow = true;
            scene.add(leftWall);

            const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, roomHeight, roomDepth), wallMat);
            rightWall.position.set(layout.maxX + sidePadding, roomHeight / 2, layout.centerZ);
            rightWall.receiveShadow = true;
            scene.add(rightWall);

            const backWall = new THREE.Mesh(new THREE.BoxGeometry(layout.width + (sidePadding * 2), roomHeight, wallThickness), wallMat);
            backWall.position.set(layout.centerX, roomHeight / 2, layout.minZ - backPadding);
            backWall.receiveShadow = true;
            scene.add(backWall);

            const ceiling = new THREE.Mesh(
                new THREE.PlaneGeometry(layout.width + (sidePadding * 2), roomDepth),
                ceilingMat
            );
            ceiling.rotation.x = Math.PI / 2;
            ceiling.position.set(layout.centerX, ceilingY, layout.centerZ);
            ceiling.receiveShadow = true;
            scene.add(ceiling);

            for (let i = 0; i < 3; i++) {
                const x = layout.minX + ((i + 0.5) * layout.width / 3);
                const support = new THREE.Mesh(new THREE.BoxGeometry(0.18, roomHeight, 0.18), trimMat);
                support.position.set(x, roomHeight / 2, layout.minZ - backPadding + 0.7);
                support.castShadow = true;
                support.receiveShadow = true;
                scene.add(support);
            }

            const stripXPositions = [
                layout.minX + (layout.width * 0.22),
                layout.centerX,
                layout.minX + (layout.width * 0.78)
            ];
            const lightCount = Math.max(CONFIG.aisles, 4);
            for (const x of stripXPositions) {
                for (let i = 0; i < lightCount; i++) {
                    const z = layout.minZ + 1 + (i * (layout.depth - 2) / Math.max(lightCount - 1, 1));
                    const lightPanel = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.08, 0.42), glowMat);
                    lightPanel.position.set(x, ceilingY - 0.12, z);
                    scene.add(lightPanel);

                    const pointLight = new THREE.PointLight(0xffefc2, 0.5, 16, 2);
                    pointLight.position.set(x, ceilingY - 0.45, z);
                    scene.add(pointLight);
                }
            }
        }

        function addFloorMarkings(layout) {
            const laneMat = new THREE.MeshStandardMaterial({
                color: 0xf0c63c,
                roughness: 0.7,
                metalness: 0.05
            });
            const safetyMat = new THREE.MeshStandardMaterial({
                color: 0x4fc3ff,
                roughness: 0.55,
                metalness: 0.1
            });

            for (let a = 0; a < CONFIG.aisles - 1; a++) {
                const laneZ = (a * (CONFIG.rackDepth + CONFIG.aisleWidth)) + (CONFIG.rackDepth / 2) + (CONFIG.aisleWidth / 2);
                const centerLine = new THREE.Mesh(new THREE.BoxGeometry(layout.width + 1.5, 0.02, 0.1), laneMat);
                centerLine.position.set(layout.centerX, 0.01, laneZ);
                centerLine.receiveShadow = true;
                scene.add(centerLine);
            }

            const frontSafetyLine = new THREE.Mesh(new THREE.BoxGeometry(layout.width + 2.5, 0.02, 0.12), safetyMat);
            frontSafetyLine.position.set(layout.centerX, 0.01, layout.maxZ + 1.2);
            frontSafetyLine.receiveShadow = true;
            scene.add(frontSafetyLine);
        }

        function createInstancedWarehouse() {
            const layout = getWarehouseLayout();
            const warehouseHeight = layout.height;
            const palletClusterCount = 3;
            const palletSpacing = 0.82;
            const palletOffsets = [-palletSpacing, 0, palletSpacing];
            const totalBays = CONFIG.aisles * CONFIG.baysPerAisle;
            const totalLevels = totalBays * CONFIG.levels;
            const maxPallets = totalLevels * palletClusterCount; 
            const maxBoxes = totalLevels * 4; 
            const braceCount = totalBays * 4;
            let emptyPalletCount = 0, emptyBoxCount = 0;
            for (const it of wmsData) {
                if (!it.occupied) {
                    if (it.type === 'BOX') emptyBoxCount++; else emptyPalletCount += palletClusterCount;
                }
            }

            // Geometries
            const uprightGeo = new THREE.BoxGeometry(0.1, warehouseHeight, 0.1);
            const beamGeo = new THREE.BoxGeometry(CONFIG.rackWidth, 0.12, 0.1); // Slightly thicker beams look better
            const braceGeo = new THREE.BoxGeometry(Math.sqrt((CONFIG.rackWidth * CONFIG.rackWidth) + (warehouseHeight * warehouseHeight)), 0.045, 0.045);
            const palletGeo = new THREE.BoxGeometry(0.68, 0.88, 1.02);
            const loadPalletGeo = new THREE.BoxGeometry(0.78, 0.12, 1.08);
            const boxPalletGeo = new THREE.BoxGeometry(0.52, 0.08, 0.68);
            const boxGeo = new THREE.BoxGeometry(0.4, 0.3, 0.6);

            // Materials - Enhanced for Tone Mapping
            const metalMat = new THREE.MeshStandardMaterial({ color: 0x4f6472, roughness: 0.32, metalness: 0.78 });
            const beamMat = new THREE.MeshStandardMaterial({ color: 0xffc30d, roughness: 0.55, metalness: 0.2 });
            const braceMat = new THREE.MeshStandardMaterial({ color: 0x7f8d99, roughness: 0.3, metalness: 0.85 });
            const goodsMat = new THREE.MeshStandardMaterial({ color: 0xf5f7fb, roughness: 0.72, metalness: 0.08 }); 
            const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.92, metalness: 0.04 });
            const rectFillMat = new THREE.MeshBasicMaterial({ color: 0x32ff6f, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
            const rectEdgeMat = new THREE.MeshBasicMaterial({ color: 0x00ff66, transparent: true, opacity: 1 });
            const edgeGeo = new THREE.BoxGeometry(1, 1, 1);
            const palletRectGeo = new THREE.PlaneGeometry(0.78, 1.08);
            const boxRectGeo = new THREE.PlaneGeometry(0.4, 0.6);

            // Instanced Meshes
            rackMesh = new THREE.InstancedMesh(uprightGeo, metalMat, totalBays * 2); 
            beamMesh = new THREE.InstancedMesh(beamGeo, beamMat, totalLevels * 2); 
            braceMesh = new THREE.InstancedMesh(braceGeo, braceMat, braceCount);
            palletMesh = new THREE.InstancedMesh(palletGeo, goodsMat, maxPallets); 
            boxMesh = new THREE.InstancedMesh(boxGeo, goodsMat, maxBoxes);
            loadPalletMesh = new THREE.InstancedMesh(loadPalletGeo, woodMat, maxPallets);
            boxPalletMesh = new THREE.InstancedMesh(boxPalletGeo, woodMat, maxBoxes);
            if (emptyPalletCount > 0) { emptyPalletRectFillMesh = new THREE.InstancedMesh(palletRectGeo, rectFillMat, emptyPalletCount); }
            if (emptyBoxCount > 0) { emptyBoxRectFillMesh = new THREE.InstancedMesh(boxRectGeo, rectFillMat, emptyBoxCount); }
            if (emptyPalletCount > 0) { emptyPalletRectFrameMesh = new THREE.InstancedMesh(edgeGeo, rectEdgeMat, emptyPalletCount * 4); }
            if (emptyBoxCount > 0) { emptyBoxRectFrameMesh = new THREE.InstancedMesh(edgeGeo, rectEdgeMat, emptyBoxCount * 4); }

            [rackMesh, beamMesh, braceMesh, palletMesh, boxMesh, loadPalletMesh, boxPalletMesh].forEach(m => {
                m.castShadow = true;
                m.receiveShadow = true;
                scene.add(m);
                if (m === palletMesh || m === boxMesh) {
                    instanceDataMap[m.uuid] = {};
                }
            });
            if (emptyPalletRectFillMesh) { emptyPalletRectFillMesh.castShadow = false; emptyPalletRectFillMesh.receiveShadow = false; scene.add(emptyPalletRectFillMesh); }
            if (emptyBoxRectFillMesh) { emptyBoxRectFillMesh.castShadow = false; emptyBoxRectFillMesh.receiveShadow = false; scene.add(emptyBoxRectFillMesh); }
            if (emptyPalletRectFrameMesh) { emptyPalletRectFrameMesh.castShadow = false; emptyPalletRectFrameMesh.receiveShadow = false; scene.add(emptyPalletRectFrameMesh); }
            if (emptyBoxRectFrameMesh) { emptyBoxRectFrameMesh.castShadow = false; emptyBoxRectFrameMesh.receiveShadow = false; scene.add(emptyBoxRectFrameMesh); }

            let rackIdx = 0, beamIdx = 0, braceIdx = 0, palletIdx = 0, boxIdx = 0, loadPalletIdx = 0, boxPalletIdx = 0, emptyPalletRectFillIdx = 0, emptyBoxRectFillIdx = 0, emptyPalletRectFrameIdx = 0, emptyBoxRectFrameIdx = 0;

            // Floor - Using a grid texture or improved material
            const floorGeo = new THREE.PlaneGeometry(layout.width + 16, layout.depth + 16);
            const floorMat = new THREE.MeshStandardMaterial({ 
                color: 0x1f262c, 
                roughness: 0.94, 
                metalness: 0.08 
            });
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI/2;
            floor.receiveShadow = true;
            floor.position.set(layout.centerX, 0, layout.centerZ + 1);
            scene.add(floor);

            // Add subtle grid on floor
            const grid = new THREE.GridHelper(Math.max(layout.width, layout.depth) + 12, 50, 0x3c464f, 0x273038);
            grid.position.set(layout.centerX, 0.02, layout.centerZ + 1);
            scene.add(grid);

            createWarehouseShell(layout);
            addFloorMarkings(layout);

            // Generation Loop
            wmsData.forEach(item => {
                const a = item.aisle;
                const b = item.bay;
                const l = item.level;

                const z = (a * (CONFIG.rackDepth + CONFIG.aisleWidth));
                const x = (b * CONFIG.rackWidth);
                const y = (l * CONFIG.levelHeight) + 0.2;

                const isPicking = item.type === 'BOX';

                // Store position on item for search cam logic
                item.worldPos = { x: 0, y: 0, z: 0 }; 

                // Structure
                if (item.subSlot === 0) {
                    if (l === 0) { 
                        setInstanceTransform(rackMesh, rackIdx++, x, warehouseHeight / 2, z, 1, 1, 1);
                        setInstanceTransform(rackMesh, rackIdx++, x + CONFIG.rackWidth, warehouseHeight / 2, z, 1, 1, 1);

                        const braceAngle = Math.atan2(warehouseHeight, CONFIG.rackWidth);
                        const braceZOffset = (CONFIG.rackDepth / 2) - 0.08;
                        setInstanceTransform(braceMesh, braceIdx++, x + (CONFIG.rackWidth / 2), warehouseHeight / 2, z + braceZOffset, 1, 1, 1, 0, 0, braceAngle);
                        setInstanceTransform(braceMesh, braceIdx++, x + (CONFIG.rackWidth / 2), warehouseHeight / 2, z + braceZOffset, 1, 1, 1, 0, 0, -braceAngle);
                        setInstanceTransform(braceMesh, braceIdx++, x + (CONFIG.rackWidth / 2), warehouseHeight / 2, z - braceZOffset, 1, 1, 1, 0, 0, braceAngle);
                        setInstanceTransform(braceMesh, braceIdx++, x + (CONFIG.rackWidth / 2), warehouseHeight / 2, z - braceZOffset, 1, 1, 1, 0, 0, -braceAngle);
                    }

                    setInstanceTransform(beamMesh, beamIdx++, x + (CONFIG.rackWidth / 2), y, z + (CONFIG.rackDepth / 2) - 0.05, 1, 1, 1);
                    setInstanceTransform(beamMesh, beamIdx++, x + (CONFIG.rackWidth / 2), y, z - (CONFIG.rackDepth / 2) + 0.05, 1, 1, 1);
                }

                // Goods
                if (item.occupied) {
                    if (isPicking) {
                        const slotWidth = CONFIG.rackWidth / 4;
                        const xOffset = (item.subSlot * slotWidth) + (slotWidth/2);
                        
                        const pX = x + xOffset;
                        const palletY = y + 0.04;
                        const pY = y + 0.24;
                        const pZ = z;
                        
                        setInstanceTransform(boxPalletMesh, boxPalletIdx++, pX, palletY, pZ, 1, 1, 1);
                        dummy.position.set(pX, pY, pZ);
                        item.worldPos = {x:pX, y:pY, z:pZ}; // Save for Search

                        dummy.scale.set(1, 1, 1);
                        dummy.rotation.set(0, (Math.random()-0.5)*0.2, 0); 
                        dummy.updateMatrix();
                        
                        boxMesh.setMatrixAt(boxIdx, dummy.matrix);
                        color.setHex(0xcd853f); // Standard Box Brown
                        boxMesh.setColorAt(boxIdx, color);
                        
                        instanceDataMap[boxMesh.uuid][boxIdx] = item;
                        item.instanceId = boxIdx; // Save for highlighting
                        item.meshUuid = boxMesh.uuid;
                        boxIdx++;

                    } else {
                        const clusterCenterX = x + (CONFIG.rackWidth / 2);
                        const palletBaseY = y + 0.06;
                        const loadY = y + 0.56;
                        const shadePalette = [0xd8dde4, 0xe5e9ef, 0xcfd6df];
                        item.worldPos = { x: clusterCenterX, y: loadY, z: z };

                        palletOffsets.forEach((offset, idx) => {
                            const palletX = clusterCenterX + offset;
                            setInstanceTransform(loadPalletMesh, loadPalletIdx++, palletX, palletBaseY, z, 1, 1, 1);
                            setInstanceTransform(palletMesh, palletIdx, palletX, loadY, z, 1, 1, 1, 0, (idx - 1) * 0.03, 0);

                            color.setHex(shadePalette[idx]);
                            palletMesh.setColorAt(palletIdx, color);
                            instanceDataMap[palletMesh.uuid][palletIdx] = item;

                            if (idx === 1) {
                                item.instanceId = palletIdx;
                                item.meshUuid = palletMesh.uuid;
                            }

                            palletIdx++;
                        });
                    }
                } else {
                    if (isPicking) {
                        const slotWidth = CONFIG.rackWidth / 4;
                        const xOffset = (item.subSlot * slotWidth) + (slotWidth/2);
                        const pX = x + xOffset;
                        const pZ = z;
                        const pYRect = y + 0.02;
                        dummy.rotation.set(-Math.PI/2, 0, 0);
                        dummy.position.set(pX, pYRect, pZ);
                        dummy.scale.set(1, 1, 1);
                        dummy.updateMatrix();
                        if (emptyBoxRectFillMesh) emptyBoxRectFillMesh.setMatrixAt(emptyBoxRectFillIdx++, dummy.matrix);
                        if (emptyBoxRectFrameMesh) {
                            const hx = 0.4/2, hz = 0.6/2; const t = 0.03;
                            dummy.rotation.set(0, 0, 0);
                            dummy.scale.set(0.4, t, t); dummy.position.set(pX, pYRect, pZ+hz); dummy.updateMatrix(); emptyBoxRectFrameMesh.setMatrixAt(emptyBoxRectFrameIdx++, dummy.matrix);
                            dummy.scale.set(0.4, t, t); dummy.position.set(pX, pYRect, pZ-hz); dummy.updateMatrix(); emptyBoxRectFrameMesh.setMatrixAt(emptyBoxRectFrameIdx++, dummy.matrix);
                            dummy.scale.set(t, t, 0.6); dummy.position.set(pX+hx, pYRect, pZ); dummy.updateMatrix(); emptyBoxRectFrameMesh.setMatrixAt(emptyBoxRectFrameIdx++, dummy.matrix);
                            dummy.scale.set(t, t, 0.6); dummy.position.set(pX-hx, pYRect, pZ); dummy.updateMatrix(); emptyBoxRectFrameMesh.setMatrixAt(emptyBoxRectFrameIdx++, dummy.matrix);
                        }
                    } else {
                        const pZ = z;
                        const pYRect = y + 0.02;
                        const hx = 0.78 / 2;
                        const hz = 1.08 / 2;
                        const t = 0.03;

                        palletOffsets.forEach((offset) => {
                            const pX = x + (CONFIG.rackWidth / 2) + offset;
                            dummy.rotation.set(-Math.PI/2, 0, 0);
                            dummy.position.set(pX, pYRect, pZ);
                            dummy.scale.set(1, 1, 1);
                            dummy.updateMatrix();
                            if (emptyPalletRectFillMesh) emptyPalletRectFillMesh.setMatrixAt(emptyPalletRectFillIdx++, dummy.matrix);

                            if (emptyPalletRectFrameMesh) {
                                dummy.rotation.set(0, 0, 0);
                                dummy.scale.set(0.78, t, t); dummy.position.set(pX, pYRect, pZ + hz); dummy.updateMatrix(); emptyPalletRectFrameMesh.setMatrixAt(emptyPalletRectFrameIdx++, dummy.matrix);
                                dummy.scale.set(0.78, t, t); dummy.position.set(pX, pYRect, pZ - hz); dummy.updateMatrix(); emptyPalletRectFrameMesh.setMatrixAt(emptyPalletRectFrameIdx++, dummy.matrix);
                                dummy.scale.set(t, t, 1.08); dummy.position.set(pX + hx, pYRect, pZ); dummy.updateMatrix(); emptyPalletRectFrameMesh.setMatrixAt(emptyPalletRectFrameIdx++, dummy.matrix);
                                dummy.scale.set(t, t, 1.08); dummy.position.set(pX - hx, pYRect, pZ); dummy.updateMatrix(); emptyPalletRectFrameMesh.setMatrixAt(emptyPalletRectFrameIdx++, dummy.matrix);
                            }
                        });
                    }
                }
            });

            rackMesh.instanceMatrix.needsUpdate = true;
            beamMesh.instanceMatrix.needsUpdate = true;
            braceMesh.instanceMatrix.needsUpdate = true;
            palletMesh.instanceMatrix.needsUpdate = true;
            palletMesh.instanceColor.needsUpdate = true;
            boxMesh.instanceMatrix.needsUpdate = true;
            boxMesh.instanceColor.needsUpdate = true;
            loadPalletMesh.instanceMatrix.needsUpdate = true;
            boxPalletMesh.instanceMatrix.needsUpdate = true;
            if (emptyPalletRectFillMesh) emptyPalletRectFillMesh.instanceMatrix.needsUpdate = true;
            if (emptyBoxRectFillMesh) emptyBoxRectFillMesh.instanceMatrix.needsUpdate = true;
            if (emptyPalletRectFrameMesh) emptyPalletRectFrameMesh.instanceMatrix.needsUpdate = true;
            if (emptyBoxRectFrameMesh) emptyBoxRectFrameMesh.instanceMatrix.needsUpdate = true;
        }

        // --- SEARCH SYSTEM ---
        function performSearch() {
            const input = document.getElementById('search-input');
            const id = input.value.trim();
            if(!id) return;

            const item = itemLookup[id];
            if (item) {
                // 1. Set Camera Target
                const targetX = item.worldPos.x;
                const targetY = item.worldPos.y;
                const targetZ = item.worldPos.z;
                
                cameraTargetLookAt.set(targetX, targetY, targetZ);
                
                // 2. Set Camera Position (Offset slightly back and up)
                // Adjust Z offset depending on aisle side, here simply adding offset
                cameraTargetPos.set(targetX, targetY + 2, targetZ + 6);
                
                isAnimatingCamera = true;

                // 3. Highlight the item
                highlighItemSpecific(item);

            } else {
                alert("ID not found in warehouse data.");
            }
        }

        function highlighItemSpecific(item) {
            // Clear old
            if (highlightState.mesh) {
                highlightState.mesh.setColorAt(highlightState.instanceId, highlightState.originalColor);
                highlightState.mesh.instanceColor.needsUpdate = true;
            }

            const mesh = item.type === 'BOX' ? boxMesh : palletMesh;
            const instanceId = item.instanceId;

            // Save original
            mesh.getColorAt(instanceId, highlightState.originalColor);
            highlightState.mesh = mesh;
            highlightState.instanceId = instanceId;

            // Set Neon Highlight
            color.setHex(0xffc30d);
            mesh.setColorAt(instanceId, color);
            mesh.instanceColor.needsUpdate = true;
            
            // Trigger Tooltip manually
            const tooltip = document.getElementById('tooltip');
            tooltip.style.display = 'block';
            tooltip.style.left = '50%';
            tooltip.style.top = '50%';
            tooltip.style.transform = 'translate(-50%, -150%)';
            document.getElementById('tt-id').innerText = item.id;
            document.getElementById('tt-type').innerText = item.type;
            document.getElementById('tt-sku').innerText = item.sku;
            document.getElementById('tt-qty').innerText = item.qty;
        }

        // --- INTERACTION LOGIC ---

        function onMouseMove(event) {
            event.preventDefault();
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            if (isAnimatingCamera) return; // Disable hover while flying

            raycaster.setFromCamera(mouse, camera);
            const intersection = raycaster.intersectObjects([palletMesh, boxMesh]);
            const tooltip = document.getElementById('tooltip');

            // Clear highlight if moving off
            if (highlightState.mesh && (!intersection.length || (intersection[0].object !== highlightState.mesh || intersection[0].instanceId !== highlightState.instanceId))) {
                // Only clear if we are NOT in search mode focus (simple check: mouse move clears search focus in this demo)
                highlightState.mesh.setColorAt(highlightState.instanceId, highlightState.originalColor);
                highlightState.mesh.instanceColor.needsUpdate = true;
                highlightState.mesh = null;
                tooltip.style.display = 'none';
            }

            if (intersection.length > 0) {
                const hit = intersection[0];
                const mesh = hit.object;
                const instanceId = hit.instanceId;
                const data = instanceDataMap[mesh.uuid][instanceId];

                if (data) {
                    if (!highlightState.mesh || (highlightState.instanceId !== instanceId)) {
                        // Restore old
                        if(highlightState.mesh) {
                             highlightState.mesh.setColorAt(highlightState.instanceId, highlightState.originalColor);
                             highlightState.mesh.instanceColor.needsUpdate = true;
                        }

                        mesh.getColorAt(instanceId, highlightState.originalColor);
                        highlightState.mesh = mesh;
                        highlightState.instanceId = instanceId;
                        
                        color.setHex(0xffc30d);
                        mesh.setColorAt(instanceId, color);
                        mesh.instanceColor.needsUpdate = true;

                        tooltip.style.display = 'block';
                        tooltip.style.left = (event.clientX + 20) + 'px';
                        tooltip.style.top = (event.clientY + 20) + 'px';
                        tooltip.style.transform = 'none';
                        
                        document.getElementById('tt-id').innerText = data.id;
                        document.getElementById('tt-type').innerText = data.type;
                        document.getElementById('tt-sku').innerText = data.sku;
                        document.getElementById('tt-qty').innerText = data.qty;
                    }
                }
            }
        }

        function viewMode(mode) {
            const activeButtons = document.querySelectorAll('#controls .btn');
            activeButtons.forEach((button) => {
                button.classList.toggle('active', button.dataset.mode === mode);
            });

            const defaultPalletColors = [0xd8dde4, 0xe5e9ef, 0xcfd6df];
            for (const [id, data] of Object.entries(instanceDataMap[palletMesh.uuid])) {
                const instanceId = parseInt(id);
                if (mode === 'heatmap') {
                    color.setHSL((1.0 - data.velocity) * 0.6, 1.0, 0.5);
                } else {
                    color.setHex(defaultPalletColors[instanceId % defaultPalletColors.length]); 
                }
                palletMesh.setColorAt(instanceId, color);
            }
            for (const [id, data] of Object.entries(instanceDataMap[boxMesh.uuid])) {
                const instanceId = parseInt(id);
                if (mode === 'heatmap') {
                    color.setHSL((1.0 - data.velocity) * 0.6, 1.0, 0.5);
                } else {
                    color.setHex(0xcd853f); 
                }
                boxMesh.setColorAt(instanceId, color);
            }
            palletMesh.instanceColor.needsUpdate = true;
            boxMesh.instanceColor.needsUpdate = true;
        }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        function animate() {
            requestAnimationFrame(animate);

            // Camera Fly-to Logic
            if (isAnimatingCamera) {
                // Smooth Lerp Position
                camera.position.lerp(cameraTargetPos, 0.05);
                controls.target.lerp(cameraTargetLookAt, 0.05);
                
                // Check if close enough to stop
                if (camera.position.distanceTo(cameraTargetPos) < 0.1) {
                    isAnimatingCamera = false;
                }
            }

            // Pulse Effect for Selected Item
            if (highlightState && highlightState.mesh) {
                pulseTime += 0.1;
                const sine = (Math.sin(pulseTime) + 1) / 2; // 0 to 1
                // Pulse between Brand Yellow and White
                color.setHex(0xffc30d);
                color.lerp(new THREE.Color(0xffffff), sine * 0.5);
                
                highlightState.mesh.setColorAt(highlightState.instanceId, color);
                highlightState.mesh.instanceColor.needsUpdate = true;
            }

            controls.update();
            updateWarehouseShellVisibility();
            renderer.render(scene, camera);
        }

        // --- EXECUTION START ---
        // Ensure DOM and variables are ready
        init();
        animate();

