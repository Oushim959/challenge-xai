/* ========================================
   3D Avatar System - Three.js + GLB / FBX
   Saudi Executive Avatar (كريم - المستشار السعودي)
   ======================================== */

const Avatar3D = (() => {
    // Ensure THREE.LoaderUtils.resolveURL exists for GLTFLoader image blob loading
    if (typeof THREE !== 'undefined' && THREE.LoaderUtils && typeof THREE.LoaderUtils.resolveURL !== 'function') {
        THREE.LoaderUtils.resolveURL = function (url, path) {
            if (typeof url !== 'string' || url === '') return '';
            if (/^(https?:)?\/\//i.test(url)) return url;
            if (/^data:.*,.*$/i.test(url)) return url;
            if (/^blob:.*$/i.test(url)) return url;
            return (path || '') + url;
        };
    }

    if (typeof THREE !== 'undefined' && THREE.Texture && !THREE.Texture.prototype.hasOwnProperty('userData')) {
        Object.defineProperty(THREE.Texture.prototype, 'userData', {
            get() {
                if (!this._userData) this._userData = {};
                return this._userData;
            },
            set(v) {
                this._userData = v;
            },
            configurable: true
        });
    }

    // --- State ---
    let scene, camera, renderer, clock;
    let mixer = null;
    let model = null;
    let animations = {};
    let currentAction = null;
    let currentAnimName = '';
    let isLoaded = false;
    let isLoading = false;
    let container = null;
    let animationFrameId = null;
    let reactionTimeout = null;
    let targetModelRotationY = 0.55; // Rotates model +31.5 deg to cancel animation hip angle and face user directly

    // The primary 3D avatar model file
    const MODEL_FILE = 'assets/models/saudi_avatar.glb';

    // Mixamo FBX animations to retarget
    const FBX_ANIM_FILES = {
        sad:      'assets/animations/Sad Idle.fbx',
        cheering: 'assets/animations/Victory Idle.fbx'
    };

    // Regex to detect and strip Mixamo bone prefix (e.g., "mixamorig7", "mixamorig")
    const MIXAMO_PREFIX_REGEX = /^mixamorig\d*/;

    // --- Init ---
    function init(containerId) {
        if (scene) return; // already initialized

        container = document.getElementById(containerId);
        if (!container) {
            console.error('Avatar3D: Container not found:', containerId);
            return;
        }

        clock = new THREE.Clock();

        // 1. Scene
        scene = new THREE.Scene();
        scene.background = null; // transparent background to blend into UI

        const w = container.clientWidth || 220;
        const h = container.clientHeight || 280;

        // 2. Camera — framed higher up with headroom so the whole head and hair are shown
        camera = new THREE.PerspectiveCamera(26, w / h, 0.05, 50);
        camera.position.set(0, 1.70, 1.36);
        camera.lookAt(0, 1.62, 0);

        // 3. Renderer
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;
        container.appendChild(renderer.domElement);

        // 4. Lighting
        setupLighting();

        // 5. Responsive Resize
        if (window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(() => resize());
            resizeObserver.observe(container);
        } else {
            window.addEventListener('resize', resize);
        }

        // 6. Start Render Loop
        animate();

        // 7. Load Model & Animations
        loadAvatarModel();
    }

    function resize() {
        if (!container || !renderer || !camera) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w > 0 && h > 0) {
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        }
    }

    function setupLighting() {
        // Balanced ambient base light
        const ambient = new THREE.AmbientLight(0xffffff, 0.78);
        scene.add(ambient);

        // Key Light (warm executive studio light from front-right)
        const key = new THREE.DirectionalLight(0xfff8ee, 1.15);
        key.position.set(0.6, 2.2, 2.0);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.bias = -0.0008;
        scene.add(key);

        // Fill Light (soft cool blue from front-left)
        const fill = new THREE.DirectionalLight(0xddeeff, 0.65);
        fill.position.set(-1.2, 1.9, 1.6);
        scene.add(fill);

        // Rim / Back Light (warm gold highlight from behind-top)
        const rim = new THREE.DirectionalLight(0xd4af37, 0.9);
        rim.position.set(0.1, 2.4, -1.6);
        scene.add(rim);

        // Face & Eye Catchlight (direct frontal fill so eyes and glasses shine clearly)
        const faceCatch = new THREE.DirectionalLight(0xffffff, 0.35);
        faceCatch.position.set(0, 1.68, 1.6);
        scene.add(faceCatch);

        // Subtle upward bounce light
        const bounce = new THREE.DirectionalLight(0x8899aa, 0.2);
        bounce.position.set(0, -1.0, 1.0);
        scene.add(bounce);
    }

    // --- Load GLB Avatar ---
    function loadAvatarModel() {
        if (isLoading) return;
        isLoading = true;

        const loadingEl = document.getElementById('avatar-loading');
        if (loadingEl) loadingEl.style.display = 'flex';

        const loader = new THREE.GLTFLoader();

        loader.load(MODEL_FILE, (gltf) => {
            model = gltf.scene || gltf.scenes[0];

            // Calculate bounding box and scale
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            console.log(`Avatar3D: GLB loaded. Size: ${size.x.toFixed(2)}m x ${size.y.toFixed(2)}m x ${size.z.toFixed(2)}m`);

            // Standardize height to 1.88m
            const targetHeight = 1.88;
            const scale = (size.y > 0.5 && size.y < 3.0) ? (targetHeight / size.y) : 1.0;
            model.scale.setScalar(scale);

            // Center horizontally and put feet firmly on ground
            model.position.x = -center.x * scale;
            model.position.y = -box.min.y * scale;
            model.position.z = -center.z * scale;

            // Orient avatar to face user directly
            model.rotation.y = targetModelRotationY;

            // Frame camera on face and chest with whole head visible
            camera.position.set(0, 1.70, 1.36);
            camera.lookAt(0, 1.62, 0);

            // Configure Materials & Skinning (CRITICAL for Three.js r128)
            const boneMap = {};
            model.traverse((child) => {
                if (child.isBone && child.name) {
                    boneMap[child.name] = child;
                }

                if (child.isMesh || child.isSkinnedMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;

                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    mats.forEach((mat) => {
                        // Crucial for SkinnedMesh animations in Three.js r128
                        if (child.isSkinnedMesh) {
                            mat.skinning = true;
                        }

                        // Ensure sRGB encoding for rich colors
                        if (mat.map) {
                            mat.map.encoding = THREE.sRGBEncoding;
                        }

                        // Fix metallic blowout: Avaturn models have metallicFactor: 1
                        // Set realistic non-metal parameters for human skin, hair, and clothes
                        if (child.name.includes('glasses_1')) {
                            // Glasses lens
                            mat.transparent = true;
                            mat.opacity = 0.35;
                            mat.metalness = 0.1;
                            mat.roughness = 0.1;
                        } else if (child.name.includes('glasses_0')) {
                            // Glasses frame
                            mat.metalness = 0.4;
                            mat.roughness = 0.4;
                        } else {
                            // Skin, hair, clothes, shoes
                            mat.metalness = 0.04;
                            mat.roughness = 0.82;
                        }

                        mat.needsUpdate = true;
                    });
                }
            });

            scene.add(model);
            console.log(`Avatar3D: Model added to scene. Found ${Object.keys(boneMap).length} bones.`);

            // Setup Animation Mixer
            mixer = new THREE.AnimationMixer(model);

            // Automatically return to idle once any single-play reaction animation completes
            mixer.addEventListener('finished', (e) => {
                if (reactionTimeout) clearTimeout(reactionTimeout);
                if (currentAnimName !== 'idle') {
                    playAnimation('idle', 0.5);
                }
            });

            // 1. Native Idle Animation from GLB
            if (gltf.animations && gltf.animations.length > 0) {
                const idleClip = gltf.animations[0];
                const action = mixer.clipAction(idleClip);
                action.setLoop(THREE.LoopRepeat);
                animations['idle'] = action;
                console.log(`Avatar3D: Native idle animation loaded (${idleClip.duration.toFixed(2)}s).`);
            }

            // 2. Retarget FBX Animations (Sad & Cheering)
            loadFBXAnimations(boneMap);

        }, (progress) => {
            if (progress.total > 0) {
                const pct = Math.round((progress.loaded / progress.total) * 100);
                const el = document.getElementById('avatar-loading-text');
                if (el) el.textContent = `جاري تجهيز المستشار... ${pct}%`;
            }
        }, (error) => {
            console.error('Avatar3D: Failed to load GLB model:', error);
            isLoading = false;
            const el = document.getElementById('avatar-loading-text');
            if (el) el.textContent = 'تعذر تحميل الشخصية';
        });
    }

    // --- Retarget Mixamo FBX Tracks to GLB Skeleton ---
    function retargetMixamoClip(clip, boneMap) {
        const newTracks = [];

        for (const track of clip.tracks) {
            const parts = track.name.split('.');
            let boneName = parts[0];
            const prop = parts[1];

            // Strip prefix: mixamorig7Hips -> Hips
            boneName = boneName.replace(MIXAMO_PREFIX_REGEX, '');

            // Only keep tracks matching existing bones in the model
            if (!boneMap[boneName]) continue;

            const newTrack = track.clone();
            newTrack.name = boneName + '.' + prop;

            // Mixamo translation tracks are in centimeters (~98.5cm)
            // Scale translation to meters (~0.985m) to prevent hips from flying 100m away
            if (prop === 'position') {
                for (let i = 0; i < newTrack.values.length; i += 3) {
                    newTrack.values[i]     *= 0.01;
                    newTrack.values[i + 1] *= 0.01;
                    newTrack.values[i + 2] *= 0.01;
                }
            }

            newTracks.push(newTrack);
        }

        return new THREE.AnimationClip(clip.name, clip.duration, newTracks);
    }

    // --- Load Secondary FBX Animations ---
    function loadFBXAnimations(boneMap) {
        const fbxLoader = new THREE.FBXLoader();
        const animNames = Object.keys(FBX_ANIM_FILES);
        let loadedCount = 0;

        animNames.forEach((name) => {
            const file = encodeURI(FBX_ANIM_FILES[name]);
            fbxLoader.load(file, (fbx) => {
                if (fbx.animations && fbx.animations.length > 0) {
                    const retargeted = retargetMixamoClip(fbx.animations[0], boneMap);
                    retargeted.name = name;
                    const action = mixer.clipAction(retargeted);
                    // Reaction animations play only once then stop/return to idle
                    action.setLoop(THREE.LoopOnce, 1);
                    action.clampWhenFinished = true;
                    animations[name] = action;
                    console.log(`Avatar3D: Retargeted animation "${name}" (${retargeted.duration.toFixed(2)}s, ${retargeted.tracks.length} tracks, LoopOnce)`);
                }

                loadedCount++;
                if (loadedCount === animNames.length) onAllReady();
            }, undefined, (err) => {
                console.warn(`Avatar3D: Warning loading "${name}":`, err);
                loadedCount++;
                if (loadedCount === animNames.length) onAllReady();
            });
        });
    }

    function onAllReady() {
        isLoaded = true;
        isLoading = false;

        // Hide loading screen smoothly
        const loadingEl = document.getElementById('avatar-loading');
        if (loadingEl) {
            loadingEl.style.opacity = '0';
            setTimeout(() => { loadingEl.style.display = 'none'; }, 400);
        }

        // Start Idle Animation
        playAnimation('idle', 0.2);
        console.log('Avatar3D: Ready & active!');
    }

    // --- Animation Control ---
    function playAnimation(name, fadeDuration = 0.4) {
        if (!isLoaded || !mixer) return;
        if (name === currentAnimName) return;

        const nextAction = animations[name];
        if (!nextAction) {
            console.warn(`Avatar3D: Animation "${name}" not found`);
            return;
        }

        if (currentAction) {
            currentAction.fadeOut(fadeDuration);
        }

        nextAction.reset();
        nextAction.setEffectiveTimeScale(1);
        nextAction.setEffectiveWeight(1);

        // Ensure non-idle reactions play exactly once
        if (name !== 'idle') {
            nextAction.setLoop(THREE.LoopOnce, 1);
            nextAction.clampWhenFinished = true;
        }

        nextAction.fadeIn(fadeDuration);
        nextAction.play();

        if (name === 'idle') {
            targetModelRotationY = 0.55; // cancel -31.5 deg in avaturn_animation so he squarely faces user
        } else {
            targetModelRotationY = 0.05; // Mixamo clips already face forward
        }

        currentAction = nextAction;
        currentAnimName = name;
    }

    // Per user request: Talking animation is removed
    function setTalking() {
        // Remain in idle posture naturally while voice audio plays
    }

    function setIdle() {
        if (reactionTimeout) clearTimeout(reactionTimeout);
        playAnimation('idle', 0.4);
    }

    function setSad() {
        if (reactionTimeout) clearTimeout(reactionTimeout);
        playAnimation('sad', 0.35);
        // Clip duration safety fallback (Sad clip is 2.67s)
        const clip = animations['sad'] ? animations['sad'].getClip() : null;
        const dur = clip ? (clip.duration * 1000 + 100) : 2800;
        reactionTimeout = setTimeout(() => {
            if (currentAnimName === 'sad') playAnimation('idle', 0.5);
        }, dur);
    }

    function setCheering() {
        if (reactionTimeout) clearTimeout(reactionTimeout);
        playAnimation('cheering', 0.3);
        // Clip duration safety fallback (Victory clip is 1.67s)
        const clip = animations['cheering'] ? animations['cheering'].getClip() : null;
        const dur = clip ? (clip.duration * 1000 + 100) : 1800;
        reactionTimeout = setTimeout(() => {
            if (currentAnimName === 'cheering') playAnimation('idle', 0.5);
        }, dur);
    }

    function reactToChoice(quality) {
        if (quality === 'good') {
            setCheering();
        } else if (quality === 'bad') {
            setSad();
        } else {
            setIdle();
        }
    }

    // --- Render Loop ---
    function animate() {
        animationFrameId = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        if (mixer) mixer.update(delta);
        if (model) {
            model.rotation.y += (targetModelRotationY - model.rotation.y) * 0.08;
        }
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    }

    // --- Cleanup ---
    function dispose() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (reactionTimeout) clearTimeout(reactionTimeout);
        if (renderer && renderer.domElement && renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
            renderer.dispose();
        }
        if (scene) {
            scene.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                    mats.forEach(m => {
                        if (m.map) m.map.dispose();
                        m.dispose();
                    });
                }
            });
        }
    }

    // --- Public API ---
    return {
        init,
        resize,
        setTalking,
        setIdle,
        setSad,
        setCheering,
        reactToChoice,
        playAnimation,
        get isLoaded() { return isLoaded; },
        get currentAnimation() { return currentAnimName; },
        dispose
    };
})();
