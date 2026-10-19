# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Every character, by sheet. A sheet module has CHARACTERS (its own specs) and LINEUP (the ids drawn on its
preview sheet in the concept's order, shared characters included)."""

import importlib

ORDER = ['shared', 'era1', 'era2', 'era3', 'era4', 'era5', 'north', 'isan', 'central', 'east', 'west', 'south']

SHEETS = {}
LINEUPS = {}
_BY_ID = {}

for _name in ORDER:
    try:
        _mod = importlib.import_module('characters.' + _name)
    except ModuleNotFoundError as err:
        if err.name == 'characters.' + _name:
            continue
        raise
    SHEETS[_name] = []
    for _spec in _mod.CHARACTERS:
        _spec = dict(_spec)
        _spec['sheet'] = _name
        if _spec['id'] in _BY_ID:
            raise ValueError('duplicate id ' + _spec['id'])
        _BY_ID[_spec['id']] = _spec
        SHEETS[_name].append(_spec)
    if getattr(_mod, 'LINEUP', None):
        LINEUPS[_name] = list(_mod.LINEUP)


def find(cid):
    if cid not in _BY_ID:
        raise SystemExit('unknown character ' + cid)
    return _BY_ID[cid]
