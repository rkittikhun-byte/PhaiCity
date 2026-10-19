# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Era 2, the market town (assets/concept/people_era2_v3.jpg)."""

CHEST = {'arm_R': {'pitch': 20, 'elbow': 95, 'spread': -10}, 'arm_L': {'pitch': 20, 'elbow': 95, 'spread': -10}}

CHARACTERS = [
    dict(id='era2_abacus_woman', th='แม่ค้าดีดลูกคิด', en='Shopkeeper with an abacus', kind='woman', hair='bun',
         top={'type': 'mandarin', 'color': 'maroon', 'sleeve': 'long'},
         bottom={'type': 'sin', 'color': 'purple', 'stripes': ['stripe_pink', 'stripe_pink', 'stripe_pink']},
         shoes='sandals', props=[{'type': 'abacus', 'hand': 'both', 'at': (0, -0.05, 0.03), 'rot': (-10, 0, 0)}],
         pose=CHEST, swing_arms=False),
    dict(id='era2_porter_sack', th='กุลีแบกกระสอบ', en='Porter with a rice sack', kind='man', hair='spiky',
         hat={'type': 'headband', 'side': -1}, top={'type': 'mandarin', 'color': 'olive', 'sleeve': 'short'},
         bottom={'type': 'knee', 'color': 'brown'}, shoes='sandals', extras=[{'type': 'sash', 'side': -1}],
         props=[{'type': 'sack', 'hand': 'body', 'at': (0.27, 0.1, 1.12), 'rot': (0, -15, 75)}],
         pose={'arm_L': {'pitch': 150, 'elbow': 100, 'spread': -15}}, swing_arms=False),
    dict(id='era2_postman', th='บุรุษไปรษณีย์', en='Postman', kind='man', hair='short_neat',
         hat={'type': 'cap', 'color': 'khaki', 'band': 'dark_brown'},
         top={'type': 'collar', 'color': 'khaki', 'sleeve': 'short', 'tuck': True, 'pocket': 'both',
              'buttons': 'dark_brown'},
         bottom={'type': 'trousers', 'color': 'khaki', 'belt': 'dark_brown'}, shoes='shoes',
         extras=[{'type': 'satchel', 'color': 'leather'}]),
    dict(id='era2_samlor_rider', th='คนถีบสามล้อ', en='Pedal rickshaw rider', kind='man', hair='spiky',
         top={'type': 'mandarin', 'color': 'yellow', 'sleeve': 'short'}, bottom={'type': 'knee', 'color': 'brown'},
         shoes='sandals',
         props=[{'type': 'samlor', 'hand': 'none', 'at': (0.42, 0.25, 0), 'rot': (0, 0, 8)}],
         pose={'arm_L': {'pitch': 40, 'elbow': 35, 'spread': -18}, 'arm_R': {'pitch': 10, 'elbow': 10}},
         swing_arms=False),
    dict(id='era2_rail_worker', th='พนักงานรถไฟถือตะเกียง', en='Railway worker with a lamp', kind='woman',
         hair={'style': 'braid', 'side': -1}, hat={'type': 'cap', 'color': 'navy', 'badge': 'silver'},
         top={'type': 'collar', 'color': 'sky', 'sleeve': 'long', 'tuck': True},
         bottom={'type': 'overalls', 'color': 'navy'}, shoes='shoes', extras=['bib'],
         props=[{'type': 'lantern', 'hand': 'L'}], pose={'arm_L': {'pitch': 20, 'elbow': 50, 'spread': 6}}),
    dict(id='era2_teacher_book', th='ครูถือหนังสือ', en='Teacher with a book', kind='woman', hair='bun',
         top={'type': 'mandarin', 'color': 'cream', 'sleeve': 'long'},
         bottom={'type': 'sin', 'color': 'maroon', 'stripes': ['stripe_pink', 'stripe_pink', 'stripe_pink']},
         shoes='shoes',
         props=[{'type': 'book', 'hand': 'both', 'at': (0.02, -0.03, 0.06), 'rot': (0, 0, 70)}],
         pose=CHEST, swing_arms=False),
]

LINEUP = ['era2_abacus_woman', 'era2_porter_sack', 'era2_postman', 'era2_samlor_rider', 'era2_rail_worker',
          'era2_teacher_book', 'monk', 'vendor_yoke', 'schoolboy', 'schoolgirl']
