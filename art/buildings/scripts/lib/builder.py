# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""What an era file's build function gets: three parts to draw into (building, props, yard) and the footprint.

    BUILDINGS, building = registry(1)

    @building('home_1', 1, 'เรือนไม้ใต้ถุนสูง', 'Teak house on stilts')
    def home_1(b):
        kit.walls(b.main, ...)
        props.banana(b.props, ...)
        b.ground('dirt')

One tile is 16 m and a building keeps 0.5 m clear on every side, so b.half is how far from the centre it may reach
(7.5 m on one tile, 15.5 m on a 2x2 lot, 23.5 m on a 3x3 service). The front faces -Y. The yard (ground cover) may
reach the tile's edge.
"""

from . import kit
from .mesh import Part

TILE_M = 16.0
MARGIN = 0.5

# Canonical order: every era builds the same kinds (PLAN.md "What each era builds").
KINDS = (
    'home_1', 'home_2', 'home_3', 'home_4', 'home_5',
    'shop_1', 'shop_2', 'shop_3', 'shop_4', 'shop_5',
    'factory_1', 'factory_2', 'factory_3', 'factory_4',
    'ruler_house', 'school', 'hospital', 'police', 'fire', 'water_works', 'power_plant', 'waste', 'station', 'market',
)
TILES = {k: 1 for k in KINDS}
TILES.update({'home_5': 2, 'shop_5': 2, 'factory_4': 2})
TILES.update({k: 3 for k in KINDS[14:]})

# Frontage variants (docs/METRE_DRAWING_PLAN.md 3.3, PLAN.md "Frontage"): a painted plot's building by how many 4 m
# cells run side by side along its road, a plot (16 m) deep. A shophouse bay (ห้องแถว/ตึกแถว คูหาเดียว) is one cell
# wide, so a run of cells is a terrace of bays: `one` stands alone (end walls both sides), `left` and `right` end a
# terrace (an end wall on that side, seen from the street), `mid` and `mid2` are the middle bays, party walls flush at
# both sides (two of them so a long terrace is not one bay repeated). bay1 is the era's lower row (the lower shop
# levels), bay2 its taller one. A house of three cells (12 m) is house12_1 (lower levels) or house12_2.
BAY_M = 4.0
FRONTAGE_DEPTH_M = 16.0
BAY_PLACES = ('one', 'left', 'mid', 'mid2', 'right')
FRONTAGE = tuple('bay%d_%s' % (h, place) for h in (1, 2) for place in BAY_PLACES) + ('house12_1', 'house12_2')
FRONTAGE_WIDTH = {k: (12.0 if k.startswith('house12') else BAY_M) for k in FRONTAGE}

# The temple set (PLAN.md "Temples"): a 3x3 temple compound (วัด) by the level of its community, its wall on the
# compound's edge; built from buildings/temples.py as era<n>_<region>_temple.
TEMPLE = ('temple_1', 'temple_2', 'temple_3')
TILES.update({k: 3 for k in TEMPLE})


def bay_ends(kind):
    """(left, right): whether a bay kind has its end wall on its left (-X, seen from the street) and right side."""
    place = kind.split('_', 1)[1]
    return place in ('one', 'left'), place in ('one', 'right')


class Build:
    def __init__(self, spec, region):
        self.spec = spec
        self.era = spec['era']
        self.region = region
        self.tiles = spec['tiles']
        self.size = self.tiles * TILE_M
        self.half = self.size / 2 - MARGIN
        # A frontage building is its frontage wide and a plot deep: a bay's party walls lie on its sides (x = ±2 m),
        # flush with the next bay's, so it keeps no margin there
        self.width = spec.get('width') or self.size
        self.depth = FRONTAGE_DEPTH_M if spec.get('width') else self.size
        self.main = Part('building')
        self.props = Part('props')
        self.yard = Part('yard')

    @property
    def rect(self):
        """The whole buildable footprint (x0, y0, x1, y1)."""
        if self.spec.get('width'):
            hy = self.depth / 2 - MARGIN
            return (-self.width / 2, -hy, self.width / 2, hy)
        h = self.half
        return (-h, -h, h, h)

    def ground(self, mat='dirt', rect=None, z=0.04):
        """Ground cover over the footprint (or a part of it), a few centimetres high."""
        e = self.size / 2 - 0.05
        ex, ey = (self.width / 2, self.depth / 2 - 0.05) if self.spec.get('width') else (e, e)
        x0, y0, x1, y1 = rect or (-ex, -ey, ex, ey)
        kit.block(self.yard, x0, y0, 0.0, x1, y1, z, mat)
        return self

    def path(self, x0, y0, x1, y1, mat='paving', z=0.07):
        kit.block(self.yard, x0, y0, 0.0, x1, y1, z, mat)
        return self


def registry(era):
    """(list, decorator) for an era file: the decorator registers a build function for one kind; it is built once per
    region as era<n>_<region>_<kind>."""
    items = []

    def building(kind, level, th, en):
        if kind not in KINDS and kind not in FRONTAGE and kind not in TEMPLE:
            raise ValueError('Unknown kind %s (builder.KINDS, builder.FRONTAGE, builder.TEMPLE)' % kind)

        def deco(fn):
            spec = {'kind_id': 'era%d_%s' % (era, kind), 'era': era, 'kind': kind, 'level': level,
                    'tiles': TILES.get(kind, 1), 'th': th, 'en': en, 'build': fn}
            if kind in FRONTAGE:
                spec['width'] = FRONTAGE_WIDTH[kind]
            items.append(spec)
            return fn
        return deco
    return items, building
