# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""One chibi character from a spec (scripts/characters/*.py).

The parts are the ones the game moves on its own (docs: PLAN.md "Parts"): root (empty, at the feet) -> body (torso,
hips, neck, skirt), head (head, face, hair, hat), arm_R / arm_L (origin at the shoulder), leg_R / leg_L (origin at
the hip), and props. A pose is only the rotation of the arm and leg objects, so it can be changed in Blender.
"""

import math

import bpy
from mathutils import Matrix, Vector

from .mesh import Part, R, S, T
from . import hair as hair_mod
from . import wear
from . import props as props_mod

# Proportions in metres. Head about a third of the height, as in the concept sheets.
KINDS = {
    'man':   dict(leg=0.50, torso=0.46, head=0.235, torso_r=0.165, depth=0.70, shoulder=0.205, hip=0.085,
                  arm=0.43, arm_r=0.052, leg_r=0.066, hand=0.052),
    'woman': dict(leg=0.50, torso=0.45, head=0.232, torso_r=0.155, depth=0.70, shoulder=0.192, hip=0.080,
                  arm=0.42, arm_r=0.047, leg_r=0.060, hand=0.048),
    'boy':   dict(leg=0.42, torso=0.39, head=0.228, torso_r=0.145, depth=0.72, shoulder=0.178, hip=0.075,
                  arm=0.37, arm_r=0.046, leg_r=0.058, hand=0.046),
    'girl':  dict(leg=0.42, torso=0.38, head=0.226, torso_r=0.138, depth=0.72, shoulder=0.170, hip=0.072,
                  arm=0.36, arm_r=0.043, leg_r=0.055, hand=0.044),
}
FOOT_H = 0.06


class Body:
    """Measurements of one character, in character space (feet at the origin, facing -Y)."""

    def __init__(self, spec):
        self.spec = spec
        p = dict(KINDS[spec.get('kind', 'man')])
        p.update(spec.get('proportions', {}))
        self.p = p
        self.hip_z = FOOT_H + p['leg']
        self.shoulder_z = self.hip_z + p['torso']
        self.neck_z = self.shoulder_z + 0.03
        self.head_z = self.neck_z + p['head'] * 0.86
        self.head_top = self.head_z + p['head']
        self.waist_z = self.hip_z + p['torso'] * 0.22

    def torso_r(self, z):
        """Torso radius (X) at height z, before the depth scale."""
        p = self.p
        t = (z - self.hip_z) / p['torso']
        r = p['torso_r']
        if t < 0.25:
            return r * (1.0 - 0.05 * t / 0.25)
        if t < 0.80:
            return r * (0.95 + 0.07 * (t - 0.25) / 0.55)
        return r * (1.02 - 0.45 * (t - 0.80) / 0.20)

    def shoulder_point(self, side):
        """side -1 = right (-X), +1 = left."""
        return Vector((side * self.p['shoulder'], 0.0, self.shoulder_z - 0.045))

    def hip_point(self, side):
        return Vector((side * self.p['hip'], 0.0, self.hip_z + 0.02))


def arm_vectors(body, pose):
    """Upper arm and forearm directions in arm-local space (before the object rotation) for a pose dict:
    elbow = forward bend of the forearm in degrees."""
    elbow = math.radians(pose.get('elbow', 0))
    up = Vector((0, 0, -1))
    fore = Vector((0, -math.sin(elbow), -math.cos(elbow)))
    l1 = body.p['arm'] * 0.5
    l2 = body.p['arm'] * 0.5
    return up * l1, fore * l2


def arm_rotation(pose, side):
    """Object rotation of an arm: pitch forward, spread out from the body, twist."""
    pitch = pose.get('pitch', 0)
    spread = pose.get('spread', 6)
    twist = pose.get('twist', 0)
    # +Y rotation swings the hand to -X (the right arm's outside).
    return (math.radians(-pitch), math.radians(spread * (-side)), math.radians(twist * -side))


def hand_point(body, pose, side):
    """Where the hand is, in character space."""
    a, b = arm_vectors(body, pose)
    local = a + b + b.normalized() * body.p['hand'] * 0.8
    rot = Matrix.Rotation(0, 4, 'X')
    e = arm_rotation(pose, side)
    from mathutils import Euler
    rot = Euler(e, 'XYZ').to_matrix()
    return body.shoulder_point(side) + rot @ local


def _limb(part, p0, p1, r0, r1, band_lo, band_hi, bands):
    """One straight limb segment from p0 to p1 covering [band_lo, band_hi] of the limb, split into its bands
    [(start, end, material, radius factor)]."""
    d = p1 - p0
    span = band_hi - band_lo
    for start, end, mat, k in bands:
        lo, hi = max(start, band_lo), min(end, band_hi)
        if hi <= lo:
            continue
        t0, t1 = (lo - band_lo) / span, (hi - band_lo) / span
        part.rod(p0 + d * t0, p0 + d * t1, (r0 + (r1 - r0) * t0) * k, mat, seg=8, r_end=(r0 + (r1 - r0) * t1) * k)


def _band_at(bands, t):
    for s, e, m, k in bands:
        if s <= t <= e:
            return m, k
    return bands[-1][2], bands[-1][3]


def build_arm(body, side, pose, coll, root):
    """Upper arm (origin at the shoulder) with its forearm (origin at the elbow, hand included) as a child, both
    hanging straight down in their own space; the pose is their rotation."""
    spec = body.spec
    p = body.p
    tag = 'R' if side < 0 else 'L'
    l1 = l2 = p['arm'] * 0.5
    sleeve = wear.sleeve(spec, side)  # (material, length 0..1 of the arm, cuff radius factor)
    if sleeve:
        bands = [(0.0, sleeve[1], sleeve[0], sleeve[2]), (sleeve[1], 1.0, 'skin', 1.0)]
    else:
        bands = [(0.0, 1.0, 'skin', 1.0)]
    bands = [b for b in bands if b[1] > b[0]]
    upper = Part('arm_' + tag)
    # Shoulder ball in the top's colour, so the joint never shows.
    upper.sphere(p['arm_r'] * 1.12, wear.top_material(spec, side), T(0, 0, -0.01), seg=10, rings=6)
    _limb(upper, Vector(), Vector((0, 0, -l1)), p['arm_r'], p['arm_r'] * 0.92, 0.0, 0.5, bands)
    elbow_mat, elbow_k = _band_at(bands, 0.5)
    upper.sphere(p['arm_r'] * 0.93 * min(elbow_k, 1.1), elbow_mat, T(0, 0, -l1), seg=8, rings=5)
    fore = Part('forearm_' + tag)
    _limb(fore, Vector(), Vector((0, 0, -l2)), p['arm_r'] * 0.92, p['arm_r'] * 0.85, 0.5, 1.0, bands)
    fore.sphere(p['arm_r'] * 0.9 * min(elbow_k, 1.1), elbow_mat, T(0, 0, 0), seg=8, rings=5)
    fore.sphere(p['hand'], wear.hand_material(spec), T(0, 0, -l2 - p['hand'] * 0.6) @ S(0.9, 0.9, 1.1), seg=8,
                rings=6)
    for extra in wear.arm_extras(spec, side):
        extra(fore, body, Vector(), Vector((0, 0, -l2)))
    up_obj = upper.make(coll, pivot=(0, 0, 0), parent=root)
    up_obj.location = body.shoulder_point(side)
    up_obj.rotation_euler = arm_rotation(pose, side)
    up_obj.name = 'arm_' + tag
    fore_obj = fore.make(coll, pivot=(0, 0, 0), parent=up_obj)
    fore_obj.location = (0, 0, -l1)
    fore_obj.rotation_euler = (math.radians(-pose.get('elbow', 0)), 0, 0)
    fore_obj.name = 'forearm_' + tag
    return up_obj, fore_obj


def build_leg(body, side, pose, coll, root):
    """Thigh (origin at the hip) with its shin (origin at the knee, foot included) as a child, both straight down
    in their own space; the pose is their rotation (pitch forward at the hip, knee bending back)."""
    spec = body.spec
    p = body.p
    tag = 'R' if side < 0 else 'L'
    l1 = l2 = p['leg'] * 0.5
    bands = wear.leg_bands(spec)  # [(start, end, material, radius factor)] along the leg, 0 = hip, 1 = ankle
    r = p['leg_r']
    thigh = Part('leg_' + tag)
    _limb(thigh, Vector(), Vector((0, 0, -l1)), r, r * 0.91, 0.0, 0.5, bands)
    thigh.sphere(r * bands[0][3], bands[0][2], T(0, 0, 0), seg=8, rings=5)
    knee_mat, knee_k = _band_at(bands, 0.5)
    thigh.sphere(r * 0.91 * knee_k, knee_mat, T(0, 0, -l1), seg=8, rings=5)
    shin = Part('shin_' + tag)
    _limb(shin, Vector(), Vector((0, 0, -l2)), r * 0.91, r * 0.82, 0.5, 1.0, bands)
    shin.sphere(r * 0.9 * knee_k, knee_mat, T(0, 0, 0), seg=8, rings=5)
    wear.foot(shin, spec, body, Vector((0, 0, -l2)), 0.0)
    th_obj = thigh.make(coll, pivot=(0, 0, 0), parent=root)
    th_obj.location = body.hip_point(side)
    th_obj.rotation_euler = (math.radians(-pose.get('pitch', 0)), 0, math.radians(pose.get('turn', 0)) * -side)
    th_obj.name = 'leg_' + tag
    sh_obj = shin.make(coll, pivot=(0, 0, 0), parent=th_obj)
    sh_obj.location = (0, 0, -l1)
    sh_obj.rotation_euler = (math.radians(pose.get('knee', 0)), 0, 0)
    sh_obj.name = 'shin_' + tag
    return th_obj, sh_obj


def build_body(body, coll, root):
    spec = body.spec
    p = body.p
    part = Part('body')
    d = p['depth']
    # Torso: a lathe from the crotch to the neck, banded by what is worn.
    zs = [body.hip_z - 0.035, body.hip_z, body.hip_z + p['torso'] * 0.12, body.waist_z,
          body.hip_z + p['torso'] * 0.45, body.hip_z + p['torso'] * 0.7, body.hip_z + p['torso'] * 0.86,
          body.shoulder_z - 0.01, body.shoulder_z + 0.012]
    prof = []
    for z in zs:
        r = body.torso_r(min(max(z, body.hip_z), body.shoulder_z))
        if z < body.hip_z:
            r *= 0.75
        if z > body.shoulder_z - 0.005:
            r = 0.055
        prof.append((r, z))
    mats = wear.torso_bands(spec, body, zs)
    part.lathe(prof, mats, S(1, d, 1), seg=14, cap_bottom=True)
    # Neck.
    part.cyl(0.048, 0.044, 0.08, 'skin', T(0, 0, body.neck_z + 0.005), seg=8)
    wear.dress_body(part, spec, body)
    return part.make(coll, pivot=(0, 0, body.hip_z), parent=root)


def build_head(body, coll, root):
    spec = body.spec
    p = body.p
    hr = p['head']
    part = Part('head')
    hz = body.head_z
    skin = 'skin'
    part.sphere(hr, skin, T(0, 0, hz) @ S(1.0, 0.95, 0.97), seg=16, rings=12)
    # Ears.
    for side in (-1, 1):
        part.sphere(hr * 0.17, skin, T(side * hr * 0.97, 0.01, hz - hr * 0.08) @ S(0.55, 0.9, 1.1), seg=8,
                    rings=5)
    face = spec.get('face', {})
    if not face.get('covered'):
        # Eyes: two tall dark ovals, as in the concept.
        ey = -hr * 0.95 * 0.93
        for side in (-1, 1):
            part.sphere(hr * 0.11, 'eye', T(side * hr * 0.33, ey, hz - hr * 0.06) @ S(0.75, 0.5, 1.15), seg=8,
                        rings=6)
        if face.get('blush', spec.get('kind') in ('woman', 'girl')):
            for side in (-1, 1):
                part.sphere(hr * 0.12, 'blush', T(side * hr * 0.55, -hr * 0.82, hz - hr * 0.28) @ S(1, 0.35, 0.6),
                            seg=8, rings=4)
        # Small smile.
        part.sphere(hr * 0.045, 'mouth', T(0, -hr * 0.9, hz - hr * 0.3) @ S(1.5, 0.45, 0.55), seg=8, rings=4)
        if face.get('beard'):
            part.cap(hr * 1.01, 'beard', T(0, 0, hz) @ S(1.0, 0.95, 0.97),
                     keep=lambda co: co.y < -hr * 0.2 and co.z < hz - hr * 0.35, seg=14, rings=10)
        if face.get('glasses'):
            for side in (-1, 1):
                part.torus(hr * 0.15, hr * 0.022, face.get('glasses_mat', 'teal'),
                           T(side * hr * 0.33, -hr * 0.99, hz - hr * 0.05) @ R(90, 0, 0), seg=10, seg_minor=4)
            part.rod((-hr * 0.18, -hr * 1.0, hz - hr * 0.03), (hr * 0.18, -hr * 1.0, hz - hr * 0.03), hr * 0.02,
                     face.get('glasses_mat', 'teal'), seg=4)
    hair_mod.build(part, spec, body)
    wear.hat(part, spec, body)
    return part.make(coll, pivot=(0, 0, body.neck_z), parent=root)


def attach(child, parent):
    """Parent child to parent keeping child's character-space place (the parent is still unposed)."""
    child.parent = parent
    child.matrix_parent_inverse = parent_basis(parent).inverted()


def parent_basis(obj):
    """obj's matrix in character space, from its own and its parents' location and rotation."""
    m = Matrix.Translation(obj.location) @ obj.rotation_euler.to_matrix().to_4x4()
    if obj.parent is not None and obj.parent.type != 'EMPTY':
        m = parent_basis(obj.parent) @ obj.matrix_parent_inverse @ m
    return m


def build(spec, coll):
    """All the objects of one character in coll. Returns the root empty.

    Hierarchy (the same for everyone, so one activity clip fits every character):
        root (feet) -> body (origin at the hips: bends at the waist) -> head (origin at the neck)
                                                                   -> arm_R, arm_L (shoulders) -> forearm_R/L (elbows)
                    -> leg_R, leg_L (hips) -> shin_R, shin_L (knees)
    """
    body = Body(spec)
    root = bpy.data.objects.new(spec['id'], None)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = 0.3
    coll.objects.link(root)
    root['phaicity_kind'] = spec.get('kind', 'man')
    root['phaicity_label_th'] = spec.get('th', '')
    root['phaicity_sheet'] = spec.get('sheet', '')
    root['phaicity_swing_arms'] = spec.get('swing_arms', True)
    pose = spec.get('pose', {})
    if spec.get('only_props'):
        # A machine or animal of the sheet with no person (delivery robot...): props on the root only.
        zero = Vector((0, 0, 0))
        props_mod.build_all(spec, body, coll, root, {-1: root, 1: root}, {-1: zero, 1: zero}, root)
        return root
    torso = build_body(body, coll, root)
    head = build_head(body, coll, root)
    attach(head, torso)
    arms = {}
    for side in (-1, 1):
        key = 'arm_R' if side < 0 else 'arm_L'
        upper, fore = build_arm(body, side, pose.get(key, {}), coll, root)
        attach(upper, torso)
        arms[side] = fore
    for side in (-1, 1):
        key = 'leg_R' if side < 0 else 'leg_L'
        build_leg(body, side, pose.get(key, {}), coll, root)
    hands = {side: hand_point(body, pose.get('arm_R' if side < 0 else 'arm_L', {}), side) for side in (-1, 1)}
    props_mod.build_all(spec, body, coll, root, arms, hands, torso)
    b = pose.get('body', {})
    if b:
        torso.rotation_euler = (math.radians(b.get('pitch', 0)), math.radians(b.get('roll', 0)),
                                math.radians(b.get('turn', 0)))
    h = pose.get('head', {})
    if h:
        head.rotation_euler = (math.radians(h.get('pitch', 0)), math.radians(h.get('roll', 0)),
                               math.radians(h.get('turn', 0)))
    if 'root_z' in spec:
        root.location.z = spec['root_z']
    return root
