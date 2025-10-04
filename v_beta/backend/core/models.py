from pydantic import BaseModel

class OrbitalElements(BaseModel):
    a: float    # demi-grand axe (AU)
    e: float    # excentricité
    i: float    # inclinaison (deg)
    raan: float # longitude noeud ascendant (deg)
    argp: float # argument du périgée (deg)
    M0: float   # anomalie moyenne à l'époque (deg)
    epoch: str  # ISO date