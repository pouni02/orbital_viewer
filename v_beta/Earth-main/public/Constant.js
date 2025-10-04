import * as THREE from '/build/three.module.js';

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


// ---- Clouds ----
const cloudGeometry = new THREE.SphereGeometry(0.63, 64, 64);
const cloudMaterial = new THREE.MeshPhongMaterial({
  map: textureLoader.load('/texture/earthCloud.png'),
  transparent: true
});
const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);

// ---- Stars ----
const starGeometry = new THREE.SphereGeometry(80, 64, 64);
const starMaterial = new THREE.MeshBasicMaterial({
  map: textureLoader.load('/texture/galaxy.png'),
  side: THREE.BackSide
});
const starMesh = new THREE.Mesh(starGeometry, starMaterial);


// ---- Asteroid réaliste (Option 3) ----
const asteroidGeometry = new THREE.DodecahedronGeometry(0.05, 1); // forme irrégulière
const asteroidMaterial = new THREE.MeshPhongMaterial({
  map: textureLoader.load('/texture/meteorite.jpg'),      // texture réaliste
  bumpMap: textureLoader.load('/texture/meteorite_bump.jpg'), // bump pour relief
  bumpScale: 0.02
});
const asteroidMesh = new THREE.Mesh(asteroidGeometry, asteroidMaterial);

export {cloudMesh, earthMesh, starMesh};