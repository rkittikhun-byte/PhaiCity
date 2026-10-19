# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""The east: orchards, gems, the sea and industry (assets/concept/people_east.jpg)."""

from .shared import HOLD_FRONT

WAI = {'arm_R': {'pitch': 12, 'elbow': 112, 'spread': -4, 'twist': 38},
       'arm_L': {'pitch': 12, 'elbow': 112, 'spread': -4, 'twist': 38}}

CHARACTERS = [
    dict(id='east_durian_man', th='ชาวสวนทุเรียน', en='Orchard farmer with a durian', kind='man', hair='spiky',
         top={'type': 'collar', 'color': 'olive', 'sleeve': 'short'}, bottom={'type': 'knee', 'color': 'brown'},
         shoes='sandals', extras=[{'type': 'scarf_check', 'color': 'cream', 'check': 'tan'}],
         props=[{'type': 'durian', 'hand': 'both', 'at': (0, -0.06, 0.0)}], pose=HOLD_FRONT, swing_arms=False),
    dict(id='east_rambutan_woman', th='แม่ค้าเงาะ', en='Woman with a basket of rambutans', kind='woman',
         hair='bun', top={'type': 'mandarin', 'color': 'red', 'sleeve': 'long'},
         bottom={'type': 'sin', 'color': 'navy', 'stripes': ['stripe_pink', 'stripe_pink', 'stripe_pink']},
         shoes='sandals', props=[{'type': 'rambutan_basket', 'hand': 'both', 'at': (0.04, -0.06, -0.02)}],
         pose=HOLD_FRONT, swing_arms=False),
    dict(id='east_gem_dealer', th='พ่อค้าพลอยจันทบุรี', en='Gem dealer with a loupe', kind='man', hair='spiky',
         top={'type': 'collar', 'color': 'cream', 'sleeve': 'long', 'tuck': True},
         bottom={'type': 'trousers', 'color': 'brown', 'belt': 'dark_brown'}, shoes='shoes',
         props=[{'type': 'loupe', 'hand': 'R', 'at': (0, -0.02, 0.0)},
                {'type': 'gem_tweezers', 'hand': 'L', 'rot': (-20, 0, 0)}],
         pose={'arm_R': {'pitch': 70, 'elbow': 145, 'spread': -16}, 'arm_L': {'pitch': 55, 'elbow': 90, 'spread': -20}},
         swing_arms=False),
    dict(id='east_fish_woman', th='แม่ค้าปลาทะเล', en='Fish seller with a basket', kind='woman', hair='ponytail',
         top={'type': 'mandarin', 'color': 'teal', 'sleeve': 'long'}, bottom={'type': 'knee', 'color': 'black'},
         shoes='sandals', extras=[{'type': 'scarf_check', 'color': 'cream', 'check': 'grey', 'side': 1}],
         props=[{'type': 'fish_basket', 'hand': 'both', 'at': (0.06, -0.08, 0.0)}], pose=HOLD_FRONT,
         swing_arms=False),
    dict(id='east_mechanic', th='ช่างนิคมอุตสาหกรรม', en='Mechanic in overalls', kind='man', hair='spiky',
         hat={'type': 'flat_cap', 'color': 'navy'},
         top={'type': 'collar', 'color': 'light_grey', 'sleeve': 'elbow', 'tuck': True},
         bottom={'type': 'overalls', 'color': 'navy'}, shoes='rubber_boots', extras=['bib'],
         props=[{'type': 'wrench', 'hand': 'R', 'rot': (-30, 0, 0)}],
         pose={'arm_R': {'pitch': 30, 'elbow': 70, 'spread': -6}}),
    dict(id='east_incense_woman', th='หญิงไหว้ศาลถือธูป', en='Woman praying with incense', kind='woman',
         hair='bun', top={'type': 'mandarin', 'color': 'cream', 'sleeve': 'long'},
         bottom={'type': 'trousers', 'color': 'navy'}, shoes='shoes',
         props=[{'type': 'incense', 'hand': 'both', 'at': (0, -0.02, 0.02)}], pose=WAI, swing_arms=False),
]

LINEUP = ['east_durian_man', 'east_rambutan_woman', 'east_gem_dealer', 'east_fish_woman', 'east_mechanic',
          'east_incense_woman', 'monk', 'schoolboy', 'schoolgirl']
