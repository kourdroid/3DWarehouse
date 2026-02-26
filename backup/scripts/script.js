
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
        let rackMesh, beamMesh, palletMesh, boxMesh, emptyPalletRectFillMesh, emptyBoxRectFillMesh, emptyPalletRectFrameMesh, emptyBoxRectFrameMesh; 
        
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

        function createInstancedWarehouse() {
            const totalBays = CONFIG.aisles * CONFIG.baysPerAisle;
            const totalLevels = totalBays * CONFIG.levels;
            const maxPallets = totalLevels; 
            const maxBoxes = totalLevels * 4; 
            let emptyPalletCount = 0, emptyBoxCount = 0;
            for (const it of wmsData) {
                if (!it.occupied) {
                    if (it.type === 'BOX') emptyBoxCount++; else emptyPalletCount++;
                }
            }

            // Geometries
            const uprightGeo = new THREE.BoxGeometry(0.1, CONFIG.levels * CONFIG.levelHeight, 0.1);
            const beamGeo = new THREE.BoxGeometry(CONFIG.rackWidth, 0.12, 0.1); // Slightly thicker beams look better
            const palletGeo = new THREE.BoxGeometry(1.2, 1.0, 1.2);
            const boxGeo = new THREE.BoxGeometry(0.4, 0.3, 0.6);

            // Materials - Enhanced for Tone Mapping
            const metalMat = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.4, metalness: 0.6 });
            const beamMat = new THREE.MeshStandardMaterial({ color: 0xffc30d, roughness: 0.7, metalness: 0.1 });
            const goodsMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }); 
            const rectFillMat = new THREE.MeshBasicMaterial({ color: 0x32ff6f, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
            const rectEdgeMat = new THREE.MeshBasicMaterial({ color: 0x00ff66, transparent: true, opacity: 1 });
            const edgeGeo = new THREE.BoxGeometry(1, 1, 1);
            const palletRectGeo = new THREE.PlaneGeometry(1.2, 1.2);
            const boxRectGeo = new THREE.PlaneGeometry(0.4, 0.6);

            // Instanced Meshes
            rackMesh = new THREE.InstancedMesh(uprightGeo, metalMat, totalBays * 2); 
            beamMesh = new THREE.InstancedMesh(beamGeo, beamMat, totalLevels * 2); 
            palletMesh = new THREE.InstancedMesh(palletGeo, goodsMat, maxPallets); 
            boxMesh = new THREE.InstancedMesh(boxGeo, goodsMat, maxBoxes);
            if (emptyPalletCount > 0) { emptyPalletRectFillMesh = new THREE.InstancedMesh(palletRectGeo, rectFillMat, emptyPalletCount); }
            if (emptyBoxCount > 0) { emptyBoxRectFillMesh = new THREE.InstancedMesh(boxRectGeo, rectFillMat, emptyBoxCount); }
            if (emptyPalletCount > 0) { emptyPalletRectFrameMesh = new THREE.InstancedMesh(edgeGeo, rectEdgeMat, emptyPalletCount * 4); }
            if (emptyBoxCount > 0) { emptyBoxRectFrameMesh = new THREE.InstancedMesh(edgeGeo, rectEdgeMat, emptyBoxCount * 4); }

            [rackMesh, beamMesh, palletMesh, boxMesh].forEach(m => {
                m.castShadow = true;
                m.receiveShadow = true;
                scene.add(m);
                instanceDataMap[m.uuid] = {};
            });
            if (emptyPalletRectFillMesh) { emptyPalletRectFillMesh.castShadow = false; emptyPalletRectFillMesh.receiveShadow = false; scene.add(emptyPalletRectFillMesh); }
            if (emptyBoxRectFillMesh) { emptyBoxRectFillMesh.castShadow = false; emptyBoxRectFillMesh.receiveShadow = false; scene.add(emptyBoxRectFillMesh); }
            if (emptyPalletRectFrameMesh) { emptyPalletRectFrameMesh.castShadow = false; emptyPalletRectFrameMesh.receiveShadow = false; scene.add(emptyPalletRectFrameMesh); }
            if (emptyBoxRectFrameMesh) { emptyBoxRectFrameMesh.castShadow = false; emptyBoxRectFrameMesh.receiveShadow = false; scene.add(emptyBoxRectFrameMesh); }

            let rackIdx = 0, beamIdx = 0, palletIdx = 0, boxIdx = 0, emptyPalletRectFillIdx = 0, emptyBoxRectFillIdx = 0, emptyPalletRectFrameIdx = 0, emptyBoxRectFrameIdx = 0;

            // Floor - Using a grid texture or improved material
            const floorGeo = new THREE.PlaneGeometry(300, 300);
            const floorMat = new THREE.MeshStandardMaterial({ 
                color: 0x1a1a1a, 
                roughness: 0.9, 
                metalness: 0.1 
            });
            const floor = new THREE.Mesh(floorGeo, floorMat);
            floor.rotation.x = -Math.PI/2;
            floor.receiveShadow = true;
            scene.add(floor);

            // Add subtle grid on floor
            const grid = new THREE.GridHelper(300, 60, 0x333333, 0x222222);
            scene.add(grid);

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
                    dummy.scale.set(1,1,1); dummy.rotation.set(0,0,0);
                    
                    if (l === 0) { 
                        dummy.position.set(x, (CONFIG.levels*CONFIG.levelHeight)/2, z);
                        dummy.updateMatrix();
                        rackMesh.setMatrixAt(rackIdx++, dummy.matrix);
                        
                        dummy.position.set(x + CONFIG.rackWidth, (CONFIG.levels*CONFIG.levelHeight)/2, z);
                        dummy.updateMatrix();
                        rackMesh.setMatrixAt(rackIdx++, dummy.matrix);
                    }

                    dummy.position.set(x + CONFIG.rackWidth/2, y, z + CONFIG.rackDepth/2 - 0.05);
                    dummy.updateMatrix();
                    beamMesh.setMatrixAt(beamIdx++, dummy.matrix);
                    
                    dummy.position.set(x + CONFIG.rackWidth/2, y, z - CONFIG.rackDepth/2 + 0.05);
                    dummy.updateMatrix();
                    beamMesh.setMatrixAt(beamIdx++, dummy.matrix);
                }

                // Goods
                if (item.occupied) {
                    if (isPicking) {
                        const slotWidth = CONFIG.rackWidth / 4;
                        const xOffset = (item.subSlot * slotWidth) + (slotWidth/2);
                        
                        const pX = x + xOffset;
                        const pY = y + 0.3;
                        const pZ = z;
                        
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
                        const pX = x + CONFIG.rackWidth/2;
                        const pY = y + 0.6;
                        const pZ = z;

                        dummy.position.set(pX, pY, pZ);
                        item.worldPos = {x:pX, y:pY, z:pZ}; // Save for Search

                        dummy.scale.set(1, 1, 1);
                        dummy.rotation.set(0, 0, 0);
                        dummy.updateMatrix();
                        
                        palletMesh.setMatrixAt(palletIdx, dummy.matrix);
                        color.setHex(0xe0e0e0); // Light grey wrap
                        palletMesh.setColorAt(palletIdx, color);

                        instanceDataMap[palletMesh.uuid][palletIdx] = item;
                        item.instanceId = palletIdx;
                        item.meshUuid = palletMesh.uuid;
                        palletIdx++;
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
                        const pX = x + CONFIG.rackWidth/2;
                        const pZ = z;
                        const pYRect = y + 0.02;
                        dummy.rotation.set(-Math.PI/2, 0, 0);
                        dummy.position.set(pX, pYRect, pZ);
                        dummy.scale.set(1, 1, 1);
                        dummy.updateMatrix();
                        if (emptyPalletRectFillMesh) emptyPalletRectFillMesh.setMatrixAt(emptyPalletRectFillIdx++, dummy.matrix);
                        if (emptyPalletRectFrameMesh) {
                            const hx = 1.2/2, hz = 1.2/2; const t = 0.03;
                            dummy.rotation.set(0, 0, 0);
                            dummy.scale.set(1.2, t, t); dummy.position.set(pX, pYRect, pZ+hz); dummy.updateMatrix(); emptyPalletRectFrameMesh.setMatrixAt(emptyPalletRectFrameIdx++, dummy.matrix);
                            dummy.scale.set(1.2, t, t); dummy.position.set(pX, pYRect, pZ-hz); dummy.updateMatrix(); emptyPalletRectFrameMesh.setMatrixAt(emptyPalletRectFrameIdx++, dummy.matrix);
                            dummy.scale.set(t, t, 1.2); dummy.position.set(pX+hx, pYRect, pZ); dummy.updateMatrix(); emptyPalletRectFrameMesh.setMatrixAt(emptyPalletRectFrameIdx++, dummy.matrix);
                            dummy.scale.set(t, t, 1.2); dummy.position.set(pX-hx, pYRect, pZ); dummy.updateMatrix(); emptyPalletRectFrameMesh.setMatrixAt(emptyPalletRectFrameIdx++, dummy.matrix);
                        }
                    }
                }
            });

            rackMesh.instanceMatrix.needsUpdate = true;
            beamMesh.instanceMatrix.needsUpdate = true;
            palletMesh.instanceMatrix.needsUpdate = true;
            palletMesh.instanceColor.needsUpdate = true;
            boxMesh.instanceMatrix.needsUpdate = true;
            boxMesh.instanceColor.needsUpdate = true;
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
            for (const [id, data] of Object.entries(instanceDataMap[palletMesh.uuid])) {
                const instanceId = parseInt(id);
                if (mode === 'heatmap') {
                    color.setHSL((1.0 - data.velocity) * 0.6, 1.0, 0.5);
                } else {
                    color.setHex(0xe0e0e0); 
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
            renderer.render(scene, camera);
        }

        // --- EXECUTION START ---
        // Ensure DOM and variables are ready
        init();
        animate();

