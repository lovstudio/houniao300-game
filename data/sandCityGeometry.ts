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

export const SOURCE_WIDTH = 1703;
export const SOURCE_HEIGHT = 1279;

export const BIRD_RESTAURANT_WALLS: SourcePoint[][] = [
  [
    [1144, 610],
    [1188, 560],
    [1247, 579],
    [1224, 622],
    [1186, 612],
    [1169, 651],
    [1177, 712],
    [1218, 748],
    [1191, 781],
    [1139, 739],
    [1126, 670],
  ],
  [
    [1278, 590],
    [1318, 552],
    [1365, 590],
    [1346, 632],
    [1315, 613],
    [1301, 653],
    [1322, 704],
    [1294, 744],
    [1267, 712],
    [1279, 646],
  ],
  [
    [1194, 755],
    [1268, 734],
    [1328, 710],
    [1365, 748],
    [1312, 804],
    [1242, 792],
  ],
];

export const ICE_JOYS_BUILDING_RECTS: SourceRect[] = [
  { x: 1362, y: 604, width: 104, height: 104 },
];

export const ICE_JOYS_SIDE_SLATS: SourceRect[] = [
  { x: 1468, y: 552, width: 8, height: 78 },
  { x: 1468, y: 708, width: 8, height: 88 },
];

export const CLUB_BUILDING_RECTS: SourceRect[] = [
  { x: 1306, y: 762, width: 76, height: 78 },
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
  { x: 655, y: 560, width: 88, height: 90 }, // 候鸟工作坊
  { x: 875, y: 260, width: 245, height: 62 }, // 候鸟黑客松
  { x: 1228, y: 310, width: 130, height: 174 }, // 候鸟交易所
  { x: 1418, y: 448, width: 140, height: 86 }, // 公路复古艺术展区
  ...ICE_JOYS_BUILDING_RECTS,
  ...ICE_JOYS_SIDE_SLATS,
  ...CLUB_BUILDING_RECTS,
  { x: 1452, y: 788, width: 86, height: 132 }, // 300.梯威
];

export const SOLID_CIRCLES: SourceCircle[] = [
  { x: 148, y: 395, radius: 55 }, // 候鸟中心
  { x: 1368, y: 886, radius: 26 }, // 候鸟俱乐部圆形结构
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
  { x: 1578, y: 324, width: 58, height: 374 },
  { x: 1584, y: 702, width: 58, height: 428 },
];

export const SOLID_POLYGONS: SourcePoint[][] = [
  ...TERRAIN_SOLID_POLYGONS,
  ...BUILDING_SOLID_POLYGONS,
  ...TENT_POLYGONS,
];

const BARRIER_COLLISION_PADDING = 10;

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
  return sourcePointInSolidGeometry(gridPositionToSourcePoint(position, mapWidth, mapHeight));
}

export function sandCityGeometryControlsCollision(mapWidth: number, mapHeight: number) {
  return mapWidth === 64 && mapHeight === 48;
}
