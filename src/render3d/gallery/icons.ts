/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

export const TOOL_ICONS = [
  ['residential', 'บ้านพักอาศัย', 'Residential'],
  ['commercial', 'ตึกแถว', 'Commercial'],
  ['industrial', 'โรงงาน', 'Industrial'],
  ['road', 'ถนน', 'Road'],
  ['rail', 'ทางรถไฟ', 'Rail'],
  ['wire', 'สายไฟ', 'Wire'],
  ['park', 'สวน', 'Park'],
  ['police', 'ตำรวจ', 'Police'],
  ['fire', 'ดับเพลิง', 'Fire'],
  ['coal', 'โรงไฟฟ้าถ่านหิน', 'Coal power'],
  ['nuclear', 'โรงไฟฟ้านิวเคลียร์', 'Nuclear power'],
  ['stadium', 'สนามกีฬา', 'Stadium'],
  ['port', 'ท่าเรือ', 'Port'],
  ['airport', 'สนามบิน', 'Airport'],
  ['bulldozer', 'รื้อถอน', 'Bulldozer'],
  ['query', 'ตรวจสอบ', 'Query'],
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
