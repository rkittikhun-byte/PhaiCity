# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""People on every sheet: the monk on his alms round, the yoke vendor and the two schoolchildren."""

HOLD_FRONT = {'arm_R': {'pitch': 18, 'elbow': 80, 'spread': -8}, 'arm_L': {'pitch': 18, 'elbow': 80, 'spread': -8}}
STRAPS = {'arm_R': {'pitch': 8, 'elbow': 118, 'spread': 4}, 'arm_L': {'pitch': 8, 'elbow': 118, 'spread': 4}}

CHARACTERS = [
    dict(id='monk', th='พระบิณฑบาต', en='Monk on the alms round', kind='man', hair='bald',
         top={'type': 'robe', 'color': 'saffron'}, bottom={'type': 'robe', 'color': 'saffron'}, shoes='barefoot',
         props=[{'type': 'alms_bowl', 'hand': 'both', 'at': (0, -0.02, 0.0)}], pose=HOLD_FRONT, swing_arms=False),
    dict(id='schoolboy', th='นักเรียนชาย', en='Schoolboy', kind='boy', hair='spiky',
         top={'type': 'collar', 'color': 'white', 'sleeve': 'short', 'tuck': True, 'pocket': True},
         bottom={'type': 'shorts', 'color': 'navy', 'belt': 'black'}, shoes='student', socks='white',
         extras=['backpack'], pose=STRAPS, swing_arms=False),
    dict(id='schoolgirl', th='นักเรียนหญิง', en='Schoolgirl', kind='girl', hair='bob',
         top={'type': 'blouse', 'color': 'white', 'sleeve': 'short', 'tuck': True},
         bottom={'type': 'pleated', 'color': 'navy'}, shoes='student', socks='white',
         extras=['backpack', 'bow'], pose=STRAPS, swing_arms=False),
    dict(id='vendor_yoke', th='แม่ค้าหาบของ', en='Vendor with a carrying pole', kind='woman', hair='bun',
         hat={'type': 'ngob'},
         top={'type': 'mandarin', 'color': 'green', 'sleeve': 'elbow'},
         bottom={'type': 'sin', 'color': 'brown', 'stripes': ['stripe_gold', 'stripe_gold']}, shoes='sandals',
         extras=[{'type': 'sash', 'color': 'sash', 'side': -1}],
         props=[{'type': 'yoke', 'hand': 'body', 'at': (-0.17, 0.0, 1.0), 'rot': (0, 0, 90)}],
         pose={'arm_R': {'pitch': 75, 'elbow': 70, 'spread': -14}}, swing_arms=False),
]

LINEUP = ['monk', 'vendor_yoke', 'schoolboy', 'schoolgirl']
