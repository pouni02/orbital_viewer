import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

export default function OrbitVisualizer() {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // === Scene setup ===
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 5, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
      mountRef.current.clientWidth,
      mountRef.current.clientHeight
    );
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // === Lights ===
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    const pointLight = new THREE.PointLight(0xffffff, 2, 100);
    pointLight.position.set(0, 0, 0);
    scene.add(ambientLight, pointLight);

    // === Sun ===
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    scene.add(sun);

    // === Planets configuration ===
    const planetData = [
      { name: "Mercury", radius: 1.2, size: 0.07, color: 0xaaaaaa, speed: 0.04 },
      { name: "Venus", radius: 1.8, size: 0.09, color: 0xffcc66, speed: 0.03 },
      { name: "Earth", radius: 2.4, size: 0.1, color: 0x3399ff, speed: 0.025 },
      { name: "Mars", radius: 3.0, size: 0.08, color: 0xff6633, speed: 0.022 },
      { name: "Jupiter", radius: 4.2, size: 0.3, color: 0xff9966, speed: 0.012 },
      { name: "Saturn", radius: 5.5, size: 0.25, color: 0xffcc99, speed: 0.009 },
      { name: "Uranus", radius: 6.7, size: 0.2, color: 0x66ffff, speed: 0.007 },
      { name: "Neptune", radius: 8.0, size: 0.18, color: 0x3366ff, speed: 0.005 },
    ];

    // === Create orbits & planets ===
    const planets = [];
    planetData.forEach((data) => {
      // Orbit ring
      const orbit = new THREE.RingGeometry(data.radius - 0.01, data.radius + 0.01, 64);
      const orbitMaterial = new THREE.MeshBasicMaterial({
        color: 0x444444,
        side: THREE.DoubleSide,
      });
      const orbitMesh = new THREE.Mesh(orbit, orbitMaterial);
      orbitMesh.rotation.x = Math.PI / 2;
      scene.add(orbitMesh);

      // Planet mesh
      const planet = new THREE.Mesh(
        new THREE.SphereGeometry(data.size, 32, 32),
        new THREE.MeshStandardMaterial({ color: data.color })
      );
      planet.position.set(data.radius, 0, 0);
      scene.add(planet);

      // Add label
      const div = document.createElement("div");
      div.style.position = "absolute";
      div.style.color = "#fff";
      div.style.fontSize = "12px";
      div.innerHTML = data.name;
      document.body.appendChild(div);

      planets.push({ ...data, mesh: planet, label: div, angle: Math.random() * Math.PI * 2 });
    });

    // === Animation ===
    const clock = new THREE.Clock();

    const animate = () => {
      requestAnimationFrame(animate);

      const delta = clock.getDelta();
      planets.forEach((planet) => {
        // Update orbital angle
        planet.angle += planet.speed * delta * 60;
        planet.mesh.position.set(
          Math.cos(planet.angle) * planet.radius,
          0,
          Math.sin(planet.angle) * planet.radius
        );

        // Optional: self-rotation
        planet.mesh.rotation.y += 0.02;

        // Update label position
        const vector = planet.mesh.position.clone().project(camera);
        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
        planet.label.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
      });

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // === Resize handler ===
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
      mountRef.current?.removeChild(renderer.domElement);
      planets.forEach((p) => document.body.removeChild(p.label));
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ width: "100%", height: "100vh", background: "black" }}
    />
  );
}
