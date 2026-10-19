# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Low-poly building blocks: a Part collects primitives (each with its own palette material) into one mesh object.

Units are metres, Blender's Z is up and a character faces -Y (its right hand is on -X). Every primitive is made at
the origin and placed with a matrix from T / R / S.
"""

import math

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

from . import palette


def T(x=0.0, y=0.0, z=0.0):
    return Matrix.Translation((x, y, z))


def R(x=0.0, y=0.0, z=0.0):
    """Rotation in degrees, XYZ order."""
    return Euler((math.radians(x), math.radians(y), math.radians(z)), 'XYZ').to_matrix().to_4x4()


def S(x=1.0, y=None, z=None):
    y = x if y is None else y
    z = x if z is None else z
    m = Matrix.Identity(4)
    m[0][0], m[1][1], m[2][2] = x, y, z
    return m


def align_z(direction):
    """Rotation that turns +Z to point along direction."""
    d = Vector(direction).normalized()
    return Vector((0, 0, 1)).rotation_difference(d).to_matrix().to_4x4()


class Part:
    """One mesh object in the making. Add primitives, then make() it."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.mats = []

    def _mat(self, name):
        if name not in self.mats:
            self.mats.append(name)
        return self.mats.index(name)

    def merge(self, tmp, mat, matrix=None, smooth=False):
        if matrix is not None:
            bmesh.ops.transform(tmp, matrix=matrix, verts=tmp.verts)
        idx = self._mat(mat)
        vmap = {v: self.bm.verts.new(v.co) for v in tmp.verts}
        for f in tmp.faces:
            try:
                nf = self.bm.faces.new([vmap[v] for v in f.verts])
            except ValueError:
                continue
            nf.material_index = idx
            nf.smooth = smooth
        tmp.free()
        return self

    # primitives -------------------------------------------------------------------------------------------------

    def box(self, size, mat, matrix=None, bevel=0.0):
        sx, sy, sz = size
        tmp = bmesh.new()
        bmesh.ops.create_cube(tmp, size=1.0)
        bmesh.ops.transform(tmp, matrix=S(sx, sy, sz), verts=tmp.verts)
        if bevel > 0:
            bmesh.ops.bevel(tmp, geom=list(tmp.edges), offset=min(bevel, min(size) * 0.45), segments=1,
                            affect='EDGES', profile=0.5)
        return self.merge(tmp, mat, matrix)

    def cyl(self, r1, r2, depth, mat, matrix=None, seg=10, smooth=True, caps=True):
        """Cone or cylinder along Z, centred on the origin (r1 at -depth/2, r2 at +depth/2)."""
        tmp = bmesh.new()
        bmesh.ops.create_cone(tmp, cap_ends=caps, cap_tris=False, segments=seg, radius1=r1, radius2=r2,
                              depth=depth)
        return self.merge(tmp, mat, matrix, smooth)

    def sphere(self, r, mat, matrix=None, seg=12, rings=8, smooth=True):
        tmp = bmesh.new()
        bmesh.ops.create_uvsphere(tmp, u_segments=seg, v_segments=rings, radius=r)
        return self.merge(tmp, mat, matrix, smooth)

    def rod(self, p0, p1, r, mat, seg=6, r_end=None, smooth=True):
        """A cylinder from point p0 to p1."""
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        m = T(*((p0 + p1) / 2)) @ align_z(d)
        return self.cyl(r, r if r_end is None else r_end, d.length, mat, m, seg, smooth)

    def polyline(self, points, r, mat, seg=6, joints=True):
        for a, b in zip(points, points[1:]):
            self.rod(a, b, r, mat, seg)
        if joints:
            for p in points[1:-1]:
                self.sphere(r, mat, T(*p), seg=seg, rings=4)
        return self

    def lathe(self, profile, mats, matrix=None, seg=12, cap_bottom=False, cap_top=False, smooth=True):
        """Surface of revolution round Z. profile is [(radius, z), ...] bottom to top; mats is one material per
        band between rings (or one name for all)."""
        if isinstance(mats, str):
            mats = [mats] * (len(profile) - 1)
        # One temporary mesh per material so each band keeps its own material.
        rings = []
        for r, z in profile:
            rings.append([(r * math.cos(2 * math.pi * i / seg), r * math.sin(2 * math.pi * i / seg), z)
                          for i in range(seg)])
        groups = {}
        for b in range(len(profile) - 1):
            groups.setdefault(mats[b], []).append(b)
        for mat, bands in groups.items():
            tmp = bmesh.new()
            vs = {}

            def vert(ring, i):
                key = (ring, i % seg)
                if key not in vs:
                    vs[key] = tmp.verts.new(rings[ring][i % seg])
                return vs[key]
            for b in bands:
                for i in range(seg):
                    quad = [vert(b, i), vert(b, i + 1), vert(b + 1, i + 1), vert(b + 1, i)]
                    if len({id(q) for q in quad}) == 4:
                        tmp.faces.new(quad)
            if cap_bottom and 0 in bands and profile[0][0] > 1e-6:
                tmp.faces.new([vert(0, i) for i in reversed(range(seg))])
            last = len(profile) - 1
            if cap_top and last - 1 in bands and profile[-1][0] > 1e-6:
                tmp.faces.new([vert(last, i) for i in range(seg)])
            self.merge(tmp, mat, matrix, smooth)
        return self

    def torus(self, R_major, r_minor, mat, matrix=None, seg=16, seg_minor=6, smooth=True, arc=360.0):
        tmp = bmesh.new()
        full = arc >= 359.9
        n = seg if full else seg + 1
        grid = []
        for i in range(n):
            a = math.radians(arc) * i / seg
            ring = []
            for j in range(seg_minor):
                b = 2 * math.pi * j / seg_minor
                rr = R_major + r_minor * math.cos(b)
                ring.append(tmp.verts.new((rr * math.cos(a), rr * math.sin(a), r_minor * math.sin(b))))
            grid.append(ring)
        for i in range(seg if full else seg):
            a, b = grid[i], grid[(i + 1) % n]
            for j in range(seg_minor):
                tmp.faces.new([a[j], b[j], b[(j + 1) % seg_minor], a[(j + 1) % seg_minor]])
        return self.merge(tmp, mat, matrix, smooth)

    def poly_prism(self, points2d, depth, mat, matrix=None, smooth=False):
        """A flat shape (points in X/Y, counter-clockwise) extruded along Z by depth, centred on z=0."""
        tmp = bmesh.new()
        bottom = [tmp.verts.new((x, y, -depth / 2)) for x, y in points2d]
        top = [tmp.verts.new((x, y, depth / 2)) for x, y in points2d]
        tmp.faces.new(list(reversed(bottom)))
        tmp.faces.new(top)
        n = len(points2d)
        for i in range(n):
            tmp.faces.new([bottom[i], bottom[(i + 1) % n], top[(i + 1) % n], top[i]])
        return self.merge(tmp, mat, matrix, smooth)

    def cap(self, r, mat, matrix=None, keep=lambda co: True, seg=14, rings=10, smooth=True):
        """A sphere with the vertices that fail keep(co) removed: hair caps, domes, hoods."""
        tmp = bmesh.new()
        bmesh.ops.create_uvsphere(tmp, u_segments=seg, v_segments=rings, radius=r)
        if matrix is not None:
            bmesh.ops.transform(tmp, matrix=matrix, verts=tmp.verts)
        gone = [v for v in tmp.verts if not keep(v.co)]
        bmesh.ops.delete(tmp, geom=gone, context='VERTS')
        return self.merge(tmp, mat, None, smooth)

    # result -----------------------------------------------------------------------------------------------------

    def make(self, collection, pivot=(0, 0, 0), parent=None):
        """The finished object, its origin at pivot (character space)."""
        pivot = Vector(pivot)
        bmesh.ops.translate(self.bm, vec=-pivot, verts=self.bm.verts)
        bmesh.ops.remove_doubles(self.bm, verts=self.bm.verts, dist=1e-5)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me)
        self.bm.free()
        for name in self.mats:
            me.materials.append(palette.material(name))
        obj = bpy.data.objects.new(self.name, me)
        collection.objects.link(obj)
        obj.location = pivot
        if parent is not None:
            obj.parent = parent
        palette.add_outline(obj)
        return obj

    @property
    def empty(self):
        return len(self.bm.verts) == 0


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)
