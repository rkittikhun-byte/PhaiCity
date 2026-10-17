/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

import { Vector3, type PerspectiveCamera } from 'three';
import type { CityCamera } from './camera.js';
import type { CityHeightField } from './heightfield.js';

export interface LandmarkInfo {
  id: string;
  nameTh: string;
  nameEn: string;
  categoryTh: string;
  icon: string;
  tileX: number;
  tileY: number;
  descTh: string;
  descEn: string;
}

const KHON_KAEN_LANDMARKS = (centerX: number, centerY: number): LandmarkInfo[] => [
  {
    id: 'shrine',
    nameTh: 'ศาลหลักเมืองขอนแก่น',
    nameEn: 'Khon Kaen City Pillar Shrine',
    categoryTh: '🏛️ ศูนย์รวมจิตใจชาวขอนแก่น',
    icon: '🏛️',
    tileX: centerX,
    tileY: centerY,
    descTh: 'ศูนย์รวมจิตใจของชาวเมืองขอนแก่น สถาปัตยกรรมไทยประยุกต์ร่วมสมัยประดับลวดลายอีสาน ประดิษฐานเสาหลักเมืองที่เคารพสักการะ',
    descEn: 'The spiritual heart of Khon Kaen, featuring contemporary Thai-Isan architecture and honoring the city pillar.'
  },
  {
    id: 'lake',
    nameTh: 'บึงแก่นนคร',
    nameEn: 'Kaen Nakhon Lake',
    categoryTh: '🌊 ปอดใจกลางเมือง 603 ไร่',
    icon: '🌊',
    tileX: centerX + 9,
    tileY: centerY + 11,
    descTh: 'บึงน้ำธรรมชาติขนาดใหญ่ใจกลางเมืองขอนแก่น เนื้อที่กว่า 603 ไร่ แหล่งพักผ่อนหย่อนใจ ทางวิ่งออกกำลังกายริมน้ำ และทัศนียภาพอันงดงาม',
    descEn: 'A sprawling 603-rai natural lake in the urban core, offering scenic jogging promenades, cultural plazas, and sunset views.'
  },
  {
    id: 'central',
    nameTh: 'เซ็นทรัลพลาซา ขอนแก่น',
    nameEn: 'Central Khon Kaen',
    categoryTh: '🛍️ ศูนย์กลางการค้าและเศรษฐกิจ',
    icon: '🛍️',
    tileX: centerX - 10,
    tileY: centerY - 7,
    descTh: 'ศูนย์การค้าและไลฟ์สไตล์ระดับภูมิภาคบนถนนมิตรภาพ โดดเด่นด้วยสถาปัตยกรรมอัตลักษณ์อีสานที่จำลองลวดลายกระติบข้าวเหนียวขนาดยักษ์',
    descEn: 'Regional shopping and lifestyle nexus on Mittraphap Highway, iconic for its facade inspired by traditional woven sticky-rice containers.'
  },
  {
    id: 'kku',
    nameTh: 'มหาวิทยาลัยขอนแก่น (มข.)',
    nameEn: 'Khon Kaen University (KKU)',
    categoryTh: '🎓 ศูนย์กลางวิชาการและการแพทย์',
    icon: '🎓',
    tileX: centerX - 15,
    tileY: centerY - 16,
    descTh: 'มหาวิทยาลัยแห่งแรกของภาคอีสาน ก่อตั้งปี พ.ศ. 2507 ศูนย์กลางด้านการศึกษา วิจัยนวัตกรรม และการแพทย์ชั้นนำของภูมิภาคอินโดจีน',
    descEn: 'First university in Northeast Thailand (est. 1964), leading education, medical excellence, and research across the Greater Mekong Subregion.'
  },
  {
    id: 'station',
    nameTh: 'สถานีรถไฟลอยฟ้าขอนแก่น',
    nameEn: 'Khon Kaen Elevated Railway Station',
    categoryTh: '🚉 ชุมทางคมนาคมทางคู่',
    icon: '🚉',
    tileX: centerX - 4,
    tileY: centerY + 5,
    descTh: 'สถานีรถไฟทางคู่ยกระดับแห่งแรกในภาคอีสาน ความยาวทางวิ่งลอยฟ้ากว่า 5.2 กม. รองรับการเชื่อมต่อสู่ระเบียงเศรษฐกิจและรถไฟความเร็วสูง',
    descEn: 'The first elevated dual-track station in Isan with a 5.2 km viaduct, unlocking seamless transit toward Vientiane and Kunming.'
  }
];

const GENERIC_LANDMARKS = (centerX: number, centerY: number, provinceName?: string): LandmarkInfo[] => [
  {
    id: 'city_hall',
    nameTh: `ศาลากลาง${provinceName ?? 'ประจำเมือง'}`,
    nameEn: 'City Hall & Civic Center',
    categoryTh: '🏛️ ศูนย์ราชการและบริหารเมือง',
    icon: '🏛️',
    tileX: centerX,
    tileY: centerY,
    descTh: 'ศูนย์กลางการบริหารงานราชการและบริการประชาชน จุดเริ่มต้นการวางโครงข่ายผังเมืองและการพัฒนาโครงสร้างพื้นฐาน',
    descEn: 'The municipal headquarters and civic administration core, initiating urban growth and infrastructural planning.'
  },
  {
    id: 'park',
    nameTh: 'สวนสาธารณะใจกลางเมือง',
    nameEn: 'Central Botanical Park',
    categoryTh: '🌳 พื้นที่สีเขียวและสุขภาพ',
    icon: '🌳',
    tileX: centerX + 8,
    tileY: centerY + 7,
    descTh: 'พื้นที่สีเขียวสาธารณะ แหล่งฟอกอากาศและลานกิจกรรมของชาวเมือง ล้อมรอบด้วยต้นไม้พื้นถิ่นและสระน้ำร่มรื่น',
    descEn: 'Community green lung providing ecological recreation, shady native flora, and civic walking tracks.'
  },
  {
    id: 'commercial',
    nameTh: 'ย่านการค้าพาณิชย์',
    nameEn: 'Commercial & Market District',
    categoryTh: '🏪 แหล่งเศรษฐกิจและตลาดชุมชน',
    icon: '🏪',
    tileX: centerX - 8,
    tileY: centerY - 6,
    descTh: 'ย่านค้าขาย อาคารพาณิชย์ ตลาดสดชุมชน และศูนย์กระจายสินค้าที่สร้างรายได้และความคึกคักให้กับเมือง',
    descEn: 'Vibrant local bazaar, shophouses, and trading hub sustaining municipal commerce and jobs.'
  }
];

export class CityHotspotsView {
  private readonly rootOverlay: HTMLDivElement;
  private readonly markersContainer: HTMLDivElement;
  private readonly cardModal: HTMLDivElement;
  private readonly tourBanner: HTMLDivElement;
  private readonly tourBtn: HTMLButtonElement;
  private readonly landmarks: LandmarkInfo[];
  private readonly markerElements: Map<string, HTMLDivElement> = new Map();
  private activeLandmark: LandmarkInfo | null = null;
  private inTour = false;
  private tourIndex = 0;
  private tourTime = 0;
  private orbitingLandmark: LandmarkInfo | null = null;
  private readonly tempPos = new Vector3();

  constructor(
    private readonly container: HTMLElement,
    private readonly camera: CityCamera,
    private readonly terrain: CityHeightField,
    mapWidth: number,
    mapHeight: number,
    town?: { x: number; y: number } | null,
    provinceId?: string | null,
  ) {
    const cx = Math.max(16, Math.min(mapWidth - 17, town?.x ?? Math.floor(mapWidth / 2)));
    const cy = Math.max(16, Math.min(mapHeight - 17, town?.y ?? Math.floor(mapHeight / 2)));

    const isKhonKaen = provinceId === 'TH-40' || !provinceId;
    this.landmarks = (isKhonKaen ? KHON_KAEN_LANDMARKS(cx, cy) : GENERIC_LANDMARKS(cx, cy, provinceId ?? undefined))
      .filter(l => l.tileX >= 1 && l.tileX < mapWidth - 1 && l.tileY >= 1 && l.tileY < mapHeight - 1);

    // Root overlay container
    this.rootOverlay = document.createElement('div');
    this.rootOverlay.id = 'phaicity-hotspots-overlay';
    this.rootOverlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:22;font-family:Sarabun,sans-serif;';

    // Markers layer
    this.markersContainer = document.createElement('div');
    this.markersContainer.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    this.rootOverlay.appendChild(this.markersContainer);

    // Modern Frosted Glass Card Modal
    this.cardModal = document.createElement('div');
    this.cardModal.id = 'phaicity-landmark-card';
    this.cardModal.style.cssText = `
      position: absolute; bottom: 24px; left: 24px; max-width: 380px; width: calc(100% - 48px);
      background: rgba(18, 24, 38, 0.88); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.22); border-radius: 16px; padding: 18px 20px;
      color: #fff; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55); pointer-events: auto;
      transform: translateY(120%); opacity: 0; transition: transform 0.32s cubic-bezier(0.16,1,0.3,1), opacity 0.32s ease;
      z-index: 30;
    `;
    this.rootOverlay.appendChild(this.cardModal);

    // Tour mode banner
    this.tourBanner = document.createElement('div');
    this.tourBanner.id = 'phaicity-tour-banner';
    this.tourBanner.style.cssText = `
      position: absolute; top: 16px; left: 50%; transform: translateX(-50%) translateY(-100px);
      background: rgba(14, 20, 32, 0.92); backdrop-filter: blur(12px); border: 1px solid rgba(0, 210, 255, 0.45);
      border-radius: 30px; padding: 10px 24px; color: #fff; font-size: 14px; font-weight: 500;
      box-shadow: 0 8px 28px rgba(0, 180, 255, 0.25); pointer-events: auto; display: flex; align-items: center; gap: 12px;
      transition: transform 0.35s cubic-bezier(0.16,1,0.3,1); z-index: 35;
    `;
    this.rootOverlay.appendChild(this.tourBanner);

    // Top control: Tour Button
    this.tourBtn = document.createElement('button');
    this.tourBtn.type = 'button';
    this.tourBtn.title = 'โหมดบินชมเมืองอัตโนมัติ (Cinematic Drone Tour)';
    this.tourBtn.innerHTML = '<span style="font-size:15px;margin-right:5px;">🎥</span><span style="font-size:12px;font-weight:600;letter-spacing:0.3px;">บินชมเมือง</span>';
    this.tourBtn.style.cssText = `
      position: fixed; top: 6px; right: 146px; z-index: 25; height: 28px; padding: 0 12px;
      border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.28); background: rgba(20, 25, 38, 0.78);
      color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      transition: all 0.2s ease;
    `;
    this.tourBtn.addEventListener('mouseenter', () => { this.tourBtn.style.background = 'rgba(35, 55, 85, 0.9)'; });
    this.tourBtn.addEventListener('mouseleave', () => { if (!this.inTour) this.tourBtn.style.background = 'rgba(20, 25, 38, 0.78)'; });
    this.tourBtn.addEventListener('click', () => this.toggleTour());

    this.container.appendChild(this.rootOverlay);
    this.container.appendChild(this.tourBtn);

    this.createMarkers();
    this.bindEvents();
  }

  private createMarkers(): void {
    for (const landmark of this.landmarks) {
      const pin = document.createElement('div');
      pin.className = 'phaicity-3d-hotspot-pin';
      pin.style.cssText = `
        position: absolute; pointer-events: auto; cursor: pointer; transform: translate(-50%, -100%);
        display: flex; align-items: center; gap: 6px; background: rgba(18, 25, 40, 0.82);
        backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        border: 1.5px solid rgba(255, 255, 255, 0.38); border-radius: 20px; padding: 5px 12px;
        color: #ffffff; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45); user-select: none;
        transition: transform 0.18s cubic-bezier(0.16,1,0.3,1), border-color 0.2s ease, background 0.2s ease;
        will-change: transform, left, top;
      `;

      pin.innerHTML = `
        <span style="font-size:16px;line-height:1;">${landmark.icon}</span>
        <span style="font-size:12px;font-weight:600;white-space:nowrap;letter-spacing:0.2px;text-shadow:0 1px 3px rgba(0,0,0,0.8);">${landmark.nameTh}</span>
      `;

      pin.addEventListener('mouseenter', () => {
        pin.style.transform = 'translate(-50%, -105%) scale(1.1)';
        pin.style.borderColor = '#38bdf8';
        pin.style.background = 'rgba(28, 45, 75, 0.95)';
        pin.style.boxShadow = '0 8px 24px rgba(56, 189, 248, 0.45)';
      });

      pin.addEventListener('mouseleave', () => {
        pin.style.transform = 'translate(-50%, -100%) scale(1)';
        pin.style.borderColor = 'rgba(255, 255, 255, 0.38)';
        pin.style.background = 'rgba(18, 25, 40, 0.82)';
        pin.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.45)';
      });

      pin.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectLandmark(landmark);
      });

      this.markersContainer.appendChild(pin);
      this.markerElements.set(landmark.id, pin);
    }
  }

  private bindEvents(): void {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.inTour) this.stopTour();
        else if (this.activeLandmark) this.closeCard();
      }
    });
  }

  selectLandmark(landmark: LandmarkInfo): void {
    this.activeLandmark = landmark;
    this.orbitingLandmark = null;

    // Fly camera smoothly to landmark
    this.camera.centreOn(landmark.tileX, landmark.tileY);
    this.camera.distance = Math.min(220, Math.max(90, this.camera.distance));

    // Render modern detail card
    this.cardModal.innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;">
        <div>
          <span style="display:inline-block;background:rgba(56,189,248,0.2);color:#38bdf8;font-size:11px;font-weight:600;padding:2px 8px;border-radius:10px;margin-bottom:6px;border:1px solid rgba(56,189,248,0.35);">
            ${landmark.categoryTh}
          </span>
          <h3 style="margin:0;font-size:17px;font-weight:700;color:#fff;line-height:1.3;">
            ${landmark.icon} ${landmark.nameTh}
          </h3>
          <div style="font-size:11px;color:#94a3b8;font-weight:400;margin-top:1px;">${landmark.nameEn}</div>
        </div>
        <button type="button" id="card-close-btn" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;padding:2px 6px;line-height:1;border-radius:6px;">✕</button>
      </div>
      <p style="margin:0 0 14px 0;font-size:13px;line-height:1.55;color:#e2e8f0;font-weight:400;">
        ${landmark.descTh}
      </p>
      <div style="display:flex;gap:8px;">
        <button type="button" id="card-orbit-btn" style="flex:1;background:linear-gradient(135deg,#0284c7,#0369a1);border:1px solid rgba(255,255,255,0.25);border-radius:10px;color:#fff;padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;box-shadow:0 2px 8px rgba(2,132,199,0.4);">
          <span>🚁</span><span>บินวน 360° รอบจุดนี้</span>
        </button>
      </div>
    `;

    const closeBtn = this.cardModal.querySelector('#card-close-btn') as HTMLButtonElement | null;
    closeBtn?.addEventListener('click', () => this.closeCard());

    const orbitBtn = this.cardModal.querySelector('#card-orbit-btn') as HTMLButtonElement | null;
    orbitBtn?.addEventListener('click', () => {
      this.orbitingLandmark = landmark;
    });

    this.cardModal.style.transform = 'translateY(0)';
    this.cardModal.style.opacity = '1';
  }

  closeCard(): void {
    this.activeLandmark = null;
    this.orbitingLandmark = null;
    this.cardModal.style.transform = 'translateY(120%)';
    this.cardModal.style.opacity = '0';
  }

  toggleTour(): void {
    if (this.inTour) this.stopTour();
    else this.startTour();
  }

  startTour(): void {
    if (this.landmarks.length === 0) return;
    this.inTour = true;
    this.tourIndex = 0;
    this.tourTime = 0;
    this.closeCard();

    this.tourBtn.style.background = 'linear-gradient(135deg,#0284c7,#0369a1)';
    this.tourBtn.style.borderColor = '#38bdf8';

    const current = this.landmarks[0];
    this.camera.centreOn(current.tileX, current.tileY);
    this.camera.distance = 180;
    this.camera.pitch = 45 * Math.PI / 180;

    this.tourBanner.innerHTML = `
      <span style="font-size:16px;">🎥</span>
      <span>กำลังบินชมเมือง: <strong>${current.nameTh}</strong></span>
      <button type="button" id="tour-stop-btn" style="background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.4);border-radius:14px;color:#fff;padding:2px 10px;font-size:11px;font-weight:600;cursor:pointer;margin-left:8px;">กด Esc เพื่อออก</button>
    `;
    this.tourBanner.style.transform = 'translateX(-50%) translateY(0)';

    const stopBtn = this.tourBanner.querySelector('#tour-stop-btn') as HTMLButtonElement | null;
    stopBtn?.addEventListener('click', () => this.stopTour());
  }

  stopTour(): void {
    this.inTour = false;
    this.orbitingLandmark = null;
    this.tourBtn.style.background = 'rgba(20, 25, 38, 0.78)';
    this.tourBtn.style.borderColor = 'rgba(255, 255, 255, 0.28)';
    this.tourBanner.style.transform = 'translateX(-50%) translateY(-100px)';
  }

  update(perspectiveCam: PerspectiveCamera, width: number, height: number, dt: number): void {
    // 1. Tour cinematic drone motion
    if (this.inTour && this.landmarks.length > 0) {
      this.tourTime += dt;
      this.camera.rotate(dt * 12, 0); // Gentle continuous orbit

      if (this.tourTime >= 9.0) {
        this.tourTime = 0;
        this.tourIndex = (this.tourIndex + 1) % this.landmarks.length;
        const next = this.landmarks[this.tourIndex];
        this.camera.centreOn(next.tileX, next.tileY);
        this.tourBanner.innerHTML = `
          <span style="font-size:16px;">🎥</span>
          <span>กำลังบินชมเมือง: <strong>${next.nameTh}</strong></span>
          <button type="button" id="tour-stop-btn" style="background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.4);border-radius:14px;color:#fff;padding:2px 10px;font-size:11px;font-weight:600;cursor:pointer;margin-left:8px;">กด Esc เพื่อออก</button>
        `;
        const stopBtn = this.tourBanner.querySelector('#tour-stop-btn') as HTMLButtonElement | null;
        stopBtn?.addEventListener('click', () => this.stopTour());
      }
    } else if (this.orbitingLandmark) {
      // 360 degree orbit around selected landmark
      this.camera.rotate(dt * 18, 0);
    }

    // 2. Project 3D Hotspot pins onto 2D screen coordinates
    for (const landmark of this.landmarks) {
      const el = this.markerElements.get(landmark.id);
      if (!el) continue;

      const wx = (landmark.tileX + 0.5) * 10;
      const wz = (landmark.tileY + 0.5) * 10;
      const wy = (this.terrain?.enabled ? this.terrain.sample(wx, wz) : 0) + 12;

      this.tempPos.set(wx, wy, wz).project(perspectiveCam);

      const inFront = this.tempPos.z < 1 && Math.abs(this.tempPos.x) <= 1.08 && Math.abs(this.tempPos.y) <= 1.08;

      if (!inFront || this.camera.distance > 850 || this.inTour) {
        el.style.display = 'none';
      } else {
        el.style.display = 'flex';
        const sx = (this.tempPos.x * 0.5 + 0.5) * width;
        const sy = (-this.tempPos.y * 0.5 + 0.5) * height;
        el.style.left = `${Math.round(sx)}px`;
        el.style.top = `${Math.round(sy)}px`;
      }
    }
  }

  dispose(): void {
    this.rootOverlay.remove();
    this.tourBtn.remove();
    this.markerElements.clear();
  }
}
