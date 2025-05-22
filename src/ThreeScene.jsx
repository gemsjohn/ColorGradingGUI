import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import ColorGradingGUI, { colorGradingShader } from './ColorGradingGUI.jsx';
import styles from './threeScene.module.css';

function ThreeScene() {
    const mountRef = useRef(null);
    const colorGradingPassRef = useRef(null);
    const [isColorGradingGUIOpen, setIsColorGradingGUIOpen] = useState(false);

    useEffect(() => {
        // Initialize scene, camera, and renderer
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        mountRef.current.appendChild(renderer.domElement);

        // Ground plane setup
        function pixelTexture(texture) {
            texture.minFilter = THREE.NearestFilter;
            texture.magFilter = THREE.NearestFilter;
            texture.generateMipmaps = false;
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.colorSpace = THREE.SRGBColorSpace;
            return texture;
        }
        const pixelTextureLoader = new THREE.TextureLoader();
        const texChecker = pixelTexture(pixelTextureLoader.load('./assets/checker.png'));
        texChecker.repeat.set(10, 10);
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshStandardMaterial({ map: texChecker, transparent: false, opacity: 1 });
        const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
        groundMesh.position.set(0, 0, 0);
        groundMesh.rotation.x = -Math.PI / 2;
        groundMesh.receiveShadow = true;
        scene.add(groundMesh);

        // GLTF model setup
        const gltfLoader = new GLTFLoader();
        gltfLoader.load(
            './assets/tv_face.glb',
            (gltf) => {
                const model = gltf.scene;
                model.position.set(0, 1.5, 0); // Positioned above ground, matching cube's height
                model.rotation.y = Math.PI; // 180 degrees in radians
                model.castShadow = true; // Enable shadow casting
                model.receiveShadow = true; // Enable shadow receiving (optional, depending on model)
                
                // Traverse the model to ensure all meshes cast and receive shadows
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                scene.add(model);
            },
            undefined,
            (error) => {
                console.error('Error loading GLTF model:', error);
            }
        );

        // Lighting
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xb5e48c, 1);
        scene.add(hemisphereLight);

        const topLightt = new THREE.SpotLight(0x2f9bff, 2000);
        topLightt.target.position.set(0, 0, 0);
        topLightt.position.set(0, 20, 0);
        scene.add(topLightt);
        scene.add(topLightt.target);

        const backLight = new THREE.SpotLight(0xffffff, 500);
        backLight.penumbra = 0.3;
        backLight.position.set(-2, 10, -10);
        scene.add(backLight);

        const fillLight = new THREE.SpotLight(0xffffff, 200);
        fillLight.penumbra = 0.3;
        fillLight.position.set(5, 5, 5);
        fillLight.castShadow = true;
        fillLight.shadow.camera.near = 8;
        fillLight.shadow.camera.far = 50;
        fillLight.shadow.mapSize.width = 1024;
        fillLight.shadow.mapSize.height = 1024;
        fillLight.target.position.set(0, 3, 0);
        scene.add(fillLight);
        scene.add(fillLight.target);

        // Camera setup
        camera.position.set(5, 5, 5);
        const lookAtPoint = new THREE.Vector3(0, 1.5, 0); // Adjusted to model height
        camera.lookAt(lookAtPoint);

        // OrbitControls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.rotateSpeed = 1.0;
        controls.zoomSpeed = 1.2;
        controls.maxPolarAngle = Math.PI / 1.5;
        controls.minDistance = 10;
        controls.maxDistance = 70;
        controls.enablePan = true;
        controls.target.copy(lookAtPoint);

        // Post-processing with EffectComposer
        const composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);
        const colorGradingPass = new ShaderPass(colorGradingShader);
        composer.addPass(colorGradingPass);
        colorGradingPassRef.current = colorGradingPass;

        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate);
            controls.update();
            composer.render();
        };
        animate();

        // Handle window resize
        const handleResize = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            composer.setSize(width, height);
        };
        window.addEventListener('resize', handleResize);

        // Cleanup on unmount
        return () => {
            window.removeEventListener('resize', handleResize);
            mountRef.current.removeChild(renderer.domElement);
        };
    }, []);

    return (
        <div
            ref={mountRef}
            style={{
                width: '100vw',
                height: '100vh',
                position: 'fixed',
                top: 0,
                left: 0,
                margin: 0,
                padding: 0,
                overflow: 'hidden',
            }}
        >
            <button
                onClick={() => setIsColorGradingGUIOpen(!isColorGradingGUIOpen)}
                className={styles.selectBtn}
                style={{
                    position: 'absolute',
                    top: '50px',
                    right: '30px',
                    zIndex: 10,
                    fontSize: '10px',
                }}
            >
                Color Grading
            </button>
            {isColorGradingGUIOpen && colorGradingPassRef.current && (
                <div
                    style={{
                        position: 'absolute',
                        top: '0px',
                        right: '10px',
                        zIndex: 10,
                    }}
                >
                    <ColorGradingGUI colorGradingPass={colorGradingPassRef.current} />
                </div>
            )}
        </div>
    );
}

export default ThreeScene;