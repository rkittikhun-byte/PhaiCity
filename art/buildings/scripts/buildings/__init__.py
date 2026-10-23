# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Every era's buildings, one file each (era1.py ... era5.py), and each era's frontage variants (era1_frontage.py
... era5_frontage.py: shophouse bays and a 12 m house, PLAN.md "Frontage"), a set of their own, and the temples
(temples.py, every era in one file, PLAN.md "Temples") and the department stores (stores.py, eras 2-5, PLAN.md
"Department stores"). A missing file is
skipped; a file that fails to import is skipped too, with its traceback printed, so one era being written never stops
another from building."""

import importlib
import traceback

from lib.builder import FRONTAGE, KINDS


def _load(name):
    try:
        return importlib.import_module(name)
    except ModuleNotFoundError as e:
        if e.name == name:
            return None
        print('Error importing %s (skipped):' % name)
        traceback.print_exc()
    except Exception:
        print('Error importing %s (skipped):' % name)
        traceback.print_exc()
    return None


ERAS = {}
FRONTAGE_SETS = {}
for _n in range(1, 6):
    _mod = _load('buildings.era%d' % _n)
    if _mod is not None:
        ERAS['era%d' % _n] = sorted(_mod.BUILDINGS, key=lambda s: KINDS.index(s['kind']))
    _mod = _load('buildings.era%d_frontage' % _n)
    if _mod is not None:
        FRONTAGE_SETS['era%d' % _n] = sorted(_mod.BUILDINGS, key=lambda s: FRONTAGE.index(s['kind']))
# The temple sets (temples.py, PLAN.md "Temples"): every era's temple compounds, one set per era and region.
_mod = _load('buildings.temples')
TEMPLE_SETS = dict(_mod.TEMPLE_SETS) if _mod is not None else {}
# The department store sets (stores.py, PLAN.md "Department stores"): one store per era (2-5) and region.
_mod = _load('buildings.stores')
STORE_SETS = dict(_mod.STORE_SETS) if _mod is not None else {}


def find(bid):
    for specs in list(ERAS.values()) + list(FRONTAGE_SETS.values()):
        for spec in specs:
            if spec['kind_id'] == bid:
                return spec
    raise SystemExit('Unknown building %s' % bid)
