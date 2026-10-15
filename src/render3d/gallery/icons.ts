/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

/** Every tool's icon (assets/icons/tools/): its id, its Thai and English names and the colour it wears, which is its
 * button's (index.html data-colour) or its choice's above the button (src/game.js) */
export const TOOL_ICONS = [
  ['residential', 'บ้านพักอาศัย', 'Residential', 'lime'],
  ['commercial', 'ตึกแถว', 'Commercial', 'blue'],
  ['industrial', 'โรงงาน', 'Industrial', 'yellow'],
  ['road', 'ถนน', 'Road', 'black'],
  ['rail', 'ทางรถไฟ', 'Rail', 'brown'],
  ['wire', 'สายไฟ', 'Wire', 'khaki'],
  ['park', 'สวน', 'Park', 'darkgreen'],
  ['police', 'ตำรวจ', 'Police', 'darkblue'],
  ['fire', 'ดับเพลิง', 'Fire', 'red'],
  ['coal', 'โรงไฟฟ้าถ่านหิน', 'Coal power', 'gray'],
  ['nuclear', 'โรงไฟฟ้านิวเคลียร์', 'Nuclear power', 'mistyrose'],
  ['stadium', 'สนามกีฬา', 'Stadium', 'indigo'],
  ['port', 'ท่าเรือ', 'Port', 'dodgerblue'],
  ['airport', 'สนามบิน', 'Airport', 'violet'],
  ['bulldozer', 'รื้อถอน', 'Bulldozer', 'salmon'],
  ['query', 'ตรวจสอบ', 'Query', 'cyan'],
  ['gas', 'โรงไฟฟ้าก๊าซ', 'Gas power', '#6f9fc4'],
  ['hydro', 'เขื่อนไฟฟ้า', 'Hydro dam', '#2a7fd4'],
  ['solar', 'โซลาร์ฟาร์ม', 'Solar farm', '#e8b100'],
  ['wind', 'กังหันลม', 'Wind farm', '#7fc8b5'],
  ['mine', 'เหมือง', 'Mine', '#b07848'],
  ['limestone_mine', 'เหมืองหินปูน', 'Limestone quarry', '#b07848'],
  ['potash_mine', 'เหมืองโพแทช', 'Potash mine', '#b07848'],
  ['tin_mine', 'เหมืองดีบุก', 'Tin mine', '#b07848'],
  ['zinc_mine', 'เหมืองสังกะสี', 'Zinc mine', '#b07848'],
  ['gold_mine', 'เหมืองทอง', 'Gold mine', '#b07848'],
  ['gem_mine', 'เหมืองพลอย', 'Gem mine', '#b07848'],
  ['rare_earth_mine', 'เหมืองแร่หายาก', 'Rare earth mine', '#b07848'],
  ['lignite_mine', 'เหมืองลิกไนต์', 'Lignite mine', '#b07848'],
  ['oil_well', 'บ่อน้ำมัน', 'Oil well', '#b07848'],
  ['farm', 'ไร่นา', 'Farm', '#9cbf3a'],
  ['fishing', 'ท่าเรือประมง', 'Fishing harbour', '#2f9bb0'],
  ['road_asphalt', 'ถนนลาดยาง', 'Asphalt road', '#3a3a3a'],
  ['road_concrete2', 'คอนกรีต 2 เลน', 'Concrete, 2 lanes', '#3a3a3a'],
  ['road_concrete4', 'คอนกรีต 4 เลน', 'Concrete, 4 lanes', '#3a3a3a'],
  ['road_concrete6', 'คอนกรีต 6 เลน', 'Concrete, 6 lanes', '#3a3a3a'],
  ['road_concrete8', 'คอนกรีต 8 เลน', 'Concrete, 8 lanes', '#3a3a3a'],
  ['motorway', 'มอเตอร์เวย์', 'Motorway', '#3a3a3a'],
  ['tollway', 'ทางด่วน', 'Tollway', '#3a3a3a'],
  ['road_upgrade', 'อัปเกรดถนน', 'Upgrade road', '#d9a400'],
  ['building_upgrade', 'อัปเกรดอาคาร', 'Upgrade building', '#d9a400'],
  ['ruler_house', 'ที่ว่าการอำเภอ', 'District office', '#c9a227'],
  ['ruler_house_upgrade', 'ยกระดับที่ว่าการ', 'Raise the office', '#c9a227'],
  ['ruler_house_wings', 'ส่วนต่อเติม', 'Wings', '#c9a227'],
  ['ruler_house_policies', 'นโยบาย', 'Policies', '#c9a227'],
  ['waterworks', 'โรงผลิตน้ำประปา', 'Water works', 'deepskyblue'],
  ['watertower', 'หอถังสูง', 'Water tower', 'lightskyblue'],
  ['kindergarten', 'โรงเรียนอนุบาล', 'Kindergarten', '#e07b39'],
  ['primary_school', 'โรงเรียนประถม', 'Primary school', '#e07b39'],
  ['secondary_school', 'โรงเรียนมัธยม', 'Secondary school', '#e07b39'],
  ['vocational_college', 'วิทยาลัยอาชีวะ', 'Vocational college', '#b8612a'],
  ['university', 'มหาวิทยาลัย', 'University', '#b8612a'],
  ['health_centre', 'สถานีอนามัย', 'Health centre', '#3aa17e'],
  ['community_hospital', 'โรงพยาบาลชุมชน', 'Community hospital', '#3aa17e'],
  ['provincial_hospital', 'โรงพยาบาลจังหวัด', 'Provincial hospital', '#3aa17e'],
  ['regional_hospital', 'โรงพยาบาลศูนย์', 'Regional hospital', '#3aa17e'],
  ['landfill', 'บ่อฝังกลบ', 'Landfill', '#8a6d3b'],
  ['incinerator', 'เตาเผาขยะ', 'Incinerator', '#7a5c58'],
  ['recycling_plant', 'โรงงานรีไซเคิล', 'Recycling plant', '#4f9a5a'],
  ['waste_power_plant', 'โรงไฟฟ้าขยะ', 'Waste power plant', '#b07a2a'],
  ['wastewater_plant', 'โรงบำบัดน้ำเสีย', 'Wastewater plant', '#3f7fa6'],
  ['police_box', 'ป้อมตำรวจ', 'Police box', 'darkblue'],
  ['police_large', 'สถานีตำรวจใหญ่', 'Large police station', 'darkblue'],
  ['police_hq', 'กองบังคับการตำรวจ', 'Police headquarters', 'darkblue'],
  ['fire_post', 'จุดดับเพลิง', 'Fire post', 'red'],
  ['fire_centre', 'ศูนย์ดับเพลิง', 'Fire centre', 'red'],
  ['land', 'ซื้อที่ดิน', 'Buy land', '#d4a017'],
  ['bus_stop', 'ป้ายรถเมล์', 'Bus stop', '#e3a21a'],
  ['train_station', 'สถานีรถไฟ', 'Train station', '#8c5a3c'],
  ['metro_station', 'สถานีรถไฟฟ้า', 'Metro station', '#2f6db5'],
  ['hsr_station', 'สถานีรถไฟความเร็วสูง', 'High-speed rail station', '#c0392b'],
] as const;

export function buildIconGallery(parent: HTMLElement, localText: (node: HTMLElement, thai: string, english: string) => void): void {
  parent.replaceChildren();
  for (const [id, thai, english] of TOOL_ICONS) {
    const card = document.createElement('article');
    card.className = 'icon-card';
    const heading = document.createElement('h2');
    localText(heading, thai, english);
    const file = document.createElement('a');
    file.href = `assets/icons/tools/${id}.svg`;
    file.textContent = `${id}.svg`;
    const sizes = document.createElement('div');
    sizes.className = 'icon-sizes';
    for (const size of [18, 32, 48]) {
      const label = document.createElement('span');
      label.textContent = `${size} px`;
      sizes.append(label);
    }
    card.append(heading, file, sizes);
    for (const background of ['light', 'dark']) {
      const samples = document.createElement('div');
      samples.className = `icon-samples icon-${background}`;
      samples.setAttribute('role', 'img');
      samples.dataset.thAria = `${thai} บนพื้น${background === 'light' ? 'สว่าง' : 'มืด'} ขนาด 18, 32 และ 48 พิกเซล`;
      samples.dataset.enAria = `${english} on a ${background} background at 18, 32 and 48 pixels`;
      for (const size of [18, 32, 48]) {
        const slot = document.createElement('span');
        const image = document.createElement('img');
        image.src = file.href;
        image.width = image.height = size;
        image.alt = '';
        slot.append(image);
        samples.append(slot);
      }
      card.append(samples);
    }
    parent.append(card);
  }
}
