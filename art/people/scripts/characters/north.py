# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""The north: Lanna (assets/concept/people_north.jpg)."""

from .shared import HOLD_FRONT, STRAPS
from .era2 import CHEST

CHARACTERS = [
    dict(id='north_lanna_woman', th='สาวล้านนา', en='Lanna woman with a flower in her hair', kind='woman',
         hair='bun_flower', top={'type': 'mandarin', 'color': 'cream', 'sleeve': 'long'},
         bottom={'type': 'sin', 'color': 'maroon', 'band': 'stripe_gold', 'stripes': ['gold']}, shoes='shoes',
         shoe_color='dark_brown',
         pose={'arm_R': {'pitch': 25, 'elbow': 70, 'spread': -18}, 'arm_L': {'pitch': 25, 'elbow': 70, 'spread': -18}}),
    dict(id='north_umbrella_painter', th='ช่างเขียนร่มบ่อสร้าง', en='Bo Sang umbrella painter', kind='man',
         hair='spiky', hat={'type': 'headband', 'side': -1},
         top={'type': 'mandarin', 'color': 'indigo', 'sleeve': 'short'}, bottom={'type': 'knee', 'color': 'black'},
         shoes='sandals', extras=[{'type': 'sash', 'side': -1}],
         props=[{'type': 'paper_umbrella', 'hand': 'L', 'rot': (-70, 0, 20), 'at': (0.05, -0.1, 0.0)},
                {'type': 'brush', 'hand': 'R', 'rot': (-60, 0, 0)}],
         pose={'arm_L': {'pitch': 55, 'elbow': 60, 'spread': -5}, 'arm_R': {'pitch': 45, 'elbow': 70, 'spread': -18}},
         swing_arms=False),
    dict(id='north_tea_picker', th='สาวเก็บชา', en='Tea picker with a back basket', kind='woman', hair='bun',
         top={'type': 'mandarin', 'color': 'olive', 'sleeve': 'elbow'},
         bottom={'type': 'sin', 'color': 'dark_brown', 'stripes': ['tan', 'tan']}, shoes='sandals',
         extras=[{'type': 'back_basket', 'fill': 'leaf'}], pose=STRAPS, swing_arms=False),
    dict(id='north_akha_woman', th='หญิงอาข่า', en='Akha woman in her headdress', kind='woman', hair='bun',
         hat={'type': 'akha'}, top={'type': 'jacket', 'color': 'black', 'sleeve': 'long', 'inner': 'red'},
         bottom={'type': 'pleated', 'color': 'black'}, shoes='shoes', socks='navy',
         extras=[{'type': 'necklace', 'color': 'silver'}],
         pose={'arm_R': {'pitch': 15, 'elbow': 60, 'spread': -16}, 'arm_L': {'pitch': 15, 'elbow': 60, 'spread': -16}}),
    dict(id='north_wood_carver', th='ช่างแกะสลักไม้', en='Wood carver', kind='man', hair='spiky',
         hat={'type': 'headband', 'side': -1}, top={'type': 'mandarin', 'color': 'brown', 'sleeve': 'short'},
         bottom={'type': 'knee', 'color': 'navy'}, shoes='sandals', extras=[{'type': 'sash', 'side': -1}],
         props=[{'type': 'carving_block', 'hand': 'none', 'at': (0.36, -0.28, 0)},
                {'type': 'mallet', 'hand': 'R', 'rot': (0, 0, 0)},
                {'type': 'chisel', 'hand': 'L', 'rot': (0, 30, 0)}],
         pose={'arm_R': {'pitch': 60, 'elbow': 60, 'spread': -10}, 'arm_L': {'pitch': 45, 'elbow': 50, 'spread': -5}},
         swing_arms=False),
    dict(id='north_bus_driver', th='คนขับรถโดยสาร', en='Bus driver', kind='man', hair='short_neat',
         hat={'type': 'cap', 'color': 'maroon', 'band': 'black'},
         top={'type': 'collar', 'color': 'red', 'sleeve': 'short', 'tuck': True},
         bottom={'type': 'trousers', 'color': 'khaki', 'belt': 'black'}, shoes='shoes',
         props=[{'type': 'steering_wheel', 'hand': 'both', 'at': (0, -0.04, 0.02)}], pose=CHEST, swing_arms=False),
    dict(id='north_sai_ua_vendor', th='แม่ค้าไส้อั่ว', en='Sai ua sausage vendor', kind='woman', hair='bun',
         top={'type': 'mandarin', 'color': 'cream', 'sleeve': 'long'},
         bottom={'type': 'sin', 'color': 'maroon', 'stripes': ['stripe_pink', 'stripe_pink', 'stripe_pink']},
         shoes='sandals', props=[{'type': 'sausage_tray', 'hand': 'both', 'at': (0, -0.05, -0.02)}],
         pose=HOLD_FRONT, swing_arms=False),
]

LINEUP = ['north_lanna_woman', 'north_umbrella_painter', 'north_tea_picker', 'north_akha_woman',
          'north_wood_carver', 'north_bus_driver', 'north_sai_ua_vendor', 'monk', 'schoolboy', 'schoolgirl']
