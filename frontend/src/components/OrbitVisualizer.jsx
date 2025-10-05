import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import IMPACT from "../../impact asteroides/impact-data.json";
import PLANETS_POINTS from "../../planets/Planet_heliocentric_position_velocity.json";

export default function OrbitVisualizer({
  trajectory,
  reset,
  indexTransition,
}) {
  const [prevIndexTransition, setPrevIndexTransition] =
    useState(indexTransition);
  const mountRef = useRef(null);
  // Refs to keep planet meshes and their sample points accessible outside the main effect
  const planetsRef = useRef([]);
  const planetsPointsRef = useRef([]);
  const transitionRef = useRef({ rafId: null, start: 0, duration: 600 });
  // impact data currently unused in visualization; keep import for future use
  const planetsPoints = PLANETS_POINTS?.bodies;
  useEffect(() => {
    if (!trajectory || trajectory.length === 0 || !mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );

    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.physicallyCorrectLights = true;
    renderer.setSize(
      mountRef.current.clientWidth,
      mountRef.current.clientHeight
    );
    mountRef.current.appendChild(renderer.domElement);

    // Add OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Smooth controls
    controls.dampingFactor = 0.05;

    // Orbit line
    const points = trajectory.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    // const geometry = new THREE.BufferGeometry().setFromPoints(points);
    // const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
    // const orbitLine = new THREE.Line(geometry, material);
    // scene.add(orbitLine);
    console.log({ points });
    console.log({ planetsPoints });

    const planetsTJ = planetsPoints?.map((pp) =>
      pp?.samples?.map((p) => new THREE.Vector3(p.r[0], p.r[1], p.r[2]))
    );
    // const planetColors = [
    //   0x00ff88, // vert vif
    //   0x0088ff, // bleu clair et lumineux
    //   0xffee00, // jaune éclatant
    //   0xff6600, // orange vif
    //   0xcc00ff, // violet électrique
    //   0xff0099, // rose fuchsia
    //   0x00ffff, // cyan brillant
    //   0xff0000, // rouge pur
    // ]; // Example colors for planets
    const planetColors = [
      "#00FF88", // vert vif
      "#0088FF", // bleu clair et lumineux
      "#FFEE00", // jaune éclatant
      "#FF6600", // orange vif
      "#CC00FF", // violet électrique
      "#FF0099", // rose fuchsia
      "#00FFFF", // cyan brillant
      "#FF0000", // rouge pur
    ];
    planetsTJ?.forEach((planetPoints, index) => {
      console.log({ planetPoints });
      const planetGeometry = new THREE.BufferGeometry().setFromPoints(
        planetPoints
      );
      const planetMaterial = new THREE.LineBasicMaterial({
        color: planetColors[index % planetColors.length],
      });
      const planetLine = new THREE.Line(planetGeometry, planetMaterial);
      scene.add(planetLine);
    });

    planetsPoints?.map((elm, idx) => {
      const uiContainer = document.createElement("div");
      uiContainer.style.position = "absolute";
      uiContainer.style.top = `${10 * idx * 2.3}px`;
      uiContainer.style.right = `30px`;
      uiContainer.style.color = planetColors[idx % planetColors.length];
      document.body.appendChild(uiContainer);

      uiContainer.innerHTML = `
      <p>${elm.name} ${elm?.samples?.length}</p>
      `;
    });

    // Asteroid mesh
    const asteroid = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 16, 16),
      new THREE.MeshPhongMaterial({ color: 0xd3d3d3 })
    );
    scene.add(asteroid);

    const planets = planetsPoints?.map(
      (pp, idx) =>
        new THREE.Mesh(
          new THREE.SphereGeometry(0.05 * (idx + 1), 16, 16),
          new THREE.MeshPhongMaterial({
            color: planetColors[idx % planetColors.length],
          })
        )
    );
    planets?.forEach((planet, idx) => {
      scene.add(planet);
      const initial = planetsTJ?.[idx]?.[0];
      if (initial) {
        planet.position.set(initial.x, initial.y, initial.z);
      }
    });

    // Save references so we can update positions from other effects
    planetsRef.current = planets || [];
    planetsPointsRef.current = planetsTJ || [];

    // Sun mesh
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    scene.add(sun);

    // Light
    const light = new THREE.PointLight(0xffffff, 10000, 100);
    light.position.set(2, 2, 2);
    scene.add(light);

    // Animate asteroid along trajectory
    const animate = () => {
      requestAnimationFrame(animate);
      // asteroid.position.copy(points[i % points.length]);
      // i++;
      controls.update(); // Update controls
      renderer.render(scene, camera);
    };
    animate();

    // function moveToIndex(index) { ... } commented out - we use the dedicated effect below

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect =
        mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(
        mountRef.current.clientWidth,
        mountRef.current.clientHeight
      );
    };
    window.addEventListener("resize", handleResize);

    // Cleanup on unmount
    const mountNode = mountRef.current;
    return () => {
      window.removeEventListener("resize", handleResize);
      if (mountNode && mountNode.contains(renderer.domElement)) {
        mountNode.removeChild(renderer.domElement);
      }
    };
  }, [trajectory, reset, planetsPoints]);

  // Effect: when indexTransition changes, update planet positions
  useEffect(() => {
    const planetsPoints = PLANETS_POINTS?.bodies?.map(elm => elm?.samples?.map(p => new THREE.Vector3(p.r[0], p.r[1], p.r[2])));
    console.log({pP : planetsPoints})
    const idx = indexTransition;
    if (
      typeof idx !== "number" ||
      !planetsRef.current ||
      planetsRef.current.length === 0 ||
      !planetsPointsRef.current ||
      planetsPointsRef.current.length === 0
    )
      return;

    // Cancel any running transition
    if (transitionRef.current.rafId) {
      cancelAnimationFrame(transitionRef.current.rafId);
      transitionRef.current.rafId = null;
    }

    const fromPositions = planetsRef.current.map((planet) =>
      planet ? planet.position.clone() : null
    );

    const toPositions = planetsRef.current.map((planet, pIdx) => {
      const samples = planetsPointsRef.current[pIdx];
      if (!samples) return null;
      const clampedIndex = Math.max(0, Math.min(samples.length - 1, idx));
      const pos = samples[clampedIndex];
      return pos ? new THREE.Vector3(pos.x, pos.y, pos.z) : null;
    });

    // console.log({ toPositions, fromPositions, map: planetsPointsRef.current });

    const duration = transitionRef.current.duration || 600; // ms
    const start = performance.now();

    const step = (now) => {
      if (prevIndexTransition == idx) return ;
      const elapsed = now - start;
      const t = Math.min(1, Math.max(0, elapsed / duration));
      if (prevIndexTransition > idx) {
        const mapPoint = planetsPoints?.map( elm => elm?.slice(idx, prevIndexTransition).reverse());
        mapPoint[0].map((xyz, i) => {
          
          planetsRef.current[0].position.lerpVectors(fromPositions[0], xyz, t);
          planetsRef.current[1].position.lerpVectors(fromPositions[1], xyz, t);
          planetsRef.current[2].position.lerpVectors(fromPositions[2], xyz, t);
          planetsRef.current[3].position.lerpVectors(fromPositions[3], xyz, t);
          planetsRef.current[4].position.lerpVectors(fromPositions[4], xyz, t);
          planetsRef.current[5].position.lerpVectors(fromPositions[5], xyz, t);
          planetsRef.current[6].position.lerpVectors(fromPositions[6], xyz, t);
          planetsRef.current[7].position.lerpVectors(fromPositions[7], xyz, t);

        })
        console.log({ mapPoint, idx, prevIndexTransition, diff : prevIndexTransition - idx });
        // planetsRef.current.forEach((planet, pIdx) => {
        //   const from = fromPositions[pIdx];
        //   const to = toPositions[pIdx];
        //   if (planet && from && to) {
        //     // lerpVectors modifies the target vector, so set directly on planet.position
        //     planet.position.lerpVectors(from, to, t);
        //   }
        // });
      } else {
        const mapPoint = planetsPoints?.map( elm => elm?.slice(prevIndexTransition, idx));
        // console.log({ mapPoint, idx, prevIndexTransition, diff : prevIndexTransition - idx });
        console.log("{ mapPoint, idx, prevIndexTransition, diff : prevIndexTransition - idx }");
        mapPoint[0].map((xyz, i) => {
          
          planetsRef.current[0].position.lerpVectors(fromPositions[0], xyz, t);
          planetsRef.current[1].position.lerpVectors(fromPositions[1], xyz, t);
          planetsRef.current[2].position.lerpVectors(fromPositions[2], xyz, t);
          planetsRef.current[3].position.lerpVectors(fromPositions[3], xyz, t);
          planetsRef.current[4].position.lerpVectors(fromPositions[4], xyz, t);
          planetsRef.current[5].position.lerpVectors(fromPositions[5], xyz, t);
          planetsRef.current[6].position.lerpVectors(fromPositions[6], xyz, t);
          planetsRef.current[7].position.lerpVectors(fromPositions[7], xyz, t);

        })
      }

      if (t < 1) {
        transitionRef.current.rafId = requestAnimationFrame(step);
      } else {
        transitionRef.current.rafId = null;
      }
    };

    transitionRef.current.rafId = requestAnimationFrame(step);
    setPrevIndexTransition(idx);
  }, [indexTransition, prevIndexTransition]);

  // cleanup transition RAF on unmount
  useEffect(() => {
    const trCurrent = transitionRef.current;
    return () => {
      const rafId = trCurrent ? trCurrent.rafId : null;
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      if (trCurrent) trCurrent.rafId = null;
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ width: "100%", height: "100%", display: "flex", flex: 1 }}
    />
  );
}
