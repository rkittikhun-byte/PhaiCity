# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""The south: the sea, rubber and the Malay and Peranakan towns (assets/concept/people_south.jpg).

People of every faith in the south are shown in their everyday dress (hijab, kopiah); no religious buildings or
symbols."""

from .shared import HOLD_FRONT

CHARACTERS = [
    dict(id='south_roti_woman', th='แม่ค้าโรตี', en='Roti seller in a hijab', kind='woman', hair='bun',
         hat={'type': 'hijab', 'color': 'teal'}, top={'type': 'mandarin', 'color': 'cream', 'sleeve': 'long'},
         bottom={'type': 'sin', 'color': 'maroon', 'stripes': ['stripe_pink', 'stripe_pink', 'stripe_pink']},
         shoes='shoes', props=[{'type': 'roti_tray', 'hand': 'both', 'at': (0, -0.06, -0.02)}], pose=HOLD_FRONT,
         swing_arms=False),
    dict(id='south_net_fisher', th='ชาวประมงใส่หมวกกะปิเยาะ', en='Fisherman in a kopiah with a net', kind='man',
         hair='spiky', hat={'type': 'kopiah'}, top={'type': 'mandarin', 'color': 'teal', 'sleeve': 'long'},
         bottom={'type': 'sarong', 'color': 'navy', 'stripes': ['tan', 'brown', 'tan', 'brown']}, shoes='sandals',
         props=[{'type': 'cast_net', 'hand': 'L', 'at': (0, 0, 0.02)}],
         pose={'arm_L': {'pitch': 35, 'elbow': 50, 'spread': 4}, 'arm_R': {'pitch': 35, 'elbow': 70, 'spread': -14}},
         swing_arms=False),
    dict(id='south_rubber_tapper', th='คนกรีดยาง', en='Rubber tapper with a head lamp', kind='woman',
         hair='ponytail', hat={'type': 'headlamp'},
         top={'type': 'collar', 'color': 'maroon', 'sleeve': 'long'}, bottom={'type': 'trousers', 'color': 'dark_brown'},
         shoes='rubber_boots', extras=[{'type': 'belt_bag', 'color': 'charcoal', 'side': -1}],
         props=[{'type': 'tapping_knife', 'hand': 'R', 'rot': (0, 0, 0)}],
         pose={'arm_R': {'pitch': 15, 'elbow': 40, 'spread': 4}}),
    dict(id='south_longtail_driver', th='คนขับเรือหางยาว', en='Long-tail boat driver with his engine',
         kind='man', hair='spiky', top={'type': 'mandarin', 'color': 'navy', 'sleeve': 'long'},
         bottom={'type': 'knee', 'color': 'brown'}, shoes='sandals', extras=[{'type': 'sash', 'side': -1}],
         props=[{'type': 'longtail_engine', 'hand': 'R', 'at': (0, 0.0, 0.0), 'rot': (0, 0, -25)}],
         pose={'arm_R': {'pitch': 70, 'elbow': 20, 'spread': 0}}, swing_arms=False),
    dict(id='south_baba_woman', th='สาวบาบ๋าชุดเคบายา', en='Peranakan woman in a kebaya', kind='woman',
         hair='bun', top={'type': 'kebaya', 'color': 'rose', 'sleeve': 'long'},
         bottom={'type': 'sin', 'color': 'navy', 'band': 'sky', 'stripes': ['white']}, shoes='shoes',
         props=[{'type': 'tiffin', 'hand': 'L', 'color': 'steel'}],
         pose={'arm_L': {'pitch': 10, 'elbow': 20, 'spread': 6}}),
    dict(id='south_coconut_boy', th='เด็กชายถือมะพร้าว', en='Boy with a coconut', kind='boy', hair='spiky',
         top={'type': 'collar', 'color': 'olive', 'sleeve': 'short'}, bottom={'type': 'shorts', 'color': 'brown'},
         shoes='sandals', props=[{'type': 'coconut', 'hand': 'both', 'at': (0, -0.06, 0.0)}],
         pose={'arm_R': {'pitch': 22, 'elbow': 78, 'spread': -8}, 'arm_L': {'pitch': 22, 'elbow': 78, 'spread': -8}},
         swing_arms=False),
    dict(id='south_korlae_painter', th='ช่างเขียนลายเรือกอและ', en='Korlae boat painter', kind='woman',
         hair='bun', top={'type': 'mandarin', 'color': 'blue', 'sleeve': 'long'},
         bottom={'type': 'sin', 'color': 'navy', 'band': 'cloth_red'}, shoes='sandals',
         extras=[{'type': 'belt', 'color': 'leather'}],
         props=[{'type': 'korlae_prow', 'hand': 'none', 'at': (0.3, -0.32, 0), 'rot': (0, 0, -30)},
                {'type': 'brush', 'hand': 'R', 'rot': (-70, 0, 30)}],
         pose={'arm_R': {'pitch': 70, 'elbow': 40, 'spread': -20}}, swing_arms=False),
]

LINEUP = ['south_roti_woman', 'south_net_fisher', 'south_rubber_tapper', 'south_longtail_driver',
          'south_baba_woman', 'south_coconut_boy', 'south_korlae_painter', 'monk', 'schoolboy', 'schoolgirl']
