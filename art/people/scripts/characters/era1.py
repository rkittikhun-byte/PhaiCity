# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Era 1, the farming village (assets/concept/people_era1_v3.jpg)."""

from .shared import HOLD_FRONT

CHARACTERS = [
    dict(id='era1_farmer_sickle', th='ชาวนาถือเคียว', en='Rice farmer with a sickle', kind='man', hair='spiky',
         hat={'type': 'ngob'}, top={'type': 'mandarin', 'color': 'indigo', 'sleeve': 'short'},
         bottom={'type': 'knee', 'color': 'brown'}, shoes='sandals', extras=[{'type': 'sash', 'side': -1}],
         props=[{'type': 'sickle', 'hand': 'R', 'rot': (0, 0, -60), 'at': (0, 0, -0.02)}],
         pose={'arm_R': {'pitch': 25, 'elbow': 55, 'spread': 10}}),
    dict(id='era1_seedling_woman', th='หญิงถือต้นกล้า', en='Woman with rice seedlings', kind='woman', hair='bun',
         top={'type': 'mandarin', 'color': 'brick', 'sleeve': 'elbow'},
         bottom={'type': 'sin', 'color': 'indigo', 'stripes': ['sky', 'sky', 'sky']}, shoes='sandals',
         props=[{'type': 'rice_seedlings', 'hand': 'both', 'at': (0, -0.04, 0.02), 'rot': (-20, 0, 0)}],
         pose=HOLD_FRONT, swing_arms=False),
    dict(id='era1_net_fisher', th='ชาวประมงถือแห', en='Fisherman with a cast net', kind='man', hair='spiky',
         top={'type': 'mandarin', 'color': 'teal', 'sleeve': 'short'}, bottom={'type': 'knee', 'color': 'brown'},
         shoes='sandals', extras=[{'type': 'sash', 'side': -1}],
         props=[{'type': 'cast_net', 'hand': 'L', 'at': (0, 0, 0.02)}],
         pose={'arm_L': {'pitch': 30, 'elbow': 45, 'spread': 8}, 'arm_R': {'pitch': 25, 'elbow': 70, 'spread': -10}},
         swing_arms=False),
    dict(id='era1_boat_vendor', th='แม่ค้าพายเรือ', en='Boat vendor with a paddle', kind='woman', hair='bun',
         top={'type': 'mandarin', 'color': 'pink', 'sleeve': 'elbow'},
         bottom={'type': 'sin', 'color': 'navy', 'stripes': ['stripe_pink', 'stripe_pink', 'stripe_pink']},
         shoes='sandals',
         props=[{'type': 'paddle', 'hand': 'R', 'at': (0, 0, 0)},
                {'type': 'boat', 'hand': 'none', 'at': (0.05, 0.42, 0), 'rot': (0, 0, 25)}],
         pose={'arm_R': {'pitch': 35, 'elbow': 55, 'spread': 4}}, swing_arms=False),
    dict(id='era1_boy_rope', th='เด็กชายถือเชือก', en='Boy with a rope', kind='boy', hair='spiky',
         top={'type': 'mandarin', 'color': 'yellow', 'sleeve': 'short'}, bottom={'type': 'shorts', 'color': 'brown'},
         shoes='sandals', props=[{'type': 'rope_coil', 'hand': 'L'}],
         pose={'arm_L': {'pitch': 10, 'elbow': 20, 'spread': 10}}),
    dict(id='era1_grandma_box', th='ยายถือหีบหมาก', en='Grandmother with a betel box', kind='woman',
         hair={'style': 'bun', 'color': 'hair_grey'},
         top={'type': 'mandarin', 'color': 'cream', 'sleeve': 'three_quarter'},
         bottom={'type': 'sin', 'color': 'maroon', 'stripes': ['stripe_pink', 'stripe_pink']}, shoes='sandals',
         face={'blush': False},
         props=[{'type': 'wooden_box', 'hand': 'both', 'at': (0, -0.03, 0.02)}], pose=HOLD_FRONT, swing_arms=False),
]

LINEUP = ['era1_farmer_sickle', 'era1_seedling_woman', 'era1_net_fisher', 'era1_boat_vendor', 'era1_boy_rope',
          'era1_grandma_box', 'monk', 'vendor_yoke', 'schoolboy', 'schoolgirl']
