/*
import * as THREE from './treejs/three.module.js';  // Correct relative path
import { OrbitControls } from './treejs/OrbitControls.js';  // Correct relative path
import { TransformControls } from './treejs/TransformControls.js';  // Correct relative path
import { STLLoader } from './treejs/STLLoader.js';  // Correct relative path
*/
import * as THREE from '/static/js/treejs/three.module.js';
import { OrbitControls } from '/static/js/treejs/OrbitControls.js';
import { TransformControls } from '/static/js/treejs/TransformControls.js';
import { STLLoader } from '/static/js/treejs/STLLoader.js';

let scene, camera, renderer, controls, raycaster, mouse;
let transformControl;
let selectedObject = null;
let currentMode = 'visualization';

init();
animate();

function init() {
    const container = document.getElementById('viewerContainer');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 1, 1).normalize();
    scene.add(light);

    // Camera setup
    setupCamera(container);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Orbit Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2;

    // Raycaster & mouse
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Load models from server
    loadModels();

    // Transform Controls setup
    setupTransformControls();

    // UI Mode Switching
    window.setTransformMode = setTransformMode;

    // Pointer event listener
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // Initialize UI button state
    updateButtonState(currentMode);
}

function setupCamera(container) {
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
}

function loadModels() {
    fetch('/get_model_data')  // Do not pass `id` to fetch all models
        .then(response => response.json())
        .then(models => {
            console.log("Models received:", models);

            models.forEach((modelData, index) => {
                const modelPath = modelData.model_path;
                console.log("Loading model:", modelPath);

                const loader = new STLLoader();
                loader.load(modelPath, (geometry) => {
                    geometry.computeVertexNormals();

                    const material = new THREE.MeshStandardMaterial({
                        color: 0x6699ff,
                        metalness: 0.1,
                        roughness: 0.6
                    });

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.scale.set(1, 1, 1);  // Scale model correctly
                    
                    // Use the position and rotation values from the database
                    mesh.position.set(
                        modelData.position.x,  // Set position from database
                        modelData.position.y,
                        modelData.position.z
                    );
                    
                    mesh.rotation.set(
                        THREE.MathUtils.degToRad(modelData.rotation.u),  // Convert degrees to radians
                        THREE.MathUtils.degToRad(modelData.rotation.v),
                        THREE.MathUtils.degToRad(modelData.rotation.w)
                    );

                    mesh.name = modelPath.split('/').pop();  // Set the model name based on the path

                    mesh.modelId = modelData.id;
                    scene.add(mesh);  // Add model to the scene

                    // Fit the view after models are loaded
                    if (index === models.length - 1) {
                        fitAllModelsInView();  // Adjust camera to fit all models
                    }
                }, undefined, (error) => {
                    console.error(`Error loading model at ${modelPath}:`, error);
                });
            });
        })
        .catch(error => {
            console.error('Error fetching model data:', error);
        });
}

function setupTransformControls() {
    transformControl = new TransformControls(camera, renderer.domElement);
    transformControl.addEventListener('dragging-changed', (event) => {
        controls.enabled = !event.value;
    });
    transformControl.addEventListener('change', () => {
        if (selectedObject) {
            updateModelInfoPanel(selectedObject);
        }
    });
}

function setTransformMode(mode) {
    currentMode = mode;
    const infoPanel = document.getElementById('model-info-panel');

    if (mode === 'visualization') {
        transformControl.detach();
        if (scene.children.includes(transformControl.getHelper())) {
            scene.remove(transformControl.getHelper());
        }
        selectedObject = null;
        clearModelInfoPanel();
        infoPanel.classList.add('hidden');
    } else {
        transformControl.setMode(mode);
        infoPanel.classList.remove('hidden');
    }

    updateButtonState(mode);
}

function updateButtonState(mode) {
    const buttons = {
        visualization: document.getElementById('visualization-button'),
        translate: document.getElementById('translate-button'),
        rotate: document.getElementById('rotate-button')
    };

    Object.keys(buttons).forEach(key => {
        buttons[key].classList.toggle('active', mode === key);
    });
}

function fitAllModelsInView() {
    // 1. Calculate the bounding box of all objects in the scene
    const box = new THREE.Box3();
    scene.traverse((obj) => {
        if (obj.isMesh) {
            obj.geometry.computeBoundingBox();
            // Apply world matrix to get correct bounding box in world space
            const objBox = obj.geometry.boundingBox.clone();
            objBox.applyMatrix4(obj.matrixWorld);
            box.union(objBox);
        }
    });

    if (box.isEmpty()) {
        console.warn("Bounding box is empty.");
        return;
    }

    // 2. Get the center and size of the bounding box
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    // 3. Calculate a zoom factor and camera position based on the size of the bounding box
    const margin = 1.2; // Add some margin around the bounding box
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * margin;

    // 4. Get the viewer container's dimensions
    const viewerWidth = window.innerWidth;  // or get the width of your viewer container
    const viewerHeight = window.innerHeight; // or get the height of your viewer container
    const aspect = viewerWidth / viewerHeight;

    // 5. Adjust frustum size to fill the screen based on aspect ratio
    const frustumSize = distance * 2;  // This is the total size of the view, relative to the bounding box size

    // Ensure the frustum is correctly sized for both width and height
    const frustumWidth = frustumSize * aspect;  // Width of the view based on aspect ratio
    const frustumHeight = frustumSize;  // Height of the view

    camera.left = -frustumWidth / 2;
    camera.right = frustumWidth / 2;
    camera.top = frustumHeight / 2;
    camera.bottom = -frustumHeight / 2;

    camera.near = 0.1;
    camera.far = 1000;
    camera.updateProjectionMatrix();

    // 6. Set camera position behind the center of the bounding box
    camera.position.set(center.x, center.y, center.z + distance);
    camera.lookAt(center);

    // 7. Update controls target
    controls.target.copy(center);
    controls.update();
}

function onPointerDown(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, false);

    if (intersects.length > 0 && currentMode !== 'visualization') {
        const object = intersects[0].object;
        if (object.isMesh) {
            selectedObject = object;
            transformControl.attach(selectedObject);
            updateModelInfoPanel(selectedObject);

            if (!scene.children.includes(transformControl.getHelper())) {
                scene.add(transformControl.getHelper());
            }

            transformControl.setMode(currentMode);
            updateButtonState(currentMode);
            
            // Update the hidden input with the selected model ID
            document.getElementById('model-id').value = object.modelId;
        }
    }
}

// Update the UI with the position and rotation of the selected object
function updateModelInfoPanel(object) {
    if (!object) return;

    // Update position fields
    const positions = ['pos-x', 'pos-y', 'pos-z'];
    positions.forEach((id, index) => {
        document.getElementById(id).value = object.position.toArray()[index].toFixed(3);
    });

    // Update rotation fields (in degrees)
    const euler = new THREE.Euler().setFromQuaternion(object.quaternion, 'XYZ');
    const rotations = ['rot-u', 'rot-v', 'rot-w'];
    rotations.forEach((id, index) => {
        document.getElementById(id).value = THREE.MathUtils.radToDeg(euler.toArray()[index]).toFixed(3);
    });
}

function clearModelInfoPanel() {
    ['pos-x', 'pos-y', 'pos-z', 'rot-u', 'rot-v', 'rot-w'].forEach(id => {
        document.getElementById(id).value = '';
    });
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    transformControl.update();
    renderer.render(scene, camera);
}

// This function should be in viewer.js, ensure it is loaded and in the global scope
function saveModelPosition() {
    // Get the current position and rotation from the inputs
    const posX = document.getElementById('pos-x').value;
    const posY = document.getElementById('pos-y').value;
    const posZ = document.getElementById('pos-z').value;
    const rotU = document.getElementById('rot-u').value;
    const rotV = document.getElementById('rot-v').value;
    const rotW = document.getElementById('rot-w').value;

    // Get the model ID from the hidden input field
    const modelId = document.getElementById('model-id').value;

    // Log the values being sent to ensure correctness
    console.log("Saving position for Model ID:", modelId);
    console.log("Position:", { x: posX, y: posY, z: posZ, u: rotU, v: rotV, w: rotW });

    // Ensure that the correct ID is being used
    if (!modelId || modelId === '1') {
        console.error('Model ID is not set or is defaulting to 1');
    }

    // Prepare the data to be sent in the request
    const data = {
        id: modelId,  // Send the correct model ID
        x: posX,
        y: posY,
        z: posZ,
        u: rotU,
        v: rotV,
        w: rotW
    };

    // Send the data to the backend via an AJAX POST request
    $.ajax({
        url: '/save_model_position',
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify(data),
        success: function(response) {
            if (response.success) {
                alert('Position saved successfully!');
            } else {
                alert('Failed to save model position.');
            }
        },
        error: function(error) {
            console.error('Error saving model position:', error);
            alert('Error saving model position.');
        }
    });
}

// Function to select a model and update the hidden input field
function selectModel(modelId) {
    // Set the model ID in the hidden input field
    document.getElementById('model-id').value = modelId;
    console.log("Model ID updated to:", modelId); // For debugging
}

// Function to update model position and rotation from input fields
function updateModelFromInput() {
    if (!selectedObject) return;  // Exit if no object is selected
    
    const posX = parseFloat(document.getElementById('pos-x').value);
    const posY = parseFloat(document.getElementById('pos-y').value);
    const posZ = parseFloat(document.getElementById('pos-z').value);
    
    const rotU = THREE.MathUtils.degToRad(parseFloat(document.getElementById('rot-u').value));  // Convert to radians
    const rotV = THREE.MathUtils.degToRad(parseFloat(document.getElementById('rot-v').value));  // Convert to radians
    const rotW = THREE.MathUtils.degToRad(parseFloat(document.getElementById('rot-w').value));  // Convert to radians

    // Update the selected object with new position and rotation
    selectedObject.position.set(posX, posY, posZ);
    selectedObject.rotation.set(rotU, rotV, rotW);
    
    // Optional: You can update the transform controls position and rotation as well
    transformControl.update();
}

// Add event listeners for the input fields
document.getElementById('pos-x').addEventListener('input', updateModelFromInput);
document.getElementById('pos-y').addEventListener('input', updateModelFromInput);
document.getElementById('pos-z').addEventListener('input', updateModelFromInput);

document.getElementById('rot-u').addEventListener('input', updateModelFromInput);
document.getElementById('rot-v').addEventListener('input', updateModelFromInput);
document.getElementById('rot-w').addEventListener('input', updateModelFromInput);

// Save 3d model position button
window.saveModelPosition = saveModelPosition;
