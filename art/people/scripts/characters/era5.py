# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Era 5, the future city (assets/concept/people_era5_v3.jpg)."""

from .era2 import CHEST

CHARACTERS = [
    dict(id='era5_tablet_woman', th='นักวางแผนถือแท็บเล็ต', en='Planner with a tablet', kind='woman',
         hair='ponytail_high', top={'type': 'collar', 'color': 'teal', 'sleeve': 'elbow'},
         bottom={'type': 'cargo', 'color': 'charcoal'}, shoes='boots', boot_color='dark_brown',
         props=[{'type': 'tablet', 'hand': 'both', 'at': (0, -0.06, 0.06), 'rot': (-35, 0, 0)}], pose=CHEST,
         swing_arms=False),
    dict(id='era5_delivery_robot', th='หุ่นยนต์ส่งของ', en='Delivery robot', kind='man', only_props=True,
         props=[{'type': 'delivery_robot', 'hand': 'none'}]),
    dict(id='era5_engineer', th='วิศวกรใส่แว่น', en='Engineer with glasses', kind='man', hair='spiky',
         face={'glasses': True, 'glasses_mat': 'teal'},
         top={'type': 'jacket', 'color': 'blue', 'sleeve': 'long', 'inner': 'grey'},
         bottom={'type': 'trousers', 'color': 'brown'}, shoes='boots', boot_color='charcoal'),
    dict(id='era5_astronaut', th='นักบินอวกาศ', en='Astronaut', kind='woman', hair='bob', hat={'type': 'astronaut'},
         top={'type': 'tshirt', 'color': 'robot_white', 'sleeve': 'long'},
         bottom={'type': 'trousers', 'color': 'robot_white', 'belt': 'charcoal'}, shoes='boots',
         boot_color='robot_white', gloves='light_grey', face={'blush': True},
         extras=[{'type': 'backpack', 'color': 'light_grey', 'pocket': 'robot_orange'}]),
    dict(id='era5_robot_farmer', th='เกษตรกรกับหุ่นยนต์', en='Farmer with a field robot', kind='woman',
         hair={'style': 'braid', 'side': -1}, hat={'type': 'ngob'},
         top={'type': 'collar', 'color': 'cream', 'sleeve': 'elbow'}, bottom={'type': 'overalls', 'color': 'olive'},
         shoes='rubber_boots', extras=['bib'],
         props=[{'type': 'farm_robot', 'hand': 'none', 'at': (0.62, 0.15, 0), 'rot': (0, 0, -10)}]),
    dict(id='era5_vr_boy', th='เด็กชายใส่แว่น VR', en='Boy in a VR headset', kind='boy', hair='spiky',
         hat={'type': 'vr'}, face={'covered': True},
         top={'type': 'collar', 'color': 'brick', 'sleeve': 'short'}, bottom={'type': 'shorts', 'color': 'khaki'},
         shoes='sandals'),
]

LINEUP = ['era5_tablet_woman', 'era5_delivery_robot', 'era5_engineer', 'era5_astronaut', 'era5_robot_farmer',
          'era5_vr_boy', 'monk', 'vendor_yoke', 'schoolboy', 'schoolgirl']
