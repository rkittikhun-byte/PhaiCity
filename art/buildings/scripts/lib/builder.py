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


class Build:
    def __init__(self, spec, region):
        self.spec = spec
        self.era = spec['era']
        self.region = region
        self.tiles = spec['tiles']
        self.size = self.tiles * TILE_M
        self.half = self.size / 2 - MARGIN
        self.main = Part('building')
        self.props = Part('props')
        self.yard = Part('yard')

    @property
    def rect(self):
        """The whole buildable footprint (x0, y0, x1, y1)."""
        h = self.half
        return (-h, -h, h, h)

    def ground(self, mat='dirt', rect=None, z=0.04):
        """Ground cover over the footprint (or a part of it), a few centimetres high."""
        e = self.size / 2 - 0.05
        x0, y0, x1, y1 = rect or (-e, -e, e, e)
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
        if kind not in KINDS:
            raise ValueError('Unknown kind %s (builder.KINDS)' % kind)

        def deco(fn):
            items.append({'kind_id': 'era%d_%s' % (era, kind), 'era': era, 'kind': kind, 'level': level,
                          'tiles': TILES[kind], 'th': th, 'en': en, 'build': fn})
            return fn
        return deco
    return items, building
