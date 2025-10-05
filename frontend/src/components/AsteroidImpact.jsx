import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

// ✅ Import des textures
import earthDayMapImg from "../assets/earth_daymap.jpg";
import earthNormalMapImg from "../assets/earth_normal.jpg";
import earthSpecularMapImg from "../assets/earth_specular.jpg";

export default function AsteroidImpact({ impactDistance = 0.55 }) {
  const mountRef = useRef(null);
  const [impact, setImpact] = useState(false);

  useEffect(() => {
    if (!mountRef.current) return;

    // --- 🌌 SCÈNE ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // --- 📸 CAMÉRA ---
    const camera = new THREE.PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1, 3);

    // --- 🎥 RENDERER ---
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
      mountRef.current.clientWidth,
      mountRef.current.clientHeight
    );
    mountRef.current.appendChild(renderer.domElement);

    // --- 🧭 CONTRÔLES ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;

    // --- ☀️ LUMIÈRES ---
    const light = new THREE.PointLight(0xffffff, 5); // plus lumineux
    light.position.set(2, 2, 3);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 1.5)); // ambient plus fort

    // --- 🌍 TERRE RÉALISTE ---
    const loader = new THREE.TextureLoader();
    const earthDayMap = loader.load(earthDayMapImg);
    const earthNormalMap = loader.load(earthNormalMapImg);
    const earthSpecularMap = loader.load(earthSpecularMapImg);

    const earthGeometry = new THREE.SphereGeometry(0.5, 64, 64);
    const earthMaterial = new THREE.MeshPhongMaterial({
      map: earthDayMap,
      normalMap: earthNormalMap,
      specularMap: earthSpecularMap,
      shininess: 15,
    });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earth);

    // --- ☄️ MÉTÉORITE ---
    const asteroidGeometry = new THREE.SphereGeometry(0.08, 32, 32);
    const asteroidMaterial = new THREE.MeshPhongMaterial({ color: 0x999999 });
    const asteroid = new THREE.Mesh(asteroidGeometry, asteroidMaterial);
    scene.add(asteroid);

    // Position de départ et vitesse
    asteroid.position.set(-2, 0.2, 0);
    const velocity = new THREE.Vector3(0.02, -0.002, 0);

    // --- 💥 EFFET D’IMPACT ---
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
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 1 - t * 0.8,
          })
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

    // --- 🔄 ANIMATION ---
    let exploded = false;

    function animate() {
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

      earth.rotation.y += 0.002;
      renderer.render(scene, camera);
    }

    animate();

    // --- 🧹 CLEANUP ---
    const handleResize = () => {
      camera.aspect =
        mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(
        mountRef.current.clientWidth,
        mountRef.current.clientHeight
      );
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
    <div
      ref={mountRef}
      style={{
        width: "100%",
        height: "100vh",
        background: "black",
        position: "relative",
      }}
    >
      {impact && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "20px",
            color: "orange",
            fontWeight: "bold",
            fontSize: "1.2em",
            textShadow: "0 0 10px #ff6600",
          }}
        >
          💥 Impact détecté !
        </div>
      )}
    </div>
  );
}
