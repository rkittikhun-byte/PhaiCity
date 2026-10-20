# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Every era's buildings, one file each (era1.py ... era5.py); a missing file is skipped."""

import importlib

from lib.builder import KINDS

ERAS = {}
for _n in range(1, 6):
    _name = 'buildings.era%d' % _n
    try:
        _mod = importlib.import_module(_name)
    except ModuleNotFoundError as e:
        if e.name == _name:
            continue
        raise
    ERAS['era%d' % _n] = sorted(_mod.BUILDINGS, key=lambda s: KINDS.index(s['kind']))


def find(bid):
    for specs in ERAS.values():
        for spec in specs:
            if spec['id'] == bid:
                return spec
    raise SystemExit('Unknown building %s' % bid)
