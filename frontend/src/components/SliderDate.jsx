import { useState, useRef } from "react";
import { PLANETS_POINTS, SHARED_TIMELINE } from "../utils/constant";

export default function DateSlider({ handleIndexTransition }) {
  // Shared timeline
  const timeline = SHARED_TIMELINE || [];
  const startDate = timeline[0] ? new Date(timeline[0]).getTime() : Date.now();
  const endDate = timeline[timeline.length - 1]
    ? new Date(timeline[timeline.length - 1]).getTime()
    : Date.now();

  // Valeur initiale (use first timeline index as ms value)
  const [dateValue, setDateValue] = useState(startDate);

  // Fonction pour formater la date en dd/mm/yyyy
  const formatDate = (ms) => {
    const d = new Date(ms);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Handler du slider
  const handleChange = (e) => {
    setDateValue(parseInt(e.target.value));
  };
  // raf ref to throttle updates while dragging
  const rafRef = useRef(null);

  // Find nearest index in the shared timeline
  const findNearestIndex = (ms) => {
    if (!timeline || timeline.length === 0) return 0;
    let best = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < timeline.length; i++) {
      const tMs = new Date(timeline[i]).getTime();
      const diff = Math.abs(tMs - ms);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = i;
      }
    }
    return best;
  };

  const updateIndexFromDate = () => {
    const idx = findNearestIndex(dateValue);
    handleIndexTransition(idx);
    // console logs for debugging
    // console.log("Date sélectionnée :", new Date(dateValue).toISOString());
    // console.log("Index - ", idx);
  };

  // Throttled update while dragging: call updateIndexFromDate via RAF
  const scheduleUpdate = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      updateIndexFromDate();
      rafRef.current = null;
    });
  };

  return (
    <div style={{ padding: "20px", color: "#fff" }}>
      <label>
        Date: {formatDate(dateValue)}
        <input
          type="range"
          min={startDate}
          max={endDate}
          step={24 * 60 * 60 * 1000} // 1 jour en millisecondes
          value={dateValue}
          onChange={(e) => {
            handleChange(e);
            scheduleUpdate();
          }}
          style={{ width: "100%", marginTop: "10px" }}
          //   onDragEnd={() => console.log("Date sélectionnée :", new Date(dateValue).toISOString())}
          onTouchEnd={() => {
            updateIndexFromDate();
            if (rafRef.current) {
              cancelAnimationFrame(rafRef.current);
              rafRef.current = null;
            }
          }}
          onMouseUp={() => {
            updateIndexFromDate();
            if (rafRef.current) {
              cancelAnimationFrame(rafRef.current);
              rafRef.current = null;
            }
          }}
        />
      </label>
    </div>
  );
}
