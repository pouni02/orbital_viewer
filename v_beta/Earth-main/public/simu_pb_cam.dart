import * as THREE from '/build/three.module.js';
import { OrbitControls } from '/jsm/controls/OrbitControls.js';
import Stats from '/jsm/libs/stats.module.js';

// ---- Variables globales ----
let scene, camera, renderer;
const canvas = document.querySelector('.webgl');

// ---- Scene ----
scene = new THREE.Scene();

// ---- Camera ----
camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 2);
scene.add(camera);

// ---- Renderer ----
renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.autoClear = false;
renderer.setClearColor(0x000000, 0.0);

// ---- Controls ----
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// ---- Textures ----
const textureLoader = new THREE.TextureLoader();

// ---- Earth ----
const earthGeometry = new THREE.SphereGeometry(0.6, 64, 64);
const earthMaterial = new THREE.MeshPhongMaterial({
  map: textureLoader.load('/texture/earthmap1k.jpg'),
  bumpMap: textureLoader.load('/texture/earthbump.jpg'),
  bumpScale: 0.3
});
const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
scene.add(earthMesh);

// ---- Clouds ----
const cloudGeometry = new THREE.SphereGeometry(0.63, 64, 64);
const cloudMaterial = new THREE.MeshPhongMaterial({
  map: textureLoader.load('/texture/earthCloud.png'),
  transparent: true
});
const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
scene.add(cloudMesh);

// ---- Stars ----
const starGeometry = new THREE.SphereGeometry(80, 64, 64);
const starMaterial = new THREE.MeshBasicMaterial({
  map: textureLoader.load('/texture/galaxy.png'),
  side: THREE.BackSide
});
const starMesh = new THREE.Mesh(starGeometry, starMaterial);
scene.add(starMesh);

// ---- Lights ----
scene.add(new THREE.AmbientLight(0xffffff, 0.25));
const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(5, 3, 5);
scene.add(pointLight);

// ---- Stats ----
const stats = Stats();
document.body.appendChild(stats.dom);

// ---- Asteroid ----
const asteroidMaterial = new THREE.MeshPhongMaterial({ color: 0x888888 });
const asteroidGeometry = new THREE.SphereGeometry(0.05, 16, 16);
const asteroidMesh = new THREE.Mesh(asteroidGeometry, asteroidMaterial);
scene.add(asteroidMesh);
resetAsteroid();

let stopRotation = false;

// ---- UI ----
const uiContainer = document.createElement('div');
uiContainer.style.position = 'absolute';
uiContainer.style.top = '10px';
uiContainer.style.left = '10px';
uiContainer.style.background = 'rgba(0,0,0,0.5)';
uiContainer.style.padding = '10px';
uiContainer.style.borderRadius = '5px';
uiContainer.style.color = 'white';
document.body.appendChild(uiContainer);

uiContainer.innerHTML = `
<label>Asteroid Diameter (km)
  <input type="range" id="diameter" min="0.1" max="10" step="0.1" value="1">
  <span id="diameterValue">1 km</span>
</label>
<br>
<label>Asteroid Velocity (km/s)
  <input type="range" id="velocity" min="5" max="50" value="20">
  <span id="velocityValue">20 km/s</span>
</label>
<br>
<button id="simulate">Simulate Impact</button>
<button id="resetBtn" disabled>Reset</button>
<div id="impact-info"></div>
`;

const diameterInput = document.getElementById('diameter');
const velocityInput = document.getElementById('velocity');
const simulateBtn = document.getElementById('simulate');
const resetBtn = document.getElementById('resetBtn');
const impactInfo = document.getElementById('impact-info');
const diameterValue = document.getElementById('diameterValue');
const velocityValue = document.getElementById('velocityValue');

// ---- Listeners ----
simulateBtn.addEventListener('click', () => {
  simulateBtn.disabled = true;
  diameterInput.disabled = true;
  velocityInput.disabled = true;
  resetBtn.disabled = false;
  selectImpactPoint();
});

resetBtn.addEventListener('click', () => {
  stopRotation = false;
  simulateBtn.disabled = false;
  diameterInput.disabled = false;
  velocityInput.disabled = false;
  resetBtn.disabled = true;
  impactInfo.innerHTML = '';
  resetAsteroid();
  camera.position.set(0, 0, 2);
  controls.update();
});

diameterInput.addEventListener('input', () => {
  const d = parseFloat(diameterInput.value);
  diameterValue.textContent = `${d.toFixed(1)} km`;
  const scale = d / 10;
  asteroidMesh.scale.set(scale, scale, scale);
});

velocityInput.addEventListener('input', () => {
  const v = parseFloat(velocityInput.value);
  velocityValue.textContent = `${v.toFixed(0)} km/s`;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Asteroid ----
function resetAsteroid() {
  asteroidMesh.position.set(1.5, 0, 0);
  asteroidMesh.scale.set(1, 1, 1);
  scene.add(asteroidMesh);
}

// ---- Selection du point ----
function selectImpactPoint() {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function onClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(earthMesh);
    if (intersects.length > 0) {
      const impactPoint = intersects[0].point.clone();
      simulateImpact(impactPoint);
      window.removeEventListener('click', onClick);
    }
  }

  window.addEventListener('click', onClick);
}

// ---- Simulation de l'impact ----
function simulateImpact(impactPoint) {
  stopRotation = false;
  const diameterKm = parseFloat(diameterInput.value);
  const scale = diameterKm / 10;
  asteroidMesh.scale.set(scale, scale, scale);

  // --- Calcul des points de trajectoire ---
  const direction = impactPoint.clone().normalize().negate();
  const distance = 3;
  const startPoint = direction.clone().multiplyScalar(distance);

  const midDir = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0,1,0)).normalize();
  const controlPoint = new THREE.Vector3()
    .addVectors(startPoint, impactPoint)
    .multiplyScalar(0.5)
    .add(midDir.multiplyScalar(distance * 0.5));

  const duration = 4000;
  const startTime = performance.now();

  function moveAsteroid(now) {
    const t = Math.min((now - startTime) / duration, 1);

    // Quadratic Bézier
    const pos = new THREE.Vector3()
      .addScaledVector(startPoint, (1-t)*(1-t))
      .addScaledVector(controlPoint, 2*(1-t)*t)
      .addScaledVector(impactPoint, t*t);
    asteroidMesh.position.copy(pos);

    // --- Caméra suit trajectoire ---
    const camOffset = new THREE.Vector3(0.3, 0.2, 0.3);
    camera.position.lerpVectors(camera.position, pos.clone().add(camOffset), 0.1);
    camera.lookAt(asteroidMesh.position);

    if (t < 1) {
      requestAnimationFrame(moveAsteroid);
    } else {
      stopRotation = true;
      showImpactEffect(impactPoint); // zoom final + flash
      scene.remove(asteroidMesh);
    }
  }

  requestAnimationFrame(moveAsteroid);
}

// ---- Effet d’impact ----
function showImpactEffect(impactPoint) {
  const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffdd00, transparent: true, opacity: 0.9 });
  const flashMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), flashMaterial);
  flashMesh.position.copy(impactPoint);
  scene.add(flashMesh);

  const zoomStart = performance.now();
  const startCamPos = camera.position.clone();
  const endCamPos = impactPoint.clone().add(new THREE.Vector3(0, 0, 0.6));

  function animateFlash(now) {
    const tZoom = Math.min((now - zoomStart) / 1000, 1);
    camera.position.lerpVectors(startCamPos, endCamPos, tZoom);
    camera.lookAt(impactPoint);

    flashMaterial.opacity = 0.9 * (1 - tZoom);
    flashMesh.scale.setScalar(0.3 * (1 + tZoom));

    if (tZoom < 1) requestAnimationFrame(animateFlash);
    else scene.remove(flashMesh);
  }
  requestAnimationFrame(animateFlash);
}

// ---- Animation principale ----
function animateLoop() {
  requestAnimationFrame(animateLoop);
  if (!stopRotation) {
    earthMesh.rotation.y += 0.0005;
    cloudMesh.rotation.y += 0.0007;
  }
  starMesh.rotation.y -= 0.0001;
  controls.update();
  renderer.render(scene, camera);
  stats.update();
}
animateLoop();
