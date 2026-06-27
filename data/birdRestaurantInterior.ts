export type SourcePoint = [number, number];

export type InteriorRect = {
  id: string;
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
  kind:
    | 'wall'
    | 'sand'
    | 'sea'
    | 'mound'
    | 'bridge'
    | 'shadow'
    | 'path'
    | 'stall'
    | 'counter'
    | 'stage'
    | 'speaker'
    | 'table'
    | 'seat'
    | 'sofa'
    | 'aisle'
    | 'entry'
    | 'light';
  walkable?: boolean;
};

export type InteriorCircle = {
  id: string;
  label?: string;
  x: number;
  y: number;
  radius: number;
  kind: 'table' | 'seat' | 'sofa' | 'light';
  walkable?: boolean;
};

export type InteriorLabel = {
  id: string;
  label: string;
  x: number;
  y: number;
  align?: 'left' | 'center' | 'right';
};

export type VenueInteriorMap = {
  id: string;
  venue: string;
  scene?: 'restaurant' | 'bridge';
  subtitle?: string;
  source: {
    imageName: string;
    width: number;
    height: number;
    capturedAt: string;
  };
  mapWidth: number;
  mapHeight: number;
  entrance: {
    exteriorSource: SourcePoint;
    interiorSource: SourcePoint;
    radiusTiles: number;
  };
  labels: InteriorLabel[];
  rects: InteriorRect[];
  circles: InteriorCircle[];
};

export const BIRD_RESTAURANT_INTERIOR: VenueInteriorMap = {
  id: 'bird-restaurant-interior',
  venue: '鸟其林',
  scene: 'restaurant',
  subtitle: '夜市棚 · 餐桌 · 摊位 · 演出角',
  source: {
    imageName: '鸟其林.jpeg',
    width: 1280,
    height: 720,
    capturedAt: '2026-06-22 02:44:18',
  },
  mapWidth: 40,
  mapHeight: 24,
  entrance: {
    exteriorSource: [1338, 760],
    interiorSource: [640, 690],
    radiusTiles: 2.1,
  },
  labels: [
    { id: 'label-entry', label: '入口', x: 640, y: 680 },
    { id: 'label-left-stalls', label: '胖妹面庄 / 火锅面 / 冰沙', x: 160, y: 112 },
    { id: 'label-center-stalls', label: '烧烤吧台', x: 500, y: 170 },
    { id: 'label-stage', label: '演出角', x: 840, y: 155 },
    { id: 'label-main-dining', label: '多人餐区', x: 600, y: 430 },
    { id: 'label-lounge', label: '沙发区', x: 1040, y: 535 },
  ],
  rects: [
    { id: 'back-wall-left', x: 28, y: 34, width: 332, height: 172, kind: 'wall' },
    { id: 'back-wall-center', x: 382, y: 36, width: 282, height: 188, kind: 'wall' },
    { id: 'back-wall-stage', x: 690, y: 14, width: 520, height: 232, kind: 'wall' },
    {
      id: 'left-red-stall',
      label: '红色菜单摊位',
      x: 34,
      y: 66,
      width: 286,
      height: 142,
      kind: 'stall',
    },
    { id: 'left-service-table', x: 36, y: 208, width: 240, height: 54, kind: 'counter' },
    { id: 'center-service-counter', x: 420, y: 156, width: 178, height: 72, kind: 'counter' },
    { id: 'center-sign-board', x: 470, y: 88, width: 156, height: 70, kind: 'stall' },
    {
      id: 'stage-platform',
      label: '小舞台',
      x: 714,
      y: 176,
      width: 258,
      height: 96,
      kind: 'stage',
    },
    { id: 'stage-left-speaker', x: 700, y: 138, width: 34, height: 92, kind: 'speaker' },
    { id: 'stage-right-speaker', x: 970, y: 145, width: 38, height: 96, kind: 'speaker' },
    { id: 'far-right-speaker', x: 1208, y: 158, width: 32, height: 90, kind: 'speaker' },
    { id: 'right-food-banner', x: 1200, y: 54, width: 68, height: 110, kind: 'stall' },
    { id: 'entry-aisle', x: 562, y: 590, width: 160, height: 112, kind: 'entry', walkable: true },
    { id: 'center-aisle', x: 548, y: 270, width: 150, height: 332, kind: 'aisle', walkable: true },
    { id: 'left-aisle', x: 284, y: 252, width: 108, height: 362, kind: 'aisle', walkable: true },
    { id: 'right-aisle', x: 930, y: 286, width: 126, height: 318, kind: 'aisle', walkable: true },
    { id: 'sofa-cream', x: 740, y: 525, width: 180, height: 92, kind: 'sofa' },
    { id: 'sofa-right', x: 1050, y: 495, width: 150, height: 84, kind: 'sofa' },
    { id: 'front-left-table', x: 28, y: 616, width: 230, height: 80, kind: 'table' },
    { id: 'front-center-table', x: 398, y: 638, width: 170, height: 68, kind: 'table' },
    { id: 'front-right-table', x: 1000, y: 610, width: 188, height: 72, kind: 'table' },
  ],
  circles: [
    { id: 'table-left-1', x: 124, y: 332, radius: 44, kind: 'table' },
    { id: 'table-left-2', x: 224, y: 454, radius: 50, kind: 'table' },
    { id: 'table-mid-1', x: 454, y: 318, radius: 46, kind: 'table' },
    { id: 'table-mid-2', x: 592, y: 378, radius: 52, kind: 'table' },
    { id: 'table-mid-3', x: 470, y: 506, radius: 50, kind: 'table' },
    { id: 'table-right-1', x: 768, y: 344, radius: 48, kind: 'table' },
    { id: 'table-right-2', x: 850, y: 430, radius: 48, kind: 'table' },
    { id: 'table-right-3', x: 1068, y: 388, radius: 50, kind: 'table' },
    { id: 'table-right-4', x: 1128, y: 480, radius: 46, kind: 'table' },
    { id: 'seat-left-1', x: 76, y: 404, radius: 20, kind: 'seat' },
    { id: 'seat-left-2', x: 262, y: 360, radius: 20, kind: 'seat' },
    { id: 'seat-mid-1', x: 524, y: 294, radius: 18, kind: 'seat' },
    { id: 'seat-mid-2', x: 660, y: 455, radius: 20, kind: 'seat' },
    { id: 'seat-right-1', x: 730, y: 500, radius: 20, kind: 'seat' },
    { id: 'seat-right-2', x: 1180, y: 420, radius: 20, kind: 'seat' },
    { id: 'warm-light-left', x: 430, y: 138, radius: 24, kind: 'light', walkable: true },
    { id: 'warm-light-stage', x: 760, y: 120, radius: 30, kind: 'light', walkable: true },
  ],
};

export const I3_BRIDGE_FIELD_INTERIOR: VenueInteriorMap = {
  id: 'i3-bridge-field',
  venue: 'I3 桥下场域',
  scene: 'bridge',
  subtitle: '沙丘墩 · 横梁 · 桥下通道 · 海向视野',
  source: {
    imageName: '李振伟-桥.jpeg',
    width: 1280,
    height: 720,
    capturedAt: '2026-06-27',
  },
  mapWidth: 40,
  mapHeight: 23,
  entrance: {
    exteriorSource: [1294, 986],
    interiorSource: [640, 530],
    radiusTiles: 4.2,
  },
  labels: [
    { id: 'label-title', label: '桥下场域', x: 640, y: 120 },
    { id: 'label-sea', label: '向海开口', x: 640, y: 274 },
    { id: 'label-left-mound', label: '左侧沙丘墩', x: 240, y: 360 },
    { id: 'label-right-mound', label: '右侧沙丘墩', x: 1040, y: 360 },
    { id: 'label-entry', label: '进入', x: 640, y: 570 },
  ],
  rects: [
    { id: 'left-mound', x: 58, y: 188, width: 455, height: 330, radius: 210, kind: 'mound' },
    { id: 'right-mound', x: 768, y: 188, width: 455, height: 330, radius: 210, kind: 'mound' },
    { id: 'bridge-shadow', x: 152, y: 194, width: 976, height: 48, kind: 'shadow' },
    { id: 'bridge-beam', x: 154, y: 165, width: 972, height: 32, kind: 'bridge' },
    { id: 'underpass', x: 512, y: 238, width: 256, height: 252, radius: 80, kind: 'path', walkable: true },
    { id: 'entry-field', x: 500, y: 450, width: 280, height: 168, radius: 84, kind: 'entry', walkable: true },
  ],
  circles: [
    { id: 'entry-light', x: 640, y: 530, radius: 38, kind: 'light', walkable: true },
  ],
};

export const VENUE_INTERIOR_MAPS = [BIRD_RESTAURANT_INTERIOR, I3_BRIDGE_FIELD_INTERIOR] as const;
export type VenueInteriorId = (typeof VENUE_INTERIOR_MAPS)[number]['id'];

export function getVenueInterior(id: string) {
  return VENUE_INTERIOR_MAPS.find((interior) => interior.id === id);
}
