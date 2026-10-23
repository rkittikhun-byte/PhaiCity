/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The register's names (docs/GAME_DESIGN.md 20.2): Thai given names, common ones of the older and the younger
// generations, each with its romanised spelling; surnames made up of three parts (a word, a place word, an ending), as
// many Thai surnames are, but put together here rather than taken from any list of families; and the titles by sex and
// age. Names are the people's own, like the streets' (src/streetNames.ts): the card shows them in Thai, and in English
// romanised. Plain data: no DOM.

export interface Name { th: string; en: string }

type Pair = readonly [string, string];

/** Given names of people born before about forty years ago, men's and women's */
const OLDER_MEN: readonly Pair[] = [
  ["สมชาย", "Somchai"], ["สมศักดิ์", "Somsak"], ["ประเสริฐ", "Prasoet"], ["วิชัย", "Wichai"], ["สุชาติ", "Suchat"],
  ["บุญมี", "Bunmi"], ["ประยูร", "Prayun"], ["สมพงษ์", "Somphong"], ["ทองดี", "Thongdi"], ["มานพ", "Manop"],
  ["สุรชัย", "Surachai"], ["ชัยวัฒน์", "Chaiwat"], ["บุญเลิศ", "Bunloet"], ["อำนาจ", "Amnat"], ["สมบัติ", "Sombat"],
  ["เสถียร", "Sathian"], ["วีระ", "Wira"], ["ประสิทธิ์", "Prasit"], ["สุรพล", "Suraphon"], ["คำแดง", "Khamdaeng"],
  ["ทองใบ", "Thongbai"], ["บุญส่ง", "Bunsong"], ["สมาน", "Saman"], ["ไพโรจน์", "Phairot"],
];
const OLDER_WOMEN: readonly Pair[] = [
  ["สมหญิง", "Somying"], ["สุนีย์", "Suni"], ["มาลี", "Mali"], ["บุญมา", "Bunma"], ["ทองคำ", "Thongkham"],
  ["สมจิตร", "Somchit"], ["วันเพ็ญ", "Wanphen"], ["ประนอม", "Pranom"], ["สุดา", "Suda"], ["อรุณี", "Aruni"],
  ["จันทร์เพ็ญ", "Chanphen"], ["บัวผัน", "Buaphan"], ["ละเอียด", "La-iat"], ["สมพร", "Somphon"], ["เพ็ญศรี", "Phensi"],
  ["คำปุน", "Khampun"], ["นงลักษณ์", "Nongluk"], ["ราตรี", "Ratri"], ["สายสุนีย์", "Saisuni"], ["บุญเรือน", "Bunruean"],
  ["อำไพ", "Amphai"], ["ทองสุข", "Thongsuk"], ["มยุรี", "Mayuri"], ["บังอร", "Bang-on"],
];
/** ... and of the younger, men's and women's */
const YOUNGER_MEN: readonly Pair[] = [
  ["ณัฐพล", "Natthaphon"], ["ธนกร", "Thanakon"], ["กิตติพัฒน์", "Kittiphat"], ["ปิยะพงษ์", "Piyaphong"],
  ["ธีรภัทร", "Thiraphat"], ["อนุชา", "Anucha"], ["วรวุฒิ", "Worawut"], ["ศุภชัย", "Supphachai"], ["ชยพล", "Chayaphon"],
  ["ภาคิน", "Phakhin"], ["กฤษดา", "Kritsada"], ["ปัณณวัฒน์", "Pannawat"], ["ธนวัฒน์", "Thanawat"], ["พีรพัฒน์", "Phiraphat"],
  ["จิรายุ", "Chirayu"], ["ณภัทร", "Naphat"], ["สิรวิชญ์", "Sirawit"], ["อติวิชญ์", "Atiwit"], ["ภูริ", "Phuri"],
  ["ธนภัทร", "Thanaphat"], ["วชิรวิทย์", "Wachirawit"], ["กันตพงศ์", "Kantaphong"], ["ปกรณ์", "Pakon"], ["ชนาธิป", "Chanathip"],
];
const YOUNGER_WOMEN: readonly Pair[] = [
  ["ปุณณภา", "Punnapha"], ["ณัฐธิดา", "Natthida"], ["กัญญารัตน์", "Kanyarat"], ["ศิริพร", "Siriphon"],
  ["พิมพ์ชนก", "Phimchanok"], ["ชนิดา", "Chanida"], ["อรอุมา", "On-uma"], ["ธิดารัตน์", "Thidarat"], ["วรรณิศา", "Wannisa"],
  ["สุภาวดี", "Suphawadi"], ["ปภาวรินทร์", "Paphawarin"], ["ณิชาภัทร", "Nichaphat"], ["กมลชนก", "Kamonchanok"],
  ["จิราพร", "Chiraphon"], ["พัชราภา", "Phatcharapha"], ["ภัทรวดี", "Phattharawadi"], ["เบญจมาศ", "Benchamat"],
  ["อัญชลี", "Anchali"], ["ปาริชาติ", "Parichat"], ["ศศิธร", "Sasithon"], ["ญาณิศา", "Yanisa"], ["ชุติมา", "Chutima"],
  ["ธัญชนก", "Thanchanok"], ["รัตนาภรณ์", "Rattanaphon"],
];

/** The three parts of a made-up surname: a word, a place word, an ending (16 × 14 × 16 surnames) */
const SURNAME_FIRST: readonly Pair[] = [
  ["แก้ว", "Kaeo"], ["ทอง", "Thong"], ["ศรี", "Si"], ["บุญ", "Bun"], ["ใจ", "Chai"], ["สุข", "Suk"], ["เพชร", "Phet"],
  ["จันทร์", "Chan"], ["ดวง", "Duang"], ["คำ", "Kham"], ["พรหม", "Phrom"], ["มณี", "Mani"], ["นาค", "Nak"],
  ["รัตน", "Rattana"], ["อินทร", "Inthra"], ["แสง", "Saeng"],
];
const SURNAME_MIDDLE: readonly Pair[] = [
  ["ภู", "phu"], ["พนา", "phana"], ["ธารา", "thara"], ["สาย", "sai"], ["ดอน", "don"], ["หนอง", "nong"], ["โพธิ์", "pho"],
  ["นา", "na"], ["ไพร", "phrai"], ["ชล", "chon"], ["ศิลา", "sila"], ["เมฆ", "mek"], ["ลำ", "lam"], ["ทุ่ง", "thung"],
];
const SURNAME_LAST: readonly Pair[] = [
  ["วงศ์", "wong"], ["สกุล", "sakun"], ["ทอง", "thong"], ["ศรี", "si"], ["สุข", "suk"], ["เจริญ", "charoen"],
  ["ชัย", "chai"], ["พันธ์", "phan"], ["รักษ์", "rak"], ["ประเสริฐ", "prasoet"], ["กุล", "kun"], ["เดช", "det"],
  ["วัฒน์", "wat"], ["ไพศาล", "phaisan"], ["สมบูรณ์", "sombun"], ["ดี", "di"],
];

/** The age from which a person has a name of the older generation */
export const OLDER_FROM = 40;

/** How many given names there are for a sex and age, to pick among */
export function givenCount(male: boolean, age: number): number {
  return (age >= OLDER_FROM ? (male ? OLDER_MEN : OLDER_WOMEN) : (male ? YOUNGER_MEN : YOUNGER_WOMEN)).length;
}

/** The given name number n (taken round the list) for a sex and age */
export function givenName(male: boolean, age: number, n: number): Name {
  const list = age >= OLDER_FROM ? (male ? OLDER_MEN : OLDER_WOMEN) : (male ? YOUNGER_MEN : YOUNGER_WOMEN);
  const [th, en] = list[((n % list.length) + list.length) % list.length];
  return { th, en };
}

/** How many surnames there are */
export const SURNAMES = SURNAME_FIRST.length * SURNAME_MIDDLE.length * SURNAME_LAST.length;

/** The surname number n (0 to SURNAMES − 1) */
export function surname(n: number): Name {
  const k = ((n % SURNAMES) + SURNAMES) % SURNAMES;
  const a = SURNAME_FIRST[k % SURNAME_FIRST.length], rest = Math.floor(k / SURNAME_FIRST.length);
  const b = SURNAME_MIDDLE[rest % SURNAME_MIDDLE.length], c = SURNAME_LAST[Math.floor(rest / SURNAME_MIDDLE.length)];
  return { th: a[0] + b[0] + c[0], en: a[1] + b[1] + c[1] };
}

/** The title a person goes by: a boy or girl under 15 เด็กชาย / เด็กหญิง, a man นาย, a married woman นาง, any other
 * woman นางสาว (Mr, Mrs, Miss; Master for a boy) */
export function title(male: boolean, age: number, married: boolean): Name {
  if (age < 15) return male ? { th: "เด็กชาย", en: "Master" } : { th: "เด็กหญิง", en: "Miss" };
  if (male) return { th: "นาย", en: "Mr" };
  return married ? { th: "นาง", en: "Mrs" } : { th: "นางสาว", en: "Miss" };
}

/** A whole name as it is written: นายสมชาย แก้วพนาวงศ์, Mr Somchai Kaeophanawong */
export function fullName(titleOf: Name, given: Name, family: Name, language: "th" | "en"): string {
  return language === "th" ? `${titleOf.th}${given.th} ${family.th}` : `${titleOf.en} ${given.en} ${family.en}`;
}

/** What a shop's name ends with (ร้านสมชายการค้า, Somchai Trading) */
const SHOP_ENDINGS: readonly Pair[] = [
  ["การค้า", "Trading"], ["พานิช", "Store"], ["โภคภัณฑ์", "Goods"], ["ค้าส่ง", "Wholesale"], ["วัสดุ", "Supplies"],
  ["ยนต์", "Motors"], ["บริการ", "Services"], ["ผ้าไหม", "Silk"], ["ของชำ", "Grocery"], ["เครื่องเย็น", "Cooling"],
];
/** What a factory makes, by era (โรงงานทอผ้า…, … Weaving) */
const FACTORY_MAKES: Readonly<Record<number, readonly Pair[]>> = {
  1: [["ทอผ้า", "Weaving"], ["อิฐ", "Brickworks"], ["น้ำปลา", "Fish Sauce"], ["เครื่องจักสาน", "Basketry"]],
  2: [["ทอผ้า", "Weaving"], ["น้ำแข็ง", "Ice Works"], ["อิฐ", "Brickworks"], ["โม่หิน", "Stone Crushing"], ["เส้นหมี่", "Noodle Works"]],
  3: [["เฟอร์นิเจอร์", "Furniture"], ["อาหารกระป๋อง", "Canning"], ["น้ำแข็ง", "Ice Works"], ["ปูนซีเมนต์บล็อก", "Concrete Blocks"],
    ["เสื้อผ้าสำเร็จรูป", "Garments"]],
  4: [["ชิ้นส่วนยนต์", "Auto Parts"], ["อาหารแช่แข็ง", "Frozen Foods"], ["บรรจุภัณฑ์", "Packaging"], ["อิเล็กทรอนิกส์", "Electronics"]],
  5: [["แบตเตอรี่", "Batteries"], ["หุ่นยนต์", "Robotics"], ["ชีวภัณฑ์", "Bioproducts"], ["อิเล็กทรอนิกส์", "Electronics"]],
};
/** ... and a big business's word (บริษัท แก้วพนาอุตสาหกรรม จำกัด) */
const COMPANY_WORDS: readonly Pair[] = [
  ["อุตสาหกรรม", "Industry"], ["พัฒนา", "Development"], ["กรุ๊ป", "Group"], ["โฮลดิ้ง", "Holdings"], ["เทรดดิ้ง", "Trading"],
];

/** The first two parts of a surname, as a business takes it (แก้วพนา, Kaeophana) */
export function familyStem(n: number): Name {
  const k = ((n % SURNAMES) + SURNAMES) % SURNAMES;
  const a = SURNAME_FIRST[k % SURNAME_FIRST.length], b = SURNAME_MIDDLE[Math.floor(k / SURNAME_FIRST.length) % SURNAME_MIDDLE.length];
  return { th: a[0] + b[0], en: a[1] + b[1] };
}

const pick = <T>(list: readonly T[], u: number): T => list[Math.min(list.length - 1, Math.floor(u * list.length))];

/**
 * A business's name, made up from its owner's names and its trade (never a real brand): a small shop ร้าน<given><ending>,
 * a bigger one a partnership (ห้างหุ้นส่วนจำกัด <stem><ending>), the biggest of a modern era a company; a factory
 * โรงงาน<what it makes><stem>, a big one a company; a farm's hub by what it is to its fields; a harbour's fish market.
 */
export function businessName(kind: string, sort: string, level: number, era: number, given: Name, stem: Name, u: number): Name {
  if (kind === "shop") {
    const end = pick(SHOP_ENDINGS, u);
    if (level >= 4 && era >= 4) {
      const word = pick(COMPANY_WORDS, u);
      return { th: `บริษัท ${stem.th}${word[0]} จำกัด`, en: `${stem.en} ${word[1]} Co., Ltd.` };
    }
    if (level >= 3) return { th: `ห้างหุ้นส่วนจำกัด ${stem.th}${end[0]}`, en: `${stem.en} ${end[1]} Ltd. Partnership` };
    return { th: `ร้าน${given.th}${end[0]}`, en: `${given.en} ${end[1]}` };
  }
  if (kind === "factory") {
    if (level >= 3 && era >= 3) {
      const word = pick(COMPANY_WORDS, u);
      return { th: `บริษัท ${stem.th}${word[0]} จำกัด`, en: `${stem.en} ${word[1]} Co., Ltd.` };
    }
    const make = pick(FACTORY_MAKES[era] ?? FACTORY_MAKES[1], u);
    return { th: `โรงงาน${make[0]}${stem.th}`, en: `${stem.en} ${make[1]}` };
  }
  if (kind === "farm") {
    if (sort === "rice_mill") return { th: `โรงสีข้าว${stem.th}`, en: `${stem.en} Rice Mill` };
    if (sort === "cold_store") return { th: `ห้องเย็น${stem.th}`, en: `${stem.en} Cold Store` };
    return { th: `สหกรณ์การเกษตร${stem.th}`, en: `${stem.en} Farmers' Cooperative` };
  }
  return { th: `แพปลา${given.th}`, en: `${given.en} Fish Market` };
}

/** The consonants a plate's letters are drawn from (those Thai plates use) */
const PLATE_LETTERS = "กขคฆงจฉชซฌญฎฐฒณดตถทธนบปผพภมยรลวศษสหฬอฮ";

/** A made-up Thai plate (กข 1234 ขอนแก่น): two letters and a number, and the province when known; plates are written in
 * Thai in either language */
export function plate(u1: number, u2: number, province: string | null): string {
  const n = PLATE_LETTERS.length;
  const a = PLATE_LETTERS[Math.floor(u1 * n) % n], b = PLATE_LETTERS[Math.floor(u2 * n) % n];
  const number = 1 + Math.floor(((u1 * 7919 + u2 * 104729) % 1) * 9999);
  return `${a}${b} ${number}${province ? ` ${province}` : ""}`;
}
