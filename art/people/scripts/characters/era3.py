# PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
# Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

"""Era 3, the factory town (assets/concept/people_era3_v3.jpg)."""

from .era2 import CHEST

CHARACTERS = [
    dict(id='era3_factory_woman', th='สาวโรงงานถือปิ่นโต', en='Factory worker with a food carrier',
         kind='woman', hair='bun',
         top={'type': 'collar', 'color': 'denim', 'sleeve': 'short', 'tuck': False, 'pocket': 'both'},
         bottom={'type': 'trousers', 'color': 'denim'}, shoes='shoes',
         props=[{'type': 'tiffin', 'hand': 'R'}], pose={'arm_R': {'pitch': 5, 'elbow': 10, 'spread': 6}}),
    dict(id='era3_factory_man', th='หนุ่มโรงงาน', en='Factory worker', kind='man', hair='spiky',
         top={'type': 'collar', 'color': 'denim', 'sleeve': 'short', 'tuck': False, 'pocket': 'both'},
         bottom={'type': 'trousers', 'color': 'denim'}, shoes='shoes'),
    dict(id='era3_moto_taxi', th='วินมอเตอร์ไซค์', en='Motorbike taxi rider', kind='man', hair='spiky',
         top={'type': 'polo', 'color': 'black', 'sleeve': 'short'},
         bottom={'type': 'trousers', 'color': 'black'}, shoes='shoes',
         extras=[{'type': 'vest', 'color': 'orange_vest', 'band': 'reflect'}],
         props=[{'type': 'moto_helmet', 'hand': 'R', 'at': (0.02, -0.05, 0.04)}],
         pose={'arm_R': {'pitch': 30, 'elbow': 80, 'spread': -10}}, swing_arms=False),
    dict(id='era3_cashier', th='พนักงานแคชเชียร์', en='Shop cashier with a scanner', kind='woman', hair='bun',
         top={'type': 'polo', 'color': 'teal', 'sleeve': 'short', 'tuck': True},
         bottom={'type': 'trousers', 'color': 'black'}, shoes='shoes',
         props=[{'type': 'scanner', 'hand': 'L', 'rot': (0, 0, 0)}],
         pose={'arm_L': {'pitch': 40, 'elbow': 60, 'spread': 0}}),
    dict(id='era3_builder', th='คนงานก่อสร้าง', en='Builder in a hard hat', kind='man', hair='spiky',
         hat={'type': 'hardhat'},
         top={'type': 'collar', 'color': 'brick', 'sleeve': 'elbow', 'tuck': True, 'pocket': 'both'},
         bottom={'type': 'cargo', 'color': 'brown', 'belt': 'dark_brown'}, shoes='boots', boot_color='leather'),
    dict(id='era3_office_woman', th='พนักงานออฟฟิศถือแฟ้ม', en='Office worker with a clipboard',
         kind='woman', hair='bun',
         top={'type': 'blouse', 'color': 'cream', 'sleeve': 'long', 'tuck': True},
         bottom={'type': 'pencil', 'color': 'navy'}, shoes='heels',
         props=[{'type': 'clipboard', 'hand': 'R', 'at': (0.04, -0.04, 0.08), 'rot': (0, 0, 70)}],
         pose={'arm_R': {'pitch': 15, 'elbow': 85, 'spread': -12}}),
]

LINEUP = ['era3_factory_woman', 'era3_factory_man', 'era3_moto_taxi', 'era3_cashier', 'era3_builder',
          'era3_office_woman', 'monk', 'vendor_yoke', 'schoolboy', 'schoolgirl']
