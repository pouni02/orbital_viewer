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
const asteroidGeometry = new THREE.DodecahedronGeometry(0.05, 1);
const asteroidMaterial = new THREE.MeshPhongMaterial({
  map: textureLoader.load('/texture/meteorite.jpg'),
  bumpMap: textureLoader.load('/texture/meteorite_bump.jpg'),
  bumpScale: 0.02
});
const asteroidMesh = new THREE.Mesh(asteroidGeometry, asteroidMaterial);
scene.add(asteroidMesh);

// ---- Reset asteroide ----
function resetAsteroid() {
  asteroidMesh.position.set(1.5, 0, 0);
  asteroidMesh.scale.set(1, 1, 1);
  scene.add(asteroidMesh);
}
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

// ---- Échelle (Scale Bar) ----
const scaleContainer = document.createElement('div');
scaleContainer.style.position = 'absolute';
scaleContainer.style.bottom = '15px';
scaleContainer.style.left = '15px';
scaleContainer.style.color = 'white';
scaleContainer.style.fontSize = '14px';
scaleContainer.style.fontFamily = 'Arial, sans-serif';
document.body.appendChild(scaleContainer);

scaleContainer.innerHTML = `
  <div style="margin-bottom: 4px; font-weight: bold;">Échelle</div>
  <div style="display:flex; align-items:center; gap:6px;">
    <div id="scaleBar" style="width:100px; height:4px; background:white; border-radius:2px;"></div>
    <div id="scaleLabel">≈ 1000 km</div>
  </div>
  <div id="scaleMapping" style="font-size:12px; color:#ccc;">0.1 unité ≈ 1000 km</div>
`;

const bar = document.getElementById('scaleBar');
const label = document.getElementById('scaleLabel');
const mapping = document.getElementById('scaleMapping');

let kmPerUnit = 10000; // 1 unité = 10 000 km → 0.1 unité = 1000 km

function pixelLengthForWorldUnits(units) {
    // La distance caméra → Terre (zoom)
    const distance = camera.position.distanceTo(earthMesh.position);

    // Hauteur visible à cette distance
    const fov = camera.fov * (Math.PI / 180);
    const heightInWorld = 2 * Math.tan(fov / 2) * distance;

    const pixelPerUnit = window.innerHeight / heightInWorld;
    return units * pixelPerUnit;
}

function updateScaleBar() {
  const units = 0.1; // longueur de la barre = 0.1 unité
  const km = units * kmPerUnit;
  const px = pixelLengthForWorldUnits(units);
  bar.style.width = `${Math.max(8, Math.round(px))}px`;
  label.textContent = `≈ ${Math.round(km)} km`;
  mapping.textContent = `0.1 unité ≈ ${Math.round(km)} km`;
}
updateScaleBar();

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
  updateScaleBar();
});

// ---- Sélection du point d’impact ----
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

// ---- Simulation de l’impact ----
// Ton simulateImpact + showImpactEffect restent inchangés ici

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
  updateScaleBar(); // mise à jour dynamique en fonction du zoom uniquement
}

animateLoop();
