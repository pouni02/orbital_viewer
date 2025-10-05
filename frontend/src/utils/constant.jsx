import PLANETS_POINTS from "../../planets/Planet_heliocentric_position_velocity.json";

// Build a shared timeline (sorted unique timestamps) from all planet samples.
const buildSharedTimeline = (planets) => {
  const set = new Set();
  (planets || []).forEach((body) => {
    (body.samples || []).forEach((s) => {
      if (s && s.datetime_utc) set.add(new Date(s.datetime_utc).toISOString());
    });
  });
  return Array.from(set)
    .map((iso) => new Date(iso))
    .sort((a, b) => a - b)
    .map((d) => d.toISOString());
};

const SHARED_TIMELINE = buildSharedTimeline(PLANETS_POINTS?.bodies || []);

export { PLANETS_POINTS, SHARED_TIMELINE };
