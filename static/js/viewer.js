/*
import * as THREE from './treejs/three.module.js';  // Correct relative path
import { OrbitControls } from './treejs/OrbitControls.js';  // Correct relative path
import { TransformControls } from './treejs/TransformControls.js';  // Correct relative path
import { STLLoader } from './treejs/STLLoader.js';  // Correct relative path
*/
import * as THREE from '/static/js/treejs/three.module.js';  // Correct relative path
import { OrbitControls } from '/static/js/treejs/OrbitControls.js';  // Correct relative path
import { TransformControls } from '/static/js/treejs/TransformControls.js';  // Correct relative path
import { STLLoader } from '/static/js/treejs/STLLoader.js';  // Correct relative path

let scene, camera, renderer, controls, raycaster, mouse;
let transformControl;
let selectedObject = null;
let currentMode = 'visualization';  // Default to 'visualization' mode
let isModeSelected = false; // Flag to track if a mode button is selected

init();
animate();

function init() {
    const container = document.getElementById('viewerContainer');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Orthographic Camera Setup
    const aspect = container.clientWidth / container.clientHeight;
    const frustumSize = 200;
    camera = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        -frustumSize / 2,
        0.1,
        1000
    );

    camera.position.set(0, 100, 200);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2;

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 1, 1).normalize();
    scene.add(light);

    // Load models using STLLoader
    const loader = new STLLoader();
    const modelPaths = [
        '/static/3D_models/Clock_Cap_01.stl',
        '/static/3D_models/Clock_Front_Cover_03.stl'
    ];

    modelPaths.forEach((path, index) => {
        loader.load(path, geometry => {
            console.log(`Loaded: ${path}`);

            geometry.computeVertexNormals();
            const material = new THREE.MeshStandardMaterial({
                color: 0x6699ff,
                metalness: 0.1,
                roughness: 0.6
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.scale.set(0.1, 0.1, 0.1);
            mesh.position.set(index * 50, 0, 0);
            mesh.name = path.split('/').pop();
            scene.add(mesh);
        },
        undefined,
        error => {
            console.error(`Error loading ${path}:`, error);
        });
    });

    // Initialize TransformControls (do not add to scene yet)
    transformControl = new TransformControls(camera, renderer.domElement);
    transformControl.addEventListener('dragging-changed', function (event) {
        controls.enabled = !event.value;  // Disable orbit controls while dragging
    });

    // UI buttons to switch between Translate, Rotate, and Visualization mode
    window.setTransformMode = function (mode) {
        currentMode = mode;  // Store the selected mode
        isModeSelected = true; // Mark a mode button is selected

        // Hide or show the transform control based on mode
        if (mode === 'visualization') {
            // Hide the transform control and helper
            transformControl.detach();
            if (scene.children.includes(transformControl.getHelper())) {
                scene.remove(transformControl.getHelper());
            }
        } else {
            transformControl.setMode(mode);
            updateButtonState(mode);
        }

        updateButtonState(mode); // Update button state to highlight the selected button
    };

    // Mouse click to select object
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // Listen for changes in dragging state to disable OrbitControls during transform
    transformControl.addEventListener('dragging-changed', function (event) {
        controls.enabled = !event.value; // Disable orbit controls while dragging transform controls
    });

    // Highlight default mode on page load
    updateButtonState(currentMode);
}

// Function to handle mouse clicks or interactions
function onPointerDown(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = - ((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Check if a model was clicked
    const intersects = raycaster.intersectObjects(scene.children, false);

    if (intersects.length > 0 && currentMode !== 'visualization') {
        const object = intersects[0].object;

        if (object.isMesh) {
            selectedObject = object;

            transformControl.attach(selectedObject);

            // Add transformControl helper to scene if not already present
            if (!scene.children.includes(transformControl.getHelper())) {
                scene.add(transformControl.getHelper());
            }

            // Apply the last selected mode to the object
            transformControl.setMode(currentMode);
            updateButtonState(currentMode);

            return;
        }
    }

    // ✅ New: Check if clicked on transformControl (gizmo arrows)
    const gizmoIntersects = raycaster.intersectObject(transformControl, true);

    if (gizmoIntersects.length > 0) {
        // Clicked on a compass arrow — do NOT detach
        return;
    }

    // ❌ Clicked empty space — remove the transform control
    selectedObject = null;
    transformControl.detach();

    // Optionally: remove the helper from the scene too
    if (scene.children.includes(transformControl.getHelper())) {
        scene.remove(transformControl.getHelper());
    }
}

// Function to update the button state (highlight the selected button)
function updateButtonState(mode) {
    const visualizationButton = document.getElementById('visualization-button');
    const translateButton = document.getElementById('translate-button');
    const rotateButton = document.getElementById('rotate-button');

    // Update button highlights based on the current mode
    if (mode === 'visualization') {
        visualizationButton.classList.add('active');
        translateButton.classList.remove('active');
        rotateButton.classList.remove('active');
    } else if (mode === 'translate') {
        translateButton.classList.add('active');
        rotateButton.classList.remove('active');
        visualizationButton.classList.remove('active');
    } else if (mode === 'rotate') {
        rotateButton.classList.add('active');
        translateButton.classList.remove('active');
        visualizationButton.classList.remove('active');
    }
}

// Animation loop remains the same
function animate() {
    requestAnimationFrame(animate);
    controls.update(); // Update OrbitControls (for camera)
    transformControl.update(); // Update TransformControls (for the selected object)
    renderer.render(scene, camera);
}
