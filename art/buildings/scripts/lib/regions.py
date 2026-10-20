# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""The regional dress over an era's buildings (PLAN.md "Regions", the sheets assets/concept/region_*):

    central    steep gables whose bargeboards turn up at the ends, panelled walls (ฝาปะกน), bamboo, lotus basins
    north      Lanna: a gentler gable with a carved กาแล crossing above it, vertical boards, verandas all round,
               Bo Sang umbrellas, orchids, a water pot on a stand
    northeast  Isan: plain gables, horizontal boards, a high open floor under the house with the loom, big jars,
               sticky rice baskets, red laterite ground
    south      hipped roofs (ปั้นหยา), fretwork vents over doors and windows, pastel Sino-Portuguese plaster in town,
               rubber trees and rubber sheet racks, coconut palms, sand
    east       central-like gables, fruit orchards (durian, rambutan), fruit baskets, striped awnings
    west       thatch and floating raft houses, orchids, bamboo, hammocks

An era file calls these with b.region; the region ids are the game's (src/render3d/regional/types.ts).
No ช่อฟ้า, ใบระกา or หางหงส์ on any of it: bargeboards stay plain boards and กาแล is a plain crossed board.
"""

import math

from mathutils import Vector

from . import kit, props, props_region as pr
from .mesh import R, S, T

REGIONS = ('north', 'northeast', 'central', 'east', 'west', 'south')

STYLE = {
    'central': {'roof': 'gable', 'gable': 'tips', 'pitch': 1.15, 'walls': 'panel', 'ground': 'grass',
                'plaster': ('plaster', 'plaster_white', 'plaster_peach'), 'awning': ('awning_red', 'awning_white'),
                'wood': 'teak', 'trim': 'teak_dark', 'shutter': 'teak'},
    'north': {'roof': 'gable', 'gable': 'kalae', 'pitch': 0.9, 'walls': 'board_v', 'ground': 'grass_dark',
              'plaster': ('plaster', 'plaster_white', 'cream'), 'awning': ('awning_red', 'awning_yellow'),
              'wood': 'teak_dark', 'trim': 'teak', 'shutter': 'teak'},
    'northeast': {'roof': 'gable', 'gable': 'plain', 'pitch': 0.85, 'walls': 'board_h', 'ground': 'laterite',
                  'plaster': ('plaster_white', 'plaster', 'concrete_light'), 'awning': ('zinc', 'zinc_dark'),
                  'wood': 'plank', 'trim': 'teak_dark', 'shutter': 'plank'},
    'south': {'roof': 'hip', 'gable': 'fret', 'pitch': 0.7, 'walls': 'board_v', 'ground': 'sand',
              'plaster': ('plaster_yellow', 'plaster_mint', 'plaster_sky', 'plaster_pink'),
              'awning': ('awning_blue', 'awning_white'), 'wood': 'teak', 'trim': 'teak_dark', 'shutter': 'teak'},
    'east': {'roof': 'gable', 'gable': 'tips', 'pitch': 1.05, 'walls': 'panel', 'ground': 'dirt',
             'plaster': ('plaster', 'plaster_peach', 'plaster_white'), 'awning': ('awning_red', 'awning_white'),
             'wood': 'teak_light', 'trim': 'teak_dark', 'shutter': 'teak'},
    'west': {'roof': 'gable', 'gable': 'tips', 'pitch': 1.05, 'walls': 'panel', 'ground': 'grass',
             'plaster': ('plaster', 'plaster_sky', 'plaster_white'), 'awning': ('awning_green', 'awning_white'),
             'wood': 'teak', 'trim': 'teak_dark', 'shutter': 'teak'},
}


def style(region):
    return STYLE[region]


def ground_mat(region, era):
    """The yard's ground: the region's soil in the first eras, paving later (green kept in central and west)."""
    if era <= 2:
        return STYLE[region]['ground']
    if era == 3:
        return {'northeast': 'laterite', 'south': 'sand'}.get(region, 'paving')
    return 'paving'


def plaster(region, i=0):
    ps = STYLE[region]['plaster']
    return ps[i % len(ps)]


# roofs ---------------------------------------------------------------------------------------------------------------

def _upturn(p, end, outward, mat, size=0.45):
    """The small turned-up end of a bargeboard (the plain หางปลา of a Thai house), sticking out and up."""
    a = Vector(end)
    b = a + Vector(outward).normalized() * size * 0.5 + Vector((0, 0, size))
    p.rod(a, b, 0.07, mat, seg=4, smooth=False)
    return p


def house_roof(p, rect, z, region, mat=None, axis='x', over=0.8, over_ends=0.6, thatch=False, fill=None,
               pitch=None, courses=None, tiles=True):
    """The region's traditional roof on a wall rectangle at eave height z; returns the ridge height.
    thatch: a thick layered grass roof (era 1, west); otherwise clay tiles in rows."""
    st = STYLE[region]
    x0, y0, x1, y1 = rect
    span = (y1 - y0) if axis == 'x' else (x1 - x0)
    k = pitch or st['pitch']
    if thatch:
        k *= 1.08
    rise = span / 2 * k
    rmat = mat or ('thatch' if thatch else 'clay_tile')
    cmat = 'thatch_dark' if thatch else ('clay_tile_dark' if rmat == 'clay_tile' else rmat)
    n = courses if courses is not None else (7 if thatch else max(3, min(9, int(rise / 0.38))))
    thick = 0.32 if thatch else 0.16
    trim = st['trim']
    if st['roof'] == 'hip':
        return kit.hip_roof(p, rect, z, rise * 0.85, rmat, over=over, thick=thick, courses=n if tiles else 0,
                            course_mat=cmat)
    top = kit.gable_roof(p, rect, z, rise, rmat, over=over, over_ends=over_ends, axis=axis, thick=thick,
                         fill=fill or st['wood'], courses=n if tiles else 0, course_mat=cmat,
                         barge=trim, barge_tips=0.0)
    if thatch:
        thatch_fringe(p, rect, z, rise, axis, over, over_ends)
    gable_dress(p, rect, z, rise, region, axis, over, over_ends)
    return top


def thatch_fringe(p, rect, z, rise, axis='x', over=0.8, over_ends=0.6, seed=7):
    """The shaggy eave of a grass roof: a thick rolled edge and tufts hanging below it, long and short."""
    x0, y0, x1, y1 = rect
    if axis == 'x':
        a0, a1, bc, e0, e1 = x0 - over_ends, x1 + over_ends, (y0 + y1) / 2, y0 - over, y1 + over
    else:
        a0, a1, bc, e0, e1 = y0 - over_ends, y1 + over_ends, (x0 + x1) / 2, x0 - over, x1 + over
    half = abs(bc - e0) - over
    slope = rise / max(half, 0.1)
    ez = z - over * slope
    rnd = props._rng(seed)
    for e in (e0, e1):
        out = 1 if e > bc else -1
        a = Vector((a0, e, ez - 0.12)) if axis == 'x' else Vector((e, a0, ez - 0.12))
        b = Vector((a1, e, ez - 0.12)) if axis == 'x' else Vector((e, a1, ez - 0.12))
        p.rod(a, b, 0.16, 'thatch', seg=6)
        n = int((a1 - a0) / 0.16)
        for i in range(n):
            t = a0 + (a1 - a0) * (i + 0.5) / n
            ln = 0.25 + rnd() * 0.25
            mat = ('thatch_dark', 'thatch', 'thatch_light')[i % 3]
            c = (t, e + out * 0.06, ez - 0.2 - ln / 2) if axis == 'x' else (e + out * 0.06, t, ez - 0.2 - ln / 2)
            tilt = -out * 25
            m = T(*c) @ (R(tilt, 0, 0) if axis == 'x' else R(0, -tilt, 0))
            p.box((0.15, 0.05, ln) if axis == 'x' else (0.05, 0.15, ln), mat, m)
    return p


def gable_dress(p, rect, z, rise, region, axis='x', over=0.8, over_ends=0.6):
    """What sits on the gable ends: turned-up bargeboard ends (central, east, west), a กาแล (north), a fretwork
    panel (south, on its gables when it has any), nothing more (northeast)."""
    st = STYLE[region]
    g = st['gable']
    trim = st['trim']
    x0, y0, x1, y1 = rect
    if axis == 'x':
        ends = [(x0 - over_ends - 0.05, -1), (x1 + over_ends + 0.05, 1)]
        bc, e0, e1 = (y0 + y1) / 2, y0 - over, y1 + over
    else:
        ends = [(y0 - over_ends - 0.05, -1), (y1 + over_ends + 0.05, 1)]
        bc, e0, e1 = (x0 + x1) / 2, x0 - over, x1 + over
    half = abs(bc - e0) - over
    slope = rise / max(half, 0.1)
    ez = z - over * slope
    top = z + rise

    def pt(a, b, zz):
        return Vector((a, b, zz)) if axis == 'x' else Vector((b, a, zz))

    for a, s in ends:
        if g == 'tips':
            for e in (e0, e1):
                _upturn(p, pt(a, e, ez), pt(0, e - bc, 0), trim, 0.5)
            # the bargeboards cross a little above the ridge
            for e in (e0, e1):
                d = (bc - e)
                p.rod(pt(a, bc - d * 0.02, top), pt(a, bc + d * 0.12, top + rise * 0.12 + 0.25), 0.08, trim, seg=4,
                      smooth=False)
        elif g == 'kalae':
            # กาแล: two broad boards crossing above the ridge (plain, as Lanna houses have them)
            for e in (e0, e1):
                d = bc - e
                q0 = pt(a, bc - d * 0.05, top - 0.15)
                q1 = pt(a, bc + d * 0.42, top + 1.25)
                p.rod(q0, q1, 0.13, trim, seg=4, smooth=False)
                p.rod(q1, q1 + pt(0, d * 0.03, 0.25), 0.1, trim, seg=4, smooth=False)
        elif g == 'fret':
            c = pt(a, bc, z + rise * 0.35)
            size = (0.08, span_of(rect, axis) * 0.4, rise * 0.35) if axis == 'x' else \
                (span_of(rect, axis) * 0.4, 0.08, rise * 0.35)
            p.box(size, 'fretwork', T(*c))
    return p


def span_of(rect, axis):
    x0, y0, x1, y1 = rect
    return (y1 - y0) if axis == 'x' else (x1 - x0)


def small_roof(p, rect, z, region, mat='clay_tile', axis='x', over=0.4):
    """A small regional roof on top of a later-era building (a stair head, a roof pavilion, a porch): the region's
    form at a smaller scale. Returns the ridge height."""
    return house_roof(p, rect, z, region, mat=mat, axis=axis, over=over, over_ends=over, courses=3)


# walls and openings --------------------------------------------------------------------------------------------------

def house_walls(p, rect, z0, z1, region, wood=None):
    """Timber walls in the region's way: panels (ฝาปะกน), vertical boards or horizontal boards."""
    st = STYLE[region]
    w = wood or st['wood']
    trim = st['trim']
    x0, y0, x1, y1 = rect
    kind = st['walls']
    if kind == 'board_v':
        return kit.plank_walls(p, rect, z0, z1, w, trim, board=0.22, posts_mat=trim)
    kit.walls(p, rect, z0, z1, w, bevel=0.0)
    kit.corner_posts(p, rect, z0, z1, 0.18, trim)
    for side in kit.SIDES:
        fw = kit.face_width(rect, side)
        if kind == 'board_h':
            n = int((z1 - z0) / 0.24)
            for i in range(1, n):
                kit.on_face(p, rect, side, 0, z0 + i * (z1 - z0) / n - 0.015, fw - 0.1, 0.03, 0.025, trim)
        else:  # panel: a frame of rails and stiles
            for zz in (z0 + 0.08, z0 + (z1 - z0) * 0.45, z1 - 0.12):
                kit.on_face(p, rect, side, 0, zz, fw - 0.1, 0.08, 0.035, trim)
            n = max(2, int(fw / 0.9))
            for i in range(1, n):
                u = -fw / 2 + fw * i / n
                kit.on_face(p, rect, side, u, z0 + 0.08, 0.07, z1 - z0 - 0.2, 0.035, trim)
    return p


def house_window(p, rect, side, u, z0, region, w=0.9, h=1.25):
    """A timber window with open shutters; in the south a louvred pair with a fretwork vent above."""
    st = STYLE[region]
    if region == 'south':
        kit.window(p, rect, side, u, z0, w, h, frame=st['trim'], glass='window_dark', shutters=None, mullion=True)
        for s in (-1, 1):
            kit.on_face(p, rect, side, u + s * w / 4, z0, w / 2 - 0.04, h, 0.09, st['shutter'])
            for k in range(6):
                kit.on_face(p, rect, side, u + s * w / 4, z0 + 0.1 + k * (h - 0.2) / 6, w / 2 - 0.12, 0.03, 0.11,
                            st['trim'])
        kit.on_face(p, rect, side, u, z0 + h + 0.12, w + 0.1, 0.32, 0.08, 'fretwork')
        return p
    return kit.window(p, rect, side, u, z0, w, h, frame=st['trim'], glass='window_dark', shutters=st['shutter'])


def house_door(p, rect, side, u, z0, region, w=1.0, h=2.0):
    st = STYLE[region]
    kit.door(p, rect, side, u, z0, w, h, leaf=st['shutter'], frame=st['trim'])
    if region == 'south':
        kit.on_face(p, rect, side, u, z0 + h + 0.12, w + 0.1, 0.32, 0.08, 'fretwork')
    return p


# yards -------------------------------------------------------------------------------------------------------------------

def plant(b, x, y, seed=0, big=True):
    """One of the region's plants at (x, y): big ones for open corners, small ones beside walls."""
    r = b.region
    p = b.props
    pick = seed % 3
    if r == 'central':
        [lambda: pr.bamboo_clump(p, x, y, 6.5, seed=seed), lambda: props.banana(p, x, y, seed=seed),
         lambda: pr.lotus_pot(p, x, y)][pick if big else 2]()
    elif r == 'north':
        [lambda: pr.bamboo_clump(p, x, y, 7.0, seed=seed), lambda: pr.orchid_pot(p, x, y),
         lambda: props.tree(p, x, y, 6.5, 2.4, seed)][pick if big else 1]()
    elif r == 'northeast':
        [lambda: props.banana(p, x, y, seed=seed), lambda: props.tree(p, x, y, 6.0, 2.6, seed),
         lambda: props.potted(p, x, y, 0, 0.55, 'leafy', seed)][pick if big else 2]()
    elif r == 'south':
        [lambda: props.coconut(p, x, y, 9.5, seed=seed), lambda: pr.rubber_tree(p, x, y, seed=seed),
         lambda: props.potted(p, x, y, 0, 0.55, 'leafy', seed)][pick if big else 2]()
    elif r == 'east':
        [lambda: pr.fruit_tree(p, x, y, 'durian', seed=seed), lambda: pr.fruit_tree(p, x, y, 'rambutan', 5.5, 2.2, seed),
         lambda: props.banana(p, x, y, seed=seed)][pick if big else 2]()
    else:  # west
        [lambda: props.banana(p, x, y, seed=seed), lambda: pr.bamboo_clump(p, x, y, 6.0, seed=seed),
         lambda: pr.orchid_pot(p, x, y)][pick if big else 2]()
    return p


def craft(b, x, y, facing=0.0):
    """The region's signature yard thing (PLAN.md "Regions")."""
    r = b.region
    p = b.props
    if r == 'central':
        pr.lotus_pot(p, x, y)
        pr.lotus_pot(p, x + 1.0, y + 0.2, r=0.32)
    elif r == 'north':
        pr.umbrella_rack(p, x, y, facing)
    elif r == 'northeast':
        pr.rice_baskets(p, x, y)
    elif r == 'south':
        pr.rubber_rack(p, x, y, facing)
    elif r == 'east':
        pr.fruit_baskets(p, x, y)
    else:
        pr.orchid_pot(p, x, y)
        pr.orchid_pot(p, x + 0.7, y + 0.3)
    return p


def under_house(b, x, y, facing=0.0):
    """What lives under a raised house: a loom (northeast), a water pot on a stand (north), a hammock and jars
    elsewhere."""
    r = b.region
    p = b.props
    if r == 'northeast':
        pr.loom(p, x, y, facing)
    elif r == 'north':
        pr.jar_on_stand(p, x, y)
    else:
        props.water_jar(p, x, y)
    return p


def awning_colours(region):
    return STYLE[region]['awning']


def border(b, e, step=7.0, seed=0, sides=('back', 'left', 'right')):
    """Plants along the inside of a big lot's fence (e from the centre), big and small in turn, so a large yard
    is not bare."""
    k = seed
    spots = []
    n = int(2 * e / step)
    for i in range(n + 1):
        t = -e + 1.5 + (2 * e - 3.0) * i / max(n, 1)
        if 'back' in sides:
            spots.append((t, e - 1.6))
        if 'left' in sides:
            spots.append((-e + 1.6, t))
        if 'right' in sides:
            spots.append((e - 1.6, t))
    for x, y in spots:
        plant(b, x, y, k, big=k % 2 == 0)
        k += 1
    return b
