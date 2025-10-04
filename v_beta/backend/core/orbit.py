import numpy as np
from astropy import units as u
from astropy.time import Time
from poliastro.bodies import Sun
from poliastro.twobody import Orbit
from .models import OrbitalElements

def compute_orbit(elem: OrbitalElements, steps=300):
    epoch = Time(elem.epoch)

    # Orbit poliastro
    orb = Orbit.from_classical(
        Sun,
        elem.a * u.AU,
        elem.e * u.one,
        elem.i * u.deg,
        elem.raan * u.deg,
        elem.argp * u.deg,
        elem.M0 * u.deg,
        epoch
    )

    days = orb.period.to(u.day).value
    times = epoch + np.linspace(0, days, steps) * u.day
    points = []
    for t in times:
        r = orb.propagate(t - epoch).r.to(u.AU).value
        points.append({"t": t.iso, "x": float(r[0]), "y": float(r[1]), "z": float(r[2])})
    return points
