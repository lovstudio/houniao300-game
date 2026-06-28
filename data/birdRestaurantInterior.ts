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
    radiusTiles: 4.2,
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
    radiusTiles: 8.4,
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

// interiorId 约定：非手工编排的实体直接复用其「物料 key」作为 interiorId，
// 即 venue → 'venue:<refId>'，作品 → 'work:<slug>'；手工编排的内场则用其自身 id。
// 这样 readiness 判定（查 materials 表的同名 key）与进入用的 id 是同一个字符串，简单一致。
export function workInteriorId(slug: string) {
  return `work:${slug}`;
}
export function venueInteriorId(refId: string) {
  return `venue:${refId}`;
}

// 通用默认内场：一个四面围墙、底部中央开门的素房间（源 1280×720 → 80×45 格）。
// 作为兜底：实体被请求进入、但既无手工地图也无已生成几何时，回退到它，保证永不硬报错。
export const DEFAULT_BUILDING_INTERIOR: VenueInteriorMap = {
  id: 'default-building-interior',
  venue: '内部空间',
  subtitle: '可走动的建筑内部',
  source: { imageName: '', width: 1280, height: 720, capturedAt: '' },
  mapWidth: 40,
  mapHeight: 23,
  entrance: {
    exteriorSource: [640, 690],
    interiorSource: [640, 600],
    radiusTiles: 6,
  },
  labels: [
    { id: 'label-title', label: '内部空间', x: 640, y: 110 },
    { id: 'label-entry', label: '入口', x: 640, y: 600 },
  ],
  rects: [
    { id: 'wall-top', x: 0, y: 0, width: 1280, height: 56, kind: 'wall' },
    { id: 'wall-left', x: 0, y: 0, width: 56, height: 720, kind: 'wall' },
    { id: 'wall-right', x: 1224, y: 0, width: 56, height: 720, kind: 'wall' },
    { id: 'wall-bottom-left', x: 0, y: 664, width: 520, height: 56, kind: 'wall' },
    { id: 'wall-bottom-right', x: 760, y: 664, width: 520, height: 56, kind: 'wall' },
    { id: 'entry-field', x: 540, y: 560, width: 200, height: 160, kind: 'entry', walkable: true },
  ],
  circles: [{ id: 'entry-light', x: 640, y: 620, radius: 36, kind: 'light', walkable: true }],
};

export function defaultInterior(id: string): VenueInteriorMap {
  return { ...DEFAULT_BUILDING_INTERIOR, id };
}

// materials.regenerate（VENUE_SYSTEM）产出的几何 JSON 结构。坐标固定在 1280×720 虚拟画布内。
export type GeneratedInterior = {
  subtitle?: string;
  labels?: InteriorLabel[];
  rects?: InteriorRect[];
  circles?: InteriorCircle[];
};

// 在固定 1280×720 画布上挑一个可走动出生点：优先 entry/path/aisle/light 类可走形状的中心，
// 否则退回画布中心，避免把玩家生成在墙体里。
function pickSpawn(gen: GeneratedInterior): SourcePoint {
  const isSpawnZone = (k: string) => k === 'entry' || k === 'path' || k === 'aisle';
  const rect = (gen.rects ?? []).find((r) => r.walkable && isSpawnZone(r.kind));
  if (rect) return [rect.x + rect.width / 2, rect.y + rect.height / 2];
  const circle = (gen.circles ?? []).find((c) => c.walkable);
  if (circle) return [circle.x, circle.y];
  return [640, 360];
}

// 把已生成几何包装成一张完整内场地图（补齐 source/entrance/venue 等渲染与建图所需字段）。
export function interiorFromGenerated(
  id: string,
  gen: GeneratedInterior,
  venue = '内部空间',
): VenueInteriorMap {
  const spawn = pickSpawn(gen);
  return {
    id,
    venue,
    subtitle: gen.subtitle ?? '可走动内景',
    source: { imageName: '', width: 1280, height: 720, capturedAt: '' },
    mapWidth: 40,
    mapHeight: 23,
    entrance: { exteriorSource: [640, 690], interiorSource: spawn, radiusTiles: 6 },
    labels: gen.labels ?? [],
    rects: gen.rects ?? [],
    circles: gen.circles ?? [],
  };
}

// 纯静态解析（无 DB）：手工编排优先，已知前缀回退默认空房间。仅作前端兜底；
// 接入「已生成几何」的解析在 convex/interiors.ts（需读 materials 表）。
export function resolveInterior(id: string): VenueInteriorMap | undefined {
  const authored = getVenueInterior(id);
  if (authored) return authored;
  if (id.startsWith('work:') || id.startsWith('venue:')) return defaultInterior(id);
  return undefined;
}
