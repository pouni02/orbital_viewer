import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

// Textures
import earthDayMapImg from "../assets/earth_daymap.jpg";
import earthNormalMapImg from "../assets/earth_normal.jpg";
import earthSpecularMapImg from "../assets/earth_specular.jpg";
import earthFlatMapImg from "../assets/earth_flat.jpg";

// JSON Impact
import impactData from "../assets/impactData.json";

export default function AsteroidImpact({ impactDistance = 0.55 }) {
  const mountRef = useRef(null);
  const [impact, setImpact] = useState(false);
  const [flatView, setFlatView] = useState(false); // pour vue Terre plate

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1, 3);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;

    // Lumières
    const pointLight = new THREE.PointLight(0xffffff, 5);
    pointLight.position.set(2, 2, 3);
    scene.add(pointLight);
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));

    const loader = new THREE.TextureLoader();
    const earthDayMap = loader.load(earthDayMapImg);
    const earthNormalMap = loader.load(earthNormalMapImg);
    const earthSpecularMap = loader.load(earthSpecularMapImg);
    const earthFlatMap = loader.load(earthFlatMapImg);

    // 🌍 Terre sphérique
    const earthGeometry = new THREE.SphereGeometry(0.5, 64, 64);
    const earthMaterial = new THREE.MeshPhongMaterial({
      map: earthDayMap,
      normalMap: earthNormalMap,
      specularMap: earthSpecularMap,
      shininess: 15,
    });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earth);

    // ☄️ Météorite
    const asteroidGeometry = new THREE.SphereGeometry(0.08, 32, 32);
    const asteroidMaterial = new THREE.MeshPhongMaterial({ color: 0x999999 });
    const asteroid = new THREE.Mesh(asteroidGeometry, asteroidMaterial);
    asteroid.position.set(-2, 0.2, 0);
    scene.add(asteroid);

    // Vitesse proportionnelle à l’énergie
    const energy = impactData.asteroid.impactEnergy;
    const baseVelocity = 0.02;
    const velocityFactor = Math.cbrt(energy) / 1e6;
    const velocity = new THREE.Vector3(baseVelocity * velocityFactor, -0.002, 0);

    // 💥 Effets d’impact
    const impactGroup = new THREE.Group();
    scene.add(impactGroup);

    function createExplosion(pos) {
      const explosionColor = new THREE.Color(0xff6600);
      const smokeColor = new THREE.Color(0x222222);

      for (let i = 0; i < 80; i++) {
        const t = i / 80;
        const color = explosionColor.clone().lerp(smokeColor, t);
        const fragment = new THREE.Mesh(
          new THREE.SphereGeometry(0.02 + Math.random() * 0.015, 8, 8),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 - t * 0.8 })
        );
        fragment.position.copy(pos);
        fragment.userData = {
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.25,
            (Math.random() - 0.5) * 0.25,
            (Math.random() - 0.5) * 0.25
          ),
        };
        impactGroup.add(fragment);
      }

      const fireball = new THREE.PointLight(0xffaa33, 3, 3);
      fireball.position.copy(pos);
      impactGroup.add(fireball);
    }

    // Animation
    let exploded = false;
    let paused = false;

    function animate() {
      if (paused) return;

      requestAnimationFrame(animate);
      controls.update();

      if (!impact) {
        asteroid.position.add(velocity);
        const distance = asteroid.position.length();

        if (distance <= impactDistance && !exploded) {
          setImpact(true);
          createExplosion(asteroid.position.clone());
          exploded = true;
          scene.remove(asteroid);

          // Stop rotation Terre et mettre pause
          paused = true;
          setTimeout(() => {
            // Switch vers vue plate
            setFlatView(true);

            // Remplacer Terre sphérique par Terre plate
            scene.remove(earth);
            const flatGeometry = new THREE.PlaneGeometry(4, 2);
            const flatMaterial = new THREE.MeshBasicMaterial({ map: earthFlatMap });
            const flatEarth = new THREE.Mesh(flatGeometry, flatMaterial);

            // Zoom sur coordonnées impact
            const lon = impactData.asteroid.longitude; // degrés
            const lat = impactData.asteroid.latitude; // degrés
            const x = (lon / 180) * 2; // ajustement selon plane width
            const y = (lat / 90) * 1; // plane height 2 -> y = ±1
            flatEarth.position.set(x, y, 0);
            scene.add(flatEarth);
          }, 1000); // pause 1s avant la vue plate
        }
      }

      impactGroup.children.forEach((frag) => {
        if (frag.isMesh) {
          frag.position.add(frag.userData.velocity);
          frag.userData.velocity.multiplyScalar(0.96);
          frag.material.opacity = Math.max(frag.material.opacity - 0.02, 0);
        }
        if (frag.isPointLight) {
          frag.intensity *= 0.95;
        }
      });

      if (!flatView) earth.rotation.y += 0.002;

      renderer.render(scene, camera);
    }

    animate();

    // Resize
    const handleResize = () => {
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [impactDistance]);

  return (
    <div ref={mountRef} style={{ width: "100%", height: "100vh", background: "black", position: "relative" }}>
      {impact && !flatView && (
        <div style={{ position: "absolute", top: "20px", left: "20px", color: "orange", fontWeight: "bold", fontSize: "1.2em", textShadow: "0 0 10px #ff6600" }}>
          💥 Impact détecté !
        </div>
      )}
      {flatView && (
        <div style={{ position: "absolute", top: "20px", left: "20px", color: "cyan", fontWeight: "bold", fontSize: "1.2em", textShadow: "0 0 10px #00ffff" }}>
          📍 Coordonnées impact : {impactData.asteroid.latitude}°, {impactData.asteroid.longitude}°
        </div>
      )}
    </div>
  );
}
