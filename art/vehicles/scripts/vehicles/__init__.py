# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Every era's vehicles (PLAN.md "What each era drives"). An era file registers its build functions:

    VEHICLES, vehicle = registry(1)

    @vehicle('bicycle', 'จักรยาน', 'Bicycle', cls='small', paints=('v_navy', 'v_maroon'), slow=0.5)
    def bicycle(v):
        ...

cls is the budget class (build.py BUDGET, export_game.py GAME_BUDGET); paints the colours a car of the kind is painted
in the game, the first being the one it is modelled in; slow how fast it goes against a car (an ox cart 0.3); fly the
height it flies at in metres (0 on the road).
"""

CLASSES = ('small', 'cart', 'car', 'heavy', 'flyer')


def registry(era):
    items = []

    def vehicle(kind, th, en, cls='car', paints=None, slow=1.0, fly=0.0):
        if cls not in CLASSES:
            raise ValueError('Unknown class %s' % cls)

        def deco(fn):
            items.append({'era': era, 'kind': kind, 'th': th, 'en': en, 'cls': cls,
                          'paints': list(paints) if paints else None, 'slow': slow, 'fly': fly, 'build': fn})
            return fn
        return deco
    return items, vehicle


from . import era1, era2, era3, era4, era5  # noqa: E402

ERAS = {'era1': era1.VEHICLES, 'era2': era2.VEHICLES, 'era3': era3.VEHICLES, 'era4': era4.VEHICLES,
        'era5': era5.VEHICLES}
