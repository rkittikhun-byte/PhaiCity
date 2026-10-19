# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""The west: rivers, hills and weaving villages (assets/concept/people_west.jpg)."""

CHARACTERS = [
    dict(id='west_rod_fisher', th='คนตกปลา', en='Fisherman with a bamboo rod', kind='man', hair='spiky',
         top={'type': 'mandarin', 'color': 'indigo', 'sleeve': 'short'}, bottom={'type': 'knee', 'color': 'brown'},
         shoes='sandals', extras=[{'type': 'sash', 'side': -1}],
         props=[{'type': 'fishing_rod', 'hand': 'both', 'at': (0, -0.02, 0.0)},
                {'type': 'creel', 'hand': 'body', 'at': (0.24, 0.06, 0.62)}],
         pose={'arm_R': {'pitch': 35, 'elbow': 70, 'spread': -14}, 'arm_L': {'pitch': 45, 'elbow': 60, 'spread': -16}},
         swing_arms=False),
    dict(id='west_head_basket_woman', th='หญิงทูนกระจาดบนหัว', en='Woman carrying a basket on her head',
         kind='woman', hair='bun', top={'type': 'mandarin', 'color': 'cream', 'sleeve': 'long'},
         bottom={'type': 'sin', 'color': 'maroon', 'stripes': ['stripe_gold', 'stripe_gold', 'stripe_gold']},
         shoes='sandals', props=[{'type': 'head_basket', 'hand': 'body', 'at': (0, 0.02, 1.5)}],
         pose={'arm_R': {'pitch': 165, 'elbow': 35, 'spread': -14}}, swing_arms=False),
    dict(id='west_loom_weaver', th='หญิงทอผ้ากี่เอว', en='Weaver at a backstrap loom', kind='woman',
         hair='ponytail', top={'type': 'mandarin', 'color': 'navy', 'sleeve': 'short'},
         bottom={'type': 'trousers', 'color': 'cloth_red'}, shoes='barefoot', root_z=-0.48,
         extras=[{'type': 'sash', 'color': 'cloth_red'}],
         props=[{'type': 'backstrap_loom', 'hand': 'none', 'at': (0, -0.12, 0.48)}],
         pose={'arm_R': {'pitch': 60, 'elbow': 30, 'spread': -10}, 'arm_L': {'pitch': 60, 'elbow': 30, 'spread': -10},
               'leg_R': {'pitch': 90, 'knee': 0}, 'leg_L': {'pitch': 90, 'knee': 0}}, swing_arms=False),
    dict(id='west_ladder_man', th='ชายถือบันไดไม้ไผ่', en='Man with a bamboo ladder', kind='man', hair='spiky',
         hat={'type': 'headband', 'side': -1}, top={'type': 'mandarin', 'color': 'mustard', 'sleeve': 'short'},
         bottom={'type': 'knee', 'color': 'brown'}, shoes='sandals', extras=[{'type': 'sash', 'side': -1}],
         props=[{'type': 'bamboo_ladder', 'hand': 'none', 'at': (0.42, -0.05, 0), 'rot': (0, -6, 70)},
                {'type': 'bamboo_tube', 'hand': 'body', 'at': (-0.26, -0.02, 0.62)}],
         pose={'arm_L': {'pitch': 60, 'elbow': 20, 'spread': 22}}, swing_arms=False),
    dict(id='west_water_jar_woman', th='หญิงข้างโอ่งน้ำ', en='Woman beside a water jar', kind='woman',
         hair='bun', top={'type': 'mandarin', 'color': 'red', 'sleeve': 'long'},
         bottom={'type': 'sin', 'color': 'navy', 'stripes': ['stripe_pink', 'stripe_pink', 'stripe_pink']},
         shoes='shoes',
         props=[{'type': 'water_jar', 'hand': 'none', 'at': (0.5, -0.12, 0)}],
         pose={'arm_L': {'pitch': 35, 'elbow': 20, 'spread': 18}}),
    dict(id='west_paddle_man', th='ชายถือพาย', en='Man with a paddle', kind='man', hair='spiky',
         hat={'type': 'ngob'}, top={'type': 'mandarin', 'color': 'teal', 'sleeve': 'short'},
         bottom={'type': 'knee', 'color': 'brown'}, shoes='sandals', extras=[{'type': 'sash', 'side': -1}],
         props=[{'type': 'paddle', 'hand': 'both', 'at': (0.02, -0.04, 0.0), 'rot': (-20, 25, 0)}],
         pose={'arm_R': {'pitch': 35, 'elbow': 60, 'spread': -12}, 'arm_L': {'pitch': 45, 'elbow': 75, 'spread': -16}},
         swing_arms=False),
]

LINEUP = ['west_rod_fisher', 'west_head_basket_woman', 'west_loom_weaver', 'west_ladder_man',
          'west_water_jar_woman', 'west_paddle_man', 'monk', 'schoolboy', 'schoolgirl']
