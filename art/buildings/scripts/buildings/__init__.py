# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Every era's buildings, one file each (era1.py ... era5.py). A missing file is skipped; a file that fails to
import is skipped too, with its traceback printed, so one era being written never stops another from building."""

import importlib
import traceback

from lib.builder import KINDS

ERAS = {}
for _n in range(1, 6):
    _name = 'buildings.era%d' % _n
    try:
        _mod = importlib.import_module(_name)
    except ModuleNotFoundError as e:
        if e.name == _name:
            continue
        print('Error importing %s (skipped):' % _name)
        traceback.print_exc()
        continue
    except Exception:
        print('Error importing %s (skipped):' % _name)
        traceback.print_exc()
        continue
    ERAS['era%d' % _n] = sorted(_mod.BUILDINGS, key=lambda s: KINDS.index(s['kind']))


def find(bid):
    for specs in ERAS.values():
        for spec in specs:
            if spec['kind_id'] == bid:
                return spec
    raise SystemExit('Unknown building %s' % bid)
