# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Whole pieces several eras share, dressed by region: the raised timber house (เรือนใต้ถุนสูง) with its deck and
stairs, a flight of stairs with handrails, an open pavilion (ศาลา), and an open shed. True sizes."""

from mathutils import Vector

from . import kit, props, regions
from .mesh import T

DECK_DROP = 0.35  # the open deck (ชาน) is a step below the rooms


def stair_flight(p, x, y, z_top, width, direction, mat, rail=None, z_base=0.0):
    """Stairs with stringers and a handrail each side; (x, y) is the top edge's middle."""
    run = kit.stairs(p, x, y, z_top, width, direction, mat, stringer=rail or mat, z_base=z_base)
    if rail:
        dx, dy = {'-y': (0, -1), '+y': (0, 1), '-x': (-1, 0), '+x': (1, 0)}[direction]
        for s in (-1, 1):
            if dx == 0:
                a = Vector((x + s * (width / 2), y, z_top + 0.9))
                b = Vector((x + s * (width / 2), y + dy * run, z_base + 0.9))
            else:
                a = Vector((x, y + s * (width / 2), z_top + 0.9))
                b = Vector((x + dx * run, y + s * (width / 2), z_base + 0.9))
            p.rod(a, b, 0.04, rail, seg=4, smooth=False)
            p.box((0.1, 0.1, 1.0), rail, T(b.x, b.y, z_base + 0.5))
            n = max(2, int(run / 0.5))
            for i in range(1, n):
                q = a.lerp(b, i / n)
                p.rod(q, Vector((q.x, q.y, q.z - 0.85)), 0.02, rail, seg=4, smooth=False)
    return run


def stilt_house(b, cx, cy, w, d, floor_z=2.4, wall_h=2.6, thatch=False, roof_mat=None, axis=None, deck=None,
                stair_side='front', stair_at=None, door_side=None, wood=None, under=True, posts_every=2.0,
                stairs=True):
    """A raised timber house in the region's way, standing on posts.

    w, d: the rooms (metres along X and Y). deck: None, or (side, depth) for an open deck (ชาน) along that side,
    or 'round' for a veranda all round (north). The stairs come down from the deck (or the door) toward stair_side.
    Returns a dict with the rooms' rect, floor height and ridge height."""
    r = b.region
    st = regions.style(r)
    p = b.main
    wood = wood or st['wood']
    trim = st['trim']
    if axis is None:
        axis = 'y' if r == 'northeast' else 'x'
    if deck is None and r == 'north':
        deck = 'round'
    rect = (cx - w / 2, cy - d / 2, cx + w / 2, cy + d / 2)
    x0, y0, x1, y1 = rect
    # posts and floor of the rooms
    nx = max(2, int(round(w / posts_every)) + 1)
    ny = max(2, int(round(d / posts_every)) + 1)
    kit.stilts(p, rect, floor_z, nx, ny, trim, 0.2, 'stone', beams=trim)
    kit.floor_deck(p, (x0 - 0.15, y0 - 0.15, x1 + 0.15, y1 + 0.15), floor_z, wood, 0.12, edge=trim)
    deck_rect = None
    dz = floor_z - DECK_DROP
    if deck == 'round':
        dw = 1.4
        deck_rect = (x0 - dw, y0 - dw, x1 + dw, y1 + dw)
        dz = floor_z
        kit.stilts(p, deck_rect, dz, nx + 1, ny + 1, trim, 0.18, 'stone')
        kit.floor_deck(p, deck_rect, dz - 0.01, wood, 0.1, edge=trim, boards=int((deck_rect[2] - deck_rect[0]) / 0.3),
                       board_mat=trim)
        dx0, dy0, dx1, dy1 = deck_rect
        gap = 1.2
        sx = stair_at if stair_at is not None else dx1 - 1.2
        kit.railing(p, [(sx - gap / 2, dy0), (dx0, dy0), (dx0, dy1), (dx1, dy1), (dx1, dy0), (sx + gap / 2, dy0)], dz,
                    trim, spacing=0.16, post_mat=trim)
        stair_flight(p, sx, dy0, dz, gap - 0.1, '-y', wood, rail=trim)
    elif deck:
        side, depth = deck
        if side == 'right':
            deck_rect = (x1, y0, x1 + depth, y1)
        elif side == 'left':
            deck_rect = (x0 - depth, y0, x0, y1)
        elif side == 'front':
            deck_rect = (x0, y0 - depth, x1, y0)
        else:
            deck_rect = (x0, y1, x1, y1 + depth)
        dnx = max(2, int(round((deck_rect[2] - deck_rect[0]) / posts_every)) + 1)
        dny = max(2, int(round((deck_rect[3] - deck_rect[1]) / posts_every)) + 1)
        kit.stilts(p, deck_rect, dz, dnx, dny, trim, 0.18, 'stone')
        kit.floor_deck(p, deck_rect, dz, wood, 0.1, edge=trim, boards=int((deck_rect[2] - deck_rect[0]) / 0.3),
                       board_mat=trim)
        dx0, dy0, dx1, dy1 = deck_rect
        gap = 1.1
        # stairs down from the deck's front edge
        sx = stair_at if stair_at is not None else (dx0 + dx1) / 2
        if side == 'front':
            pts = [(sx + gap / 2, dy0), (dx1, dy0), (dx1, dy1)], [(dx0, dy1), (dx0, dy0), (sx - gap / 2, dy0)]
        elif side in ('right', 'left'):
            outer = dx1 if side == 'right' else dx0
            inner = dx0 if side == 'right' else dx1
            pts = [(inner, dy1), (outer, dy1), (outer, dy0), (sx + gap / 2 if side == 'right' else sx - gap / 2, dy0)], \
                  [(inner, dy0), (sx - gap / 2 if side == 'right' else sx + gap / 2, dy0)]
        else:
            pts = [(dx0, dy0), (dx0, dy1), (dx1, dy1), (dx1, dy0)], []
        for run_pts in pts:
            if len(run_pts) > 1:
                kit.railing(p, run_pts, dz, trim, spacing=0.16, post_mat=trim)
        if side != 'back' and stairs:
            stair_flight(p, sx, dy0, dz, gap - 0.1, '-y', wood, rail=trim)
    # the rooms
    zt = floor_z + wall_h
    regions.house_walls(p, rect, floor_z, zt, r, wood)
    door_side = door_side or (deck[0] if isinstance(deck, tuple) and deck else 'front')
    door_u = 0.0
    for side in kit.SIDES:
        fw = kit.face_width(rect, side)
        n = max(1, int(fw / 2.4))
        us = kit.spread(fw, n, 0.8)
        if side == door_side:
            door_u = us[0] if n > 1 else -fw * 0.22
            regions.house_door(p, rect, side, door_u, floor_z, r, 1.0, 2.0)
            us = us[1:] if n > 1 else [fw * 0.22]
        for u in us:
            regions.house_window(p, rect, side, u, floor_z + 0.75, r)
    if not deck and stairs:
        # a short flight up to the front door
        stair_flight(p, cx + door_u if stair_at is None else stair_at, y0 - 0.15, floor_z, 1.0, '-y', wood, rail=trim)
    # the roof over the rooms (and the deck on the north's veranda house)
    roof_rect = deck_rect if deck == 'round' else rect
    over = 0.7 if deck == 'round' else 0.9
    top = regions.house_roof(p, roof_rect, zt + (0.0 if deck != 'round' else 0.1), r, roof_mat, axis=axis, over=over,
                             thatch=thatch)
    if isinstance(deck, tuple) and deck and r in ('northeast', 'west', 'east'):
        # a lean-to roof over the deck (Isan's porch, the west's shaded deck)
        lr = deck_rect
        rm = roof_mat or ('thatch' if thatch else 'clay_tile')
        kit.shed_roof(p, lr, zt - 0.5, zt + 0.1, rm, over=0.4, low_side=deck[0], thick=0.3 if thatch else 0.14,
                      courses=4, course_mat='thatch_dark' if thatch else 'clay_tile_dark' if rm == 'clay_tile' else rm)
        for x, y in ((lr[0], lr[1]), (lr[2], lr[1]), (lr[0], lr[3]), (lr[2], lr[3])):
            kit.block(p, x - 0.08, y - 0.08, dz, x + 0.08, y + 0.08, zt - 0.4, trim)
    return {'rect': rect, 'floor': floor_z, 'top': top, 'deck': deck_rect, 'eave': zt}


def pavilion(p, rect, z_floor, h, roof_region, roof_mat='clay_tile', posts=None, thatch=False, axis='x', wood='teak',
             trim='teak_dark', floor_mat='plank', rail=False):
    """An open pavilion (ศาลา): a raised floor, posts and the region's roof."""
    x0, y0, x1, y1 = rect
    if z_floor > 0:
        kit.block(p, x0, y0, 0.0, x1, y1, z_floor, floor_mat, bevel=0.02)
    nx = posts or max(2, int((x1 - x0) / 2.5) + 1)
    ny = max(2, int((y1 - y0) / 2.5) + 1)
    for i in range(nx):
        for j in (0, ny - 1):
            x = x0 + 0.15 + (x1 - x0 - 0.3) * i / (nx - 1)
            y = y0 + 0.15 + (y1 - y0 - 0.3) * j / (ny - 1)
            kit.block(p, x - 0.1, y - 0.1, z_floor, x + 0.1, y + 0.1, z_floor + h, wood)
    for j in range(1, ny - 1):
        for x in (x0 + 0.15, x1 - 0.15):
            y = y0 + 0.15 + (y1 - y0 - 0.3) * j / (ny - 1)
            kit.block(p, x - 0.1, y - 0.1, z_floor, x + 0.1, y + 0.1, z_floor + h, wood)
    kit.bands(p, (x0 + 0.05, y0 + 0.05, x1 - 0.05, y1 - 0.05), z_floor + h - 0.25, 0.25, 0.02, trim)
    if rail:
        kit.railing(p, [(x0, y0 + 1.2), (x0, y1), (x1, y1), (x1, y0 + 1.2)], z_floor, trim, h=0.6)
    return regions.house_roof(p, rect, z_floor + h, roof_region, roof_mat, axis=axis, over=0.7, thatch=thatch)


def open_shed(p, rect, h, roof_mat='zinc', line_mat='zinc_dark', posts_mat='teak', low_side='front', rise=0.8):
    """A simple work shed: posts and a corrugated mono-pitch roof."""
    x0, y0, x1, y1 = rect
    nx = max(2, int((x1 - x0) / 3) + 1)
    for i in range(nx):
        x = x0 + (x1 - x0) * i / (nx - 1)
        for y in (y0, y1):
            zz = h if (y == y0) == (low_side == 'front') else h + rise
            kit.block(p, x - 0.08, y - 0.08, 0.0, x + 0.08, y + 0.08, zz, posts_mat)
    if roof_mat in ('zinc', 'rust', 'zinc_dark'):
        kit.corrugated(p, rect, h, h + rise, roof_mat, line_mat, 0.4, low_side)
    elif roof_mat == 'thatch':
        kit.shed_roof(p, rect, h, h + rise, roof_mat, 0.6, low_side, 0.3, courses=5, course_mat='thatch_dark')
    else:
        kit.shed_roof(p, rect, h, h + rise, roof_mat, 0.5, low_side, 0.15, courses=6,
                      course_mat='clay_tile_dark' if roof_mat == 'clay_tile' else roof_mat)
    return h + rise
