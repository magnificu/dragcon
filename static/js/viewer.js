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
    scene.background = null;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(0, 1, 1).normalize();
    scene.add(light);

    // Camera setup
    setupCamera(container);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
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
    // Fetch model data from the server
    fetch('/get_model_data')
        .then(response => response.json())  // response as JSON
        .then(models => {
            // Create an array of promises, each loading a model
            const loaders = models.map(modelData => new Promise((resolve, reject) => {
                const loader = new STLLoader();

                // Load the STL file geometry
                loader.load(modelData.model_path, geometry => {
                    geometry.computeVertexNormals();  // Improve lighting by computing normals

                    // Create material for the mesh
                    const material = new THREE.MeshStandardMaterial({
                        color: 0x6699ff,
                        metalness: 0.1,
                        roughness: 0.6
                    });

                    // Create mesh from geometry and material
                    const mesh = new THREE.Mesh(geometry, material);

                    // Apply scale (default 1)
                    mesh.scale.set(1, 1, 1);

                    // Set mesh position from model data
                    mesh.position.set(
                        modelData.position.x,
                        modelData.position.y,
                        modelData.position.z
                    );

                    // Set mesh rotation from model data (degrees to radians)
                    mesh.rotation.set(
                        THREE.MathUtils.degToRad(modelData.rotation.u),
                        THREE.MathUtils.degToRad(modelData.rotation.v),
                        THREE.MathUtils.degToRad(modelData.rotation.w)
                    );

                    // Name the mesh based on the filename
                    mesh.name = modelData.model_path.split('/').pop();

                    // Store model ID for reference
                    mesh.modelId = modelData.id;

                    // Add the mesh to the scene
                    scene.add(mesh);

                    resolve(mesh);  // Resolve the promise once loaded
                }, undefined, reject);  // Reject promise on error
            }));

            // Wait until all models have loaded, then fit them all into view
            Promise.all(loaders).then(() => {
                fitAllModelsInView();
            }).catch(error => {
                console.error('Error loading models:', error);
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

// DEBUG: fitAllModelsInView
// Displays a small red sphere to mark the center of the bounding box
let centerBoxMarker = null;
let boundingBoxHelper = null;
 
function showCenterBoxMarker(position) {
  if (centerBoxMarker) {
    // Remove previous marker and dispose resources
    scene.remove(centerBoxMarker);
    centerBoxMarker.geometry.dispose();
    centerBoxMarker.material.dispose();
    centerBoxMarker = null;
  }

  // Create a small red sphere geometry
  const geometry = new THREE.SphereGeometry(2, 16, 16);  // radius 2, detail 16x16
  const material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // red color

  // Create mesh and position it at the given point
  centerBoxMarker = new THREE.Mesh(geometry, material);
  centerBoxMarker.position.copy(position);

  // Add marker
  scene.add(centerBoxMarker);
}

// DEBUG: fitAllModelsInView
// Creates and displays a red wireframe box around the models
function showBoundingBox(box) {
  if (boundingBoxHelper) {
    // Remove previous helper and resources
    scene.remove(boundingBoxHelper);
    boundingBoxHelper.geometry.dispose();
    boundingBoxHelper.material.dispose();
    boundingBoxHelper = null;
  }

  // Get size of the bounding box
  const size = box.getSize(new THREE.Vector3());

  // Create box geometry matching the bounding box size
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);

  // Create edges geometry for wireframe outline
  const edges = new THREE.EdgesGeometry(geometry);
  const material = new THREE.LineBasicMaterial({ color: 0xff0000 }); // red wireframe

  // Create line segments mesh for wireframe
  boundingBoxHelper = new THREE.LineSegments(edges, material);

  // Position the wireframe at the center of the bounding box
  const center = box.getCenter(new THREE.Vector3());
  boundingBoxHelper.position.copy(center);

  // Add wireframe helper
  scene.add(boundingBoxHelper);
}

// Fits all mesh models in the scene and camera view
function fitAllModelsInView() {
    scene.updateMatrixWorld(true);

    let box = null;

    scene.traverse(obj => {
        if (obj.isMesh) {
            if (!obj.geometry.boundingBox) {
                obj.geometry.computeBoundingBox();
            }

            const geomBox = obj.geometry.boundingBox.clone();
            geomBox.applyMatrix4(obj.matrixWorld);

            if (box === null) {
                box = geomBox.clone();
            } else {
                box.union(geomBox);
            }
        }
    });

    if (!box || box.isEmpty()) {
        console.warn("Bounding box is empty or no meshes found.");
        return;
    }

    // DEBUG: Show red bounding box wireframe around all models
    // showBoundingBox(box);

    const center = box.getCenter(new THREE.Vector3());
    
    // DEBUG: Show center of the red bounding box wireframe
    // showCenterBoxMarker(center);
    
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const margin = 1.2; // margin around bounding box

    const container = document.getElementById('viewerContainer');
    const viewerWidth = container.clientWidth;
    const viewerHeight = container.clientHeight;
    const aspect = viewerWidth / viewerHeight;

    // Calculate frustum size with margin
    let frustumHeight = maxDim * margin;
    let frustumWidth = frustumHeight * aspect;

    if (aspect < 1) {
        frustumWidth = maxDim * margin;
        frustumHeight = frustumWidth / aspect;
    }

    // Update orthographic camera frustum
    camera.left = -frustumWidth / 2;
    camera.right = frustumWidth / 2;
    camera.top = frustumHeight / 2;
    camera.bottom = -frustumHeight / 2;

    // Position camera at some distance along positive Z axis looking at center
    // Distance formula: move far enough so entire bounding box fits inside frustum
    // For orthographic camera, distance can be based on maxDim * factor
    const cameraDistance = maxDim * margin * 2;

    camera.position.set(center.x, center.y, center.z + cameraDistance);
    camera.near = cameraDistance / 100; // adjust near/far based on cameraDistance
    camera.far = cameraDistance * 4;
    camera.updateProjectionMatrix();

    camera.lookAt(center);

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
