import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import GetTimeline from "./USER-IMPACTOR-001.json";

export default function AsteroidImpact({ scale = 10, impactDistance = 0.1 }) {
  const mountRef = useRef(null);
  const [impact, setImpact] = useState(false);

  useEffect(() => {
    if (!mountRef.current) return;

    // --- 🎬 INITIALISATION DE LA SCÈNE ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);

    // Lumière
    const light = new THREE.PointLight(0xffffff, 5);
    light.position.set(5, 5, 5);
    scene.add(light);

    // --- 🌍 TERRE ---
    const earthGeometry = new THREE.SphereGeometry(0.2, 32, 32);
    const earthMaterial = new THREE.MeshPhongMaterial({ color: 0x0088ff });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earth);

    // --- ☄️ ASTÉROÏDE ---
    const asteroidGeometry = new THREE.SphereGeometry(0.05, 16, 16);
    const asteroidMaterial = new THREE.MeshPhongMaterial({ color: 0xffee00 });
    const asteroid = new THREE.Mesh(asteroidGeometry, asteroidMaterial);
    scene.add(asteroid);

    // --- 🔄 TIMELINE ---
    const timeline = GetTimeline?.timeline?.map((imp) => imp.heliocentric?.r_au);
    if (!timeline || timeline.length === 0) {
      console.warn("⚠️ Aucune donnée dans le JSON USER-IMPACTOR-001.json");
      return;
    }

    // --- 📈 ORBITE VISUELLE (trajectoire de l'astéroïde) ---
    const orbitPoints = timeline.map(
      (p) => new THREE.Vector3(p.x_au * scale, p.y_au * scale, p.z_au * scale)
    );
    const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 });
    const orbitLine = new THREE.Line(orbitGeometry, orbitMaterial);
    scene.add(orbitLine);

    // --- 🧭 VARIABLES D’ANIMATION ---
    let frame = 0;
    const totalFrames = timeline.length;
    const earthPos = new THREE.Vector3(0, 0, 0);

    // --- 💥 EFFET D’IMPACT ---
    const impactGroup = new THREE.Group();
    scene.add(impactGroup);

    function createExplosion(pos) {
      for (let i = 0; i < 20; i++) {
        const fragment = new THREE.Mesh(
          new THREE.CylinderGeometry(0.005, 0.02, 0.5, 6),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(`hsl(${Math.random() * 360},100%,50%)`),
          })
        );
        fragment.position.copy(pos);
        fragment.rotation.set(Math.random(), Math.random(), Math.random());
        impactGroup.add(fragment);
      }
    }

    // --- 🕹️ ANIMATION ---
    function animate() {
      requestAnimationFrame(animate);

      if (frame < totalFrames && !impact) {
        const pos = timeline[frame];
        if (pos) {
          asteroid.position.set(pos.x_au * scale, pos.y_au * scale, pos.z_au * scale);

          // Vérifie distance à la Terre
          const distance = asteroid.position.distanceTo(earthPos);
          if (distance < impactDistance) {
            console.log("💥 Impact détecté !");
            setImpact(true);
            createExplosion(asteroid.position.clone());
          }
        }
        frame++;
      }

      // Effet d'explosion léger : les fragments s'éloignent
      impactGroup.children.forEach((frag) => {
        frag.translateY(Math.random() * 0.02);
        frag.translateX(Math.random() * 0.01);
      });

      renderer.render(scene, camera);
    }

    animate();

    // --- 🔧 RESIZE ---
    const handleResize = () => {
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    // --- 🧹 CLEANUP ---
    return () => {
      window.removeEventListener("resize", handleResize);
      if (mountRef.current && mountRef.current.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [scale, impactDistance]);

  return (
    <div
      ref={mountRef}
      style={{ width: "100%", height: "100%", background: "black", position: "relative" }}
    >
      {impact && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            color: "yellow",
            fontWeight: "bold",
          }}
        >
          💥 Impact détecté !
        </div>
      )}
    </div>
  );
}
