export type SourceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SourcePoint = [number, number];

export type SourceCircle = {
  x: number;
  y: number;
  radius: number;
};

export type SourceSegment = {
  from: SourcePoint;
  to: SourcePoint;
  width: number;
  divisions: number;
};

export const SOURCE_WIDTH = 1703;
export const SOURCE_HEIGHT = 1279;

export const WORKSHOP_BUILDING_RECT: SourceRect = { x: 720, y: 652, width: 92, height: 146 };
export const EXCHANGE_BUILDING_RECT: SourceRect = { x: 1307, y: 240, width: 81, height: 220 };
export const RETRO_ART_BUILDING_RECT: SourceRect = { x: 1427, y: 311, width: 95, height: 155 };
export const LADDER_300_BUILDING_RECT: SourceRect = { x: 1449, y: 815, width: 72, height: 205 };
export const CLUB_ROUND_STAGE_CIRCLE: SourceCircle = { x: 1396, y: 968, radius: 25 };

function segmentToPolygon({ from, to, width }: SourceSegment): SourcePoint[] {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const length = Math.hypot(x2 - x1, y2 - y1);
  const nx = (-(y2 - y1) / length) * (width / 2);
  const ny = ((x2 - x1) / length) * (width / 2);
  return [
    [x1 + nx, y1 + ny],
    [x2 + nx, y2 + ny],
    [x2 - nx, y2 - ny],
    [x1 - nx, y1 - ny],
  ];
}

export const BIRD_RESTAURANT_WALL_SEGMENTS: SourceSegment[] = [
  { from: [1268, 508], to: [1336, 480], width: 18, divisions: 6 },
  { from: [1268, 512], to: [1270, 737], width: 18, divisions: 8 },
  { from: [1270, 737], to: [1317, 792], width: 18, divisions: 5 },
  { from: [1317, 792], to: [1352, 785], width: 18, divisions: 4 },
  { from: [1352, 785], to: [1405, 731], width: 18, divisions: 6 },
  { from: [1405, 533], to: [1405, 731], width: 18, divisions: 7 },
  { from: [1366, 491], to: [1405, 533], width: 18, divisions: 4 },
];

export const BIRD_RESTAURANT_WALLS: SourcePoint[][] =
  BIRD_RESTAURANT_WALL_SEGMENTS.map(segmentToPolygon);

export const ICE_JOYS_BUILDING_RECTS: SourceRect[] = [
  { x: 1428, y: 590, width: 96, height: 130 },
];

export const ICE_JOYS_SIDE_SLATS: SourceRect[] = [
  { x: 1530, y: 550, width: 8, height: 42 },
  { x: 1530, y: 724, width: 8, height: 40 },
];

export const CLUB_BUILDING_RECTS: SourceRect[] = [
  { x: 1336, y: 790, width: 70, height: 96 },
];

export const SECONDARY_WALL_STRUCTURES: SourcePoint[][] = [
  [
    [1550, 457],
    [1598, 566],
    [1573, 643],
    [1532, 534],
  ],
  [
    [1553, 566],
    [1582, 566],
    [1584, 673],
    [1555, 673],
  ],
  [
    [1583, 616],
    [1604, 616],
    [1605, 667],
    [1584, 667],
  ],
  [
    [1554, 686],
    [1599, 788],
    [1571, 873],
    [1534, 770],
  ],
];

// Thin divider rectangles extracted from the top plan in works-location PDF.
// Coordinates use the same 1703 x 1279 source grid as PixiStaticMap.
export const SPACE_BARRIERS: SourceRect[] = [
  { x: 550, y: 222, width: 10, height: 135 },
  { x: 639, y: 244, width: 8, height: 184 },
  { x: 706, y: 231, width: 8, height: 241 },
  { x: 792, y: 243, width: 8, height: 248 },
  { x: 876, y: 187, width: 8, height: 304 },
  { x: 956, y: 300, width: 8, height: 172 },
  { x: 1148, y: 371, width: 8, height: 204 },
  { x: 1222, y: 323, width: 8, height: 344 },
  { x: 486, y: 405, width: 8, height: 296 },
  { x: 528, y: 468, width: 8, height: 296 },
  { x: 626, y: 529, width: 8, height: 250 },
  { x: 860, y: 554, width: 8, height: 321 },
  { x: 975, y: 579, width: 8, height: 351 },
  { x: 1049, y: 621, width: 8, height: 319 },
  { x: 1123, y: 638, width: 8, height: 267 },
  { x: 1242, y: 833, width: 8, height: 116 },
];

export const SOLID_RECTS: SourceRect[] = [
  { x: 42, y: 124, width: 176, height: 170 }, // 候鸟巡游花车停放处
  { x: 327, y: 122, width: 184, height: 168 }, // 伏园
  { x: 360, y: 520, width: 75, height: 75 }, // 婚姻登记处
  { x: 492, y: 828, width: 76, height: 38 }, // 候鸟电影院
  WORKSHOP_BUILDING_RECT, // 候鸟工作坊
  { x: 875, y: 260, width: 245, height: 62 }, // 候鸟黑客松
  EXCHANGE_BUILDING_RECT, // 候鸟交易所
  RETRO_ART_BUILDING_RECT, // 公路复古艺术展区
  ...ICE_JOYS_BUILDING_RECTS,
  ...ICE_JOYS_SIDE_SLATS,
  ...CLUB_BUILDING_RECTS,
  LADDER_300_BUILDING_RECT, // 300.梯威
];

export const SOLID_CIRCLES: SourceCircle[] = [
  { x: 148, y: 395, radius: 55 }, // 候鸟中心
  CLUB_ROUND_STAGE_CIRCLE, // 候鸟俱乐部圆形结构
];

export const TERRAIN_SOLID_POLYGONS: SourcePoint[][] = [
  [
    [0, 1038],
    [410, 1038],
    [620, 1072],
    [875, 1060],
    [1110, 1084],
    [1370, 1118],
    [1703, 1118],
    [1703, 1279],
    [0, 1279],
  ],
  [
    [0, 0],
    [1703, 0],
    [1703, 58],
    [0, 58],
  ],
];

function makeTentPolygon(x: number, y: number, width: number, height: number): SourcePoint[] {
  return [
    [x + width * 0.5, y],
    [x + width, y + height * 0.72],
    [x + width * 0.78, y + height],
    [x + width * 0.22, y + height],
    [x, y + height * 0.72],
  ];
}

export const TENT_POLYGONS: SourcePoint[][] = [
  makeTentPolygon(882, 190, 62, 54),
  makeTentPolygon(962, 188, 58, 52),
  makeTentPolygon(1042, 190, 58, 52),
];

export const BUILDING_SOLID_POLYGONS: SourcePoint[][] = BIRD_RESTAURANT_WALLS;

export const DIAMOND_WALL_BARRIERS: SourceRect[] = [
  { x: 232, y: 118, width: 55, height: 320 },
  { x: 236, y: 481, width: 56, height: 386 },
  { x: 1548, y: 220, width: 48, height: 460 },
  { x: 1548, y: 650, width: 48, height: 440 },
];

export const SOLID_POLYGONS: SourcePoint[][] = [
  ...TERRAIN_SOLID_POLYGONS,
  ...BUILDING_SOLID_POLYGONS,
  ...SECONDARY_WALL_STRUCTURES,
  ...TENT_POLYGONS,
];

const BARRIER_COLLISION_PADDING = 10;
const THIN_BARRIER_MAX_WIDTH = 12;

function pointInRect({ x, y }: { x: number; y: number }, rect: SourceRect, padding = 0) {
  return (
    x >= rect.x - padding &&
    x <= rect.x + rect.width + padding &&
    y >= rect.y - padding &&
    y <= rect.y + rect.height + padding
  );
}

function pointInCircle({ x, y }: { x: number; y: number }, circle: SourceCircle) {
  return (x - circle.x) ** 2 + (y - circle.y) ** 2 <= circle.radius ** 2;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function tilePositionInSpaceBarrier(
  position: { x: number; y: number },
  mapWidth: number,
  mapHeight: number,
) {
  const point = gridPositionToSourcePoint(position, mapWidth, mapHeight);
  const tileWidth = SOURCE_WIDTH / mapWidth;
  for (const rect of SPACE_BARRIERS) {
    if (!pointInRect(point, rect, BARRIER_COLLISION_PADDING)) continue;

    const minColumn = Math.floor(((rect.x - BARRIER_COLLISION_PADDING) / SOURCE_WIDTH) * mapWidth);
    const maxColumn = Math.floor(
      ((rect.x + rect.width + BARRIER_COLLISION_PADDING) / SOURCE_WIDTH) * mapWidth,
    );
    if (rect.width <= THIN_BARRIER_MAX_WIDTH && maxColumn > minColumn) {
      const centerColumn = clamp(
        Math.round((rect.x + rect.width / 2) / tileWidth),
        0,
        mapWidth - 1,
      );
      if (position.x === centerColumn) return true;
      continue;
    }

    return true;
  }
  return false;
}

export function pointInPolygon(point: SourcePoint, polygon: SourcePoint[]) {
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function sourcePointInSolidGeometry(point: { x: number; y: number }) {
  const sourcePoint: SourcePoint = [point.x, point.y];
  if (SOLID_RECTS.some((rect) => pointInRect(point, rect))) return true;
  if (SPACE_BARRIERS.some((rect) => pointInRect(point, rect, BARRIER_COLLISION_PADDING))) {
    return true;
  }
  if (DIAMOND_WALL_BARRIERS.some((rect) => pointInRect(point, rect))) return true;
  if (SOLID_CIRCLES.some((circle) => pointInCircle(point, circle))) return true;
  return SOLID_POLYGONS.some((polygon) => pointInPolygon(sourcePoint, polygon));
}

export function gridPositionToSourcePoint(
  position: { x: number; y: number },
  mapWidth: number,
  mapHeight: number,
) {
  return {
    x: ((position.x + 0.5) / mapWidth) * SOURCE_WIDTH,
    y: ((position.y + 0.5) / mapHeight) * SOURCE_HEIGHT,
  };
}

export function tilePositionBlockedBySolidGeometry(
  position: { x: number; y: number },
  mapWidth: number,
  mapHeight: number,
) {
  if (tilePositionInSpaceBarrier(position, mapWidth, mapHeight)) return true;

  const point = gridPositionToSourcePoint(position, mapWidth, mapHeight);
  const sourcePoint: SourcePoint = [point.x, point.y];
  if (SOLID_RECTS.some((rect) => pointInRect(point, rect))) return true;
  if (DIAMOND_WALL_BARRIERS.some((rect) => pointInRect(point, rect))) return true;
  if (SOLID_CIRCLES.some((circle) => pointInCircle(point, circle))) return true;
  return SOLID_POLYGONS.some((polygon) => pointInPolygon(sourcePoint, polygon));
}

export function sandCityGeometryControlsCollision(mapWidth: number, mapHeight: number) {
  return mapWidth === 64 && mapHeight === 48;
}
