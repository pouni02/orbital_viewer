#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Impactor builder (T0 = TODAY, 1-day step) — now also computes:
- Surface impact point (latitude, longitude) on Earth
- Impact velocity:
    * inertial geocentric (ECI/ECEF), magnitude
    * ground-relative (atmospheric entry) correcting for Earth's rotation

Model:
- Heliocentric ecliptic J2000 states, linear propagation to construct the rendezvous
- Impact surface time Ts = Ti - R_earth/|v_geo| (with constant relative v_geo)
- Ecliptic->Equatorial rotation by obliquity, then ECI->ECEF via GMST
- Earth radius: 6378.137 km; Earth rotation rate: 7.2921159e-5 rad/s

Outputs:
- <asteroid_id>.json including daily timeline + surface_impact block
"""

from __future__ import annotations
import json
from typing import Tuple, Optional
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from math import sqrt, pi, sin, cos, atan2, asin

# Local timezone handling
try:
    from zoneinfo import ZoneInfo  # Python 3.9+
except Exception:
    ZoneInfo = None  # fallback to UTC if unavailable

# --- Astropy / Astroquery (optional for Horizons) ---
from astropy.time import Time
try:
    from astroquery.jplhorizons import Horizons
    HAS_HORIZONS = True
except Exception:
    HAS_HORIZONS = False

# =========================
# Constants (AU, day units)
# =========================
K_GAUSS = 0.01720209895            # AU^(3/2)/day
MU_SUN = K_GAUSS**2                # AU^3/day^2
AU_KM = 149_597_870.7
DAY_S = 86400.0
MU_EARTH_KM = 398600.435436        # km^3/s^2
MU_EARTH = MU_EARTH_KM * (DAY_S**2) / (AU_KM**3)  # AU^3/day^2
EPS_PARAB = 1e-12
OMEGA_EARTH = 7.2921159e-5         # rad/s (Earth rotation)
RE_KM = 6378.137
RE_AU = RE_KM / AU_KM
AUperDAY_to_KMperS = AU_KM / DAY_S
# Default meteorite density (kg/m^3)
DENSITY_METEORITE_KG_M3_DEFAULT = 3500.0  # ~3.5 g/cm^3

# Obliquity of the ecliptic (J2000) in radians
EPS_OBL_DEG = 23.439291111
EPS_OBL = EPS_OBL_DEG * pi/180.0

# =========================
# Prompt helpers
# =========================
def prompt_str(msg: str, default: Optional[str]=None) -> str:
    s = input(f"{msg}" + (f" [{default}]" if default is not None else "") + ": ").strip()
    return s if s else (default if default is not None else "")

def prompt_float(msg: str, default: Optional[float]=None) -> float:
    while True:
        s = input(f"{msg}" + (f" [{default}]" if default is not None else "") + ": ").strip()
        if not s and default is not None:
            return float(default)
        try:
            return float(s)
        except ValueError:
            print("Veuillez entrer un nombre valide.")

def prompt_vec3(msg: str, default: Optional[Tuple[float,float,float]]=None) -> Tuple[float,float,float]:
    hint = f"{default}" if default is not None else "ex: 1.0, -0.5, 0.0"
    while True:
        s = input(f"{msg} [{hint}]: ").strip()
        if not s and default is not None:
            return tuple(map(float, default))  # type: ignore
        try:
            parts = [p.strip() for p in s.split(",")]
            if len(parts) != 3: raise ValueError
            return (float(parts[0]), float(parts[1]), float(parts[2]))
        except Exception:
            print("Format attendu: trois nombres séparés par des virgules (x,y,z).")

def prompt_choice(msg: str, choices: list[str], default: Optional[str]=None) -> str:
    ch = "/".join(choices)
    while True:
        s = input(f"{msg} ({ch})" + (f" [{default}]" if default else "") + ": ").strip().lower()
        if not s and default:
            return default
        if s in choices:
            return s
        print(f"Choix invalide. Options: {choices}")

# =========================
# Time helpers
# =========================
def now_T0_iso_utc() -> tuple[str, str]:
    """Return (T0_iso_utc, T0_iso_local) with local = Europe/Paris when available."""
    if ZoneInfo is not None:
        local_tz = ZoneInfo("Europe/Paris")
        now_local = datetime.now(local_tz)
        now_utc = now_local.astimezone(timezone.utc)
    else:
        now_utc = datetime.now(timezone.utc)
        now_local = now_utc
    T0_iso_utc = now_utc.isoformat().replace("+00:00", "Z")
    T0_iso_local = now_local.isoformat()
    return T0_iso_utc, T0_iso_local

def parse_iso_utc(iso: str) -> datetime:
    s = iso.strip()
    if s.endswith("Z"):
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    else:
        dt = datetime.fromisoformat(s if "+" in s else s + "+00:00")
    return dt.astimezone(timezone.utc)

def iso_z(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00","Z")

# GMST (Greenwich Mean Sidereal Time) in radians for a UTC datetime
def gmst_radians(dt_utc: datetime) -> float:
    # Convert UTC datetime to Julian Day
    t = Time(dt_utc)
    jd = t.jd
    T = (jd - 2451545.0)/36525.0  # centuries since J2000.0
    # IAU 2006-ish approximation (close to 1982 formula)
    gmst_deg = (280.46061837
                + 360.98564736629*(jd - 2451545.0)
                + 0.000387933*T*T
                - (T**3)/38710000.0)
    gmst_rad = (gmst_deg % 360.0) * pi/180.0
    return gmst_rad

# =========================
# Vector math
# =========================
def vadd(a,b): return (a[0]+b[0], a[1]+b[1], a[2]+b[2])
def vsub(a,b): return (a[0]-b[0], a[1]-b[1], a[2]-b[2])
def vscale(a,s): return (a[0]*s, a[1]*s, a[2]*s)
def vdot(a,b): return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]
def vcross(a,b):
    return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
def vnorm(a): return sqrt(vdot(a,a))

# Rotations
def rot_x(v, ang):
    c, s = cos(ang), sin(ang)
    x, y, z = v
    return (x, c*y - s*z, s*y + c*z)

def rot_z(v, ang):
    c, s = cos(ang), sin(ang)
    x, y, z = v
    return (c*x - s*y, s*x + c*y, z)

# Ecliptic → Equatorial (J2000): rotate by +ε around x-axis
def ecl_to_eq(v):
    return rot_x(v, +EPS_OBL)

# ECI → ECEF: rotate by +GMST around z-axis
def eci_to_ecef(v, gmst_rad):
    return rot_z(v, +gmst_rad)

# =========================
# Ephemeris provider
# =========================
@dataclass
class BodyState:
    r_au: Tuple[float,float,float]
    v_au_per_day: Tuple[float,float,float]

class EphemerisProvider:
    """Return heliocentric ecliptic J2000 states (AU, AU/day) at an ISO epoch."""
    def __init__(self):
        self.has_h = HAS_HORIZONS

    def fetch_horizons(self, target: str, epoch_iso: str) -> BodyState:
        if not self.has_h:
            raise RuntimeError("astroquery/jplhorizons non disponible. Installez 'astroquery' ou utilisez le mode manuel.")
        t = Time(parse_iso_utc(epoch_iso))
        obj = Horizons(id=target, location="500@0", epochs=t.jd, id_type="smallbody")
        vec = obj.vectors(refplane='ecliptic')  # x,y,z [au], vx,vy,vz [au/d]
        r = (float(vec['x'][0]), float(vec['y'][0]), float(vec['z'][0]))
        v = (float(vec['vx'][0]), float(vec['vy'][0]), float(vec['vz'][0]))
        return BodyState(r, v)

    def earth_state(self, epoch_iso: str, mode: str,
                    r0: Optional[Tuple[float,float,float]]=None,
                    v0: Optional[Tuple[float,float,float]]=None) -> BodyState:
        if mode == "manual":
            if r0 is None or v0 is None:
                raise ValueError("En mode manuel, fournissez r0 et v0 pour la Terre.")
            return BodyState(r0, v0)
        return self.fetch_horizons("399", epoch_iso)  # 399 = Earth

    def asteroid_state(self, epoch_iso: str, mode: str,
                       asteroid_id: Optional[str]=None,
                       r0: Optional[Tuple[float,float,float]]=None,
                       v0: Optional[Tuple[float,float,float]]=None) -> BodyState:
        if mode == "manual":
            if r0 is None:
                raise ValueError("En mode manuel, r0 de l'astéroïde est requis.")
            return BodyState(r0, v0 or (0.0,0.0,0.0))
        if not asteroid_id:
            raise ValueError("Mode fetch_by_id : fournissez un identifiant Horizons (ex: '433', 'Apophis', '2024 MK').")
        return self.fetch_horizons(asteroid_id, epoch_iso)

# =========================
# Solve v0 for impact (linear)
# =========================
def solve_v0_for_impact(
    r_a0: Tuple[float,float,float],
    T0_iso: str,
    Ti_iso: str,
    r_e0: Tuple[float,float,float],
    v_e0: Tuple[float,float,float],
) -> Tuple[float,float,float]:
    dt_days = max(1e-9, (parse_iso_utc(Ti_iso) - parse_iso_utc(T0_iso)).total_seconds()/86400.0)
    term = vscale(vsub(r_e0, r_a0), 1.0/dt_days)
    return vadd(v_e0, term)

# =========================
# Two-body orbital diagnostics
# =========================
def orbital_diagnostics(r: Tuple[float,float,float],
                        v: Tuple[float,float,float],
                        mu: float) -> dict:
    rmag = vnorm(r)
    vmag = vnorm(v)
    eps = 0.5*vmag*vmag - mu/rmag
    h = vcross(r, v); hmag = vnorm(h)
    e2 = 1.0 + 2.0*eps*hmag*hmag/(mu*mu) if mu > 0 else float("nan")
    e = sqrt(e2) if e2 > 0 else 0.0
    if abs(eps) <= EPS_PARAB:
        conic, a, P_days, P_years = "parabola", float("inf"), None, None
    elif eps < 0:
        conic = "ellipse"
        a = -mu/(2.0*eps)
        P_days = 2.0*pi*sqrt(a*a*a/mu)
        P_years = P_days/365.25
    else:
        conic, a, P_days, P_years = "hyperbola", -mu/(2.0*eps), None, None
    return {
        "conic": conic,
        "semi_major_axis_au": a,
        "eccentricity": e,
        "specific_energy_AU2_per_day2": eps,
        "period_days": P_days,
        "period_years": P_years
    }

# =========================
# DAILY timeline (1-day step)
# =========================
def build_daily_timeline(
    T0_iso: str, Ti_iso: str,
    r_a0, v_a0, r_e0, v_e0
):
    t0 = parse_iso_utc(T0_iso)
    ti = parse_iso_utc(Ti_iso)

    series = []
    ts = t0
    while ts <= ti:
        dt_days = (ts - t0).total_seconds() / 86400.0
        r_ast = vadd(r_a0, vscale(v_a0, dt_days))
        v_ast = v_a0
        r_earth = vadd(r_e0, vscale(v_e0, dt_days))
        v_earth = v_e0
        r_geo = vsub(r_ast, r_earth)
        v_geo = vsub(v_ast, v_earth)

        series.append({
            "iso": iso_z(ts),
            "heliocentric": {
                "r_au": {"x": r_ast[0], "y": r_ast[1], "z": r_ast[2]},
                "v_au_per_day": {"x": v_ast[0], "y": v_ast[1], "z": v_ast[2]},
            },
            "geocentric": {
                "r_au": {"x": r_geo[0], "y": r_geo[1], "z": r_geo[2]},
                "v_au_per_day": {"x": v_geo[0], "y": v_geo[1], "z": v_geo[2]},
            }
        })
        ts = ts + timedelta(days=1)  # +1 jour

    return series

# =========================
# Surface impact solution & geodesy
# =========================
def compute_surface_impact(
    Ti_iso: str,
    r_a0, v_a0, r_e0, v_e0
) -> dict:
    """
    Returns:
      - timestamps (Ti, Ts)
      - impact_lat_deg, impact_lon_deg
      - inertial and ground-relative velocities at impact
      - vectors in ECEF
    """
    Ti = parse_iso_utc(Ti_iso)

    # Relative (geocentric) velocity is constant in the linear model
    v_geo = vsub(v_a0, v_e0)  # AU/day
    v_geo_mag = max(1e-16, vnorm(v_geo))

    # Back up from Ti to when |r_geo| = R_earth
    dt_surface_days = RE_AU / v_geo_mag
    Ts = Ti - timedelta(days=dt_surface_days)

    # r_geo(Ts) = -v_geo * dt_surface_days (points from Earth center to asteroid)
    r_geo_Ts = vscale(v_geo, -dt_surface_days)  # AU
    rhat_ecl = vscale(r_geo_Ts, 1.0 / RE_AU)    # unit vector in ecliptic frame

    # Convert to equatorial (ECI)
    rhat_eq = ecl_to_eq(rhat_ecl)
    r_eq_au = vscale(rhat_eq, RE_AU)

    # GMST rotation to ECEF at Ts
    theta = gmst_radians(Ts)
    r_ecef_au = eci_to_ecef(r_eq_au, theta)

    # Latitude/Longitude (spherical Earth)
    x, y, z = r_ecef_au
    rmag = sqrt(x*x + y*y + z*z)
    lat = asin(z / rmag) * 180.0/pi
    lon = atan2(y, x) * 180.0/pi
    # Normalize lon to [-180,180]
    if lon > 180.0: lon -= 360.0
    if lon <= -180.0: lon += 360.0

    # Impact velocities:
    # inertial (ECI) at Ts:
    v_geo_eq = ecl_to_eq(v_geo)  # AU/day
    # Transform to ECEF at Ts (same rotation):
    v_ecef_au_per_day = eci_to_ecef(v_geo_eq, theta)
    # Convert to km/s
    v_inertial_km_s = tuple(c * AUperDAY_to_KMperS for c in v_ecef_au_per_day)
    v_inertial_speed_km_s = sqrt(v_inertial_km_s[0]**2 + v_inertial_km_s[1]**2 + v_inertial_km_s[2]**2)

    # Ground-relative (subtract Earth's rotation at the surface point): v_atm = v_inertial - ω × r
    r_ecef_km = tuple(c * AU_KM for c in r_ecef_au)
    omega = (0.0, 0.0, OMEGA_EARTH)  # rad/s in ECEF
    # ω × r in km/s
    wxr = (
        omega[1]*r_ecef_km[2] - omega[2]*r_ecef_km[1],
        omega[2]*r_ecef_km[0] - omega[0]*r_ecef_km[2],
        omega[0]*r_ecef_km[1] - omega[1]*r_ecef_km[0],
    )
    v_ground_km_s = (
        v_inertial_km_s[0] - wxr[0],
        v_inertial_km_s[1] - wxr[1],
        v_inertial_km_s[2] - wxr[2],
    )
    v_ground_speed_km_s = sqrt(v_ground_km_s[0]**2 + v_ground_km_s[1]**2 + v_ground_km_s[2]**2)

    return {
        "impact_time_center_iso": Ti_iso,                    # time geocenters coincide
        "impact_surface_time_iso": iso_z(Ts),                # when |r_geo| = R_earth
        "impact_point": {
            "latitude_deg": lat,
            "longitude_deg": lon
        },
        "velocity_at_impact": {
            "inertial_ecef_km_s": {
                "x": v_inertial_km_s[0], "y": v_inertial_km_s[1], "z": v_inertial_km_s[2]
            },
            "inertial_speed_km_s": v_inertial_speed_km_s,
            "ground_relative_km_s": {
                "x": v_ground_km_s[0], "y": v_ground_km_s[1], "z": v_ground_km_s[2]
            },
            "ground_relative_speed_km_s": v_ground_speed_km_s
        },
        "ecef_position_at_impact_au": {
            "x": r_ecef_au[0], "y": r_ecef_au[1], "z": r_ecef_au[2]
        }
    }

# =========================
# Save JSON
# =========================
def save_json(asteroid_id: str, meta: dict, timeline: list) -> str:
    fname = f"{asteroid_id}.json"
    with open(fname, "w", encoding="utf-8") as f:
        json.dump({"metadata": meta, "timeline": timeline}, f, indent=2)
    return fname

# =========================
# Main interactive
# =========================
def main():
    print("\n=== Générateur d'éphéméride + diagnostics (T0 = aujourd'hui, pas = 1 jour) ===\n")

    # T0 = NOW (Europe/Paris → UTC ISO Z)
    T0_iso, T0_iso_local = now_T0_iso_utc()
    print(f"T0 (local Europe/Paris) : {T0_iso_local}")
    print(f"T0 (UTC ISO Z)          : {T0_iso}")

    asteroid_id = prompt_str("Identifiant de l'astéroïde (nom du fichier)", "USER-IMPACTOR-001")

    # Ask ONLY for diameter; mass derived from spherical volume and assumed density
    diameter_km = prompt_float("Diamètre de l'astéroïde [km]", 5.0)
    density_override = prompt_str(
        f"Densité moyenne du météorite [kg/m^3] (Entrée vide = {DENSITY_METEORITE_KG_M3_DEFAULT})", ""
    )
    rho = float(density_override) if density_override else DENSITY_METEORITE_KG_M3_DEFAULT

    # Mass from sphere volume
    diameter_m = diameter_km * 1000.0
    radius_m = 0.5 * diameter_m
    volume_m3 = (4.0/3.0) * pi * (radius_m**3)
    mass_kg = rho * volume_m3
    print(f"→ Densité utilisée : {rho:.0f} kg/m^3 ; Masse calculée : {mass_kg:.3e} kg")

    Ti_iso = prompt_str("Date d'impact souhaitée (ISO UTC)", "2027-01-04T00:00:00Z")

    # Earth mode
    earth_mode = prompt_choice("Obtenir l'état de la Terre", ["fetch_by_id","manual"], "fetch_by_id")
    eph = EphemerisProvider()
    if earth_mode == "manual":
        re0 = prompt_vec3("Terre r0 [AU] (x,y,z)", (-0.920000000, 0.350000000, 0.015000000))
        ve0 = prompt_vec3("Terre v0 [AU/jour] (vx,vy,vz)", (-0.010395869893, -0.015305030675, -0.000693057993))
        earth_state = BodyState(re0, ve0)
    else:
        print("→ Récupération Terre via JPL Horizons…")
        earth_state = eph.earth_state(T0_iso, mode="fetch_by_id")

    # Asteroid mode
    ast_mode = prompt_choice("Initialiser l'astéroïde", ["fetch_by_id","manual"], "manual")
    if ast_mode == "manual":
        ra0 = prompt_vec3("Astéroïde r0 [AU] (x,y,z)", (-0.80, 0.35, 0.01))
        v0_text = prompt_str("Astéroïde v0 [AU/jour] (vx,vy,vz) ou vide pour calculer automatiquement", "")
        if v0_text:
            parts = [p.strip() for p in v0_text.split(",")]
            va0 = (float(parts[0]), float(parts[1]), float(parts[2])) if len(parts) == 3 else None
        else:
            va0 = None
        ast_state = BodyState(ra0, va0 or (0.0,0.0,0.0))
    else:
        ast_hid = prompt_str("ID Horizons de l'astéroïde (ex: 433, Apophis, 2024 MK)")
        print("→ Récupération astéroïde via JPL Horizons…")
        ast_state = eph.asteroid_state(T0_iso, mode="fetch_by_id", asteroid_id=ast_hid)

    # Solve v0 if needed (manual with missing v0)
    v_a0 = ast_state.v_au_per_day
    if ast_mode == "manual" and (v_a0 == (0.0,0.0,0.0) or v_a0 is None):
        v_a0 = solve_v0_for_impact(
            r_a0=ast_state.r_au,
            T0_iso=T0_iso,
            Ti_iso=Ti_iso,
            r_e0=earth_state.r_au,
            v_e0=earth_state.v_au_per_day
        )
        print(f"→ v0 calculé pour impact à {Ti_iso} : {v_a0}")

    # Diagnostics orbitaux à T0
    diag_sun = orbital_diagnostics(ast_state.r_au, v_a0, MU_SUN)
    r_rel = vsub(ast_state.r_au, earth_state.r_au)
    v_rel = vsub(v_a0, earth_state.v_au_per_day)
    diag_earth = orbital_diagnostics(r_rel, v_rel, MU_EARTH)

    # Affichage bref
    def show_diag(label, d):
        print(f"\n— Orbite autour de {label} —")
        print(f"  Type de conique : {d['conic']}")
        print(f"  a (UA)          : {d['semi_major_axis_au']}")
        print(f"  e               : {d['eccentricity']}")
        if d['period_days'] is not None:
            print(f"  P (jours)       : {d['period_days']}")
            print(f"  P (années)      : {d['period_years']}")
        else:
            print("  Période         : N/A (non elliptique)")

    show_diag("le Soleil", diag_sun)
    show_diag("la Terre", diag_earth)

    # Timeline QUOTIDIENNE (1 jour)
    timeline = build_daily_timeline(
        T0_iso=T0_iso, Ti_iso=Ti_iso,
        r_a0=ast_state.r_au, v_a0=v_a0,
        r_e0=earth_state.r_au, v_e0=earth_state.v_au_per_day
    )

    # Compute surface impact info
    surface = compute_surface_impact(
        Ti_iso=Ti_iso,
        r_a0=ast_state.r_au, v_a0=v_a0,
        r_e0=earth_state.r_au, v_e0=earth_state.v_au_per_day
    )

    # Métadonnées & sauvegarde
    meta = {
        "frame": "heliocentrique écliptique J2000",
        "units": {"position": "AU", "velocity": "AU/day"},
        "assumptions": {
            "meteorite_density_kg_m3": rho,
            "density_note": "Default 3500 kg/m^3 (~3.5 g/cm^3) typical for ordinary stony meteorites."
        },
        "gravitational_parameters": {
            "mu_sun_AU3_per_day2": MU_SUN,
            "mu_earth_AU3_per_day2": MU_EARTH
        },
        "earth_radius_km": RE_KM,
        "asteroid": {"id": asteroid_id, "diameter_km": diameter_km, "mass_kg": mass_kg},
        "initial_conditions": {
            "epoch_T0_local": T0_iso_local,
            "epoch_T0_utc_iso": T0_iso,
            "impact_center_time_iso": surface["impact_time_center_iso"],
            "impact_surface_time_iso": surface["impact_surface_time_iso"],
            "earth_T0": {
                "r_au": {"x": earth_state.r_au[0], "y": earth_state.r_au[1], "z": earth_state.r_au[2]},
                "v_au_per_day": {"x": earth_state.v_au_per_day[0], "y": earth_state.v_au_per_day[1], "z": earth_state.v_au_per_day[2]},
                "source": "fetch_by_id" if HAS_HORIZONS and earth_mode=="fetch_by_id" else "manual"
            },
            "asteroid_T0": {
                "r_au": {"x": ast_state.r_au[0], "y": ast_state.r_au[1], "z": ast_state.r_au[2]},
                "v_au_per_day": {"x": v_a0[0], "y": v_a0[1], "z": v_a0[2]},
                "source": "fetch_by_id" if ast_mode=="fetch_by_id" else "manual"
            }
        },
        "orbit_diagnostics": {
            "sun_centered": diag_sun,
            "earth_centered": diag_earth
        },
        "surface_impact": {
            **surface
        },
        "propagation_model": "linéaire (r(t)=r0+v*t ; v constante)",
        "notes": "Impact point computed by linear backtracking from geocenter-coincidence to Earth's surface; uses GMST + J2000 obliquity."
    }

    out = save_json(asteroid_id, meta, timeline)
    print(f"\n✅ Fichier écrit : {out}")
    print(f"   → Impact @ {surface['impact_surface_time_iso']}  lat {surface['impact_point']['latitude_deg']:.3f}°, lon {surface['impact_point']['longitude_deg']:.3f}°")
    print(f"   → Vitesse inertielle: {surface['velocity_at_impact']['inertial_speed_km_s']:.3f} km/s ; "
          f"relative sol: {surface['velocity_at_impact']['ground_relative_speed_km_s']:.3f} km/s")

if __name__ == "__main__":
    main()
