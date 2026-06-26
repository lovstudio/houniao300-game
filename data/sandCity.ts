import * as gentle from './gentle';
import { SPACE_BARRIERS, type SourceRect } from './sandCityGeometry';

const SOURCE_WIDTH = 1703;
const SOURCE_HEIGHT = 1279;

export const tilesetpath = gentle.tilesetpath;
export const tiledim = gentle.tiledim;
export const screenxtiles = 64;
export const screenytiles = 48;
export const tilesetpxw = gentle.tilesetpxw;
export const tilesetpxh = gentle.tilesetpxh;
export const mapwidth = 64;
export const mapheight = 48;

type SourcePoint = [number, number];

const emptyLayer = () =>
  Array.from({ length: mapwidth }, () => Array.from({ length: mapheight }, () => -1));

const blockedLayer = emptyLayer();

function blockTile(x: number, y: number) {
  if (x < 0 || y < 0 || x >= mapwidth || y >= mapheight) return;
  blockedLayer[x][y] = 1;
}

function toGrid([x, y]: SourcePoint): SourcePoint {
  return [(x / SOURCE_WIDTH) * mapwidth, (y / SOURCE_HEIGHT) * mapheight];
}

function pointInPolygon(point: SourcePoint, polygon: SourcePoint[]) {
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

function pointInRect(
  [px, py]: SourcePoint,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
) {
  return px >= minX && px <= maxX && py >= minY && py <= maxY;
}

function orientation([ax, ay]: SourcePoint, [bx, by]: SourcePoint, [cx, cy]: SourcePoint) {
  const value = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (Math.abs(value) < 1e-9) return 0;
  return value > 0 ? 1 : 2;
}

function onSegment([ax, ay]: SourcePoint, [bx, by]: SourcePoint, [cx, cy]: SourcePoint) {
  return (
    bx <= Math.max(ax, cx) &&
    bx >= Math.min(ax, cx) &&
    by <= Math.max(ay, cy) &&
    by >= Math.min(ay, cy)
  );
}

function segmentsIntersect(a1: SourcePoint, a2: SourcePoint, b1: SourcePoint, b2: SourcePoint) {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a1, b1, a2)) return true;
  if (o2 === 0 && onSegment(a1, b2, a2)) return true;
  if (o3 === 0 && onSegment(b1, a1, b2)) return true;
  if (o4 === 0 && onSegment(b1, a2, b2)) return true;
  return false;
}

function polygonIntersectsTile(polygon: SourcePoint[], tileX: number, tileY: number) {
  const minX = tileX;
  const minY = tileY;
  const maxX = tileX + 1;
  const maxY = tileY + 1;
  const corners: SourcePoint[] = [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
  ];
  const edges: [SourcePoint, SourcePoint][] = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ];

  if (corners.some((corner) => pointInPolygon(corner, polygon))) return true;
  if (polygon.some((point) => pointInRect(point, minX, minY, maxX, maxY))) return true;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const polygonEdge: [SourcePoint, SourcePoint] = [polygon[j], polygon[i]];
    if (
      edges.some(([edgeStart, edgeEnd]) =>
        segmentsIntersect(polygonEdge[0], polygonEdge[1], edgeStart, edgeEnd),
      )
    ) {
      return true;
    }
  }
  return pointInPolygon([tileX + 0.5, tileY + 0.5], polygon);
}

function blockSourcePolygon(points: SourcePoint[]) {
  const polygon = points.map(toGrid);
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      if (polygonIntersectsTile(polygon, x, y)) {
        blockTile(x, y);
      }
    }
  }
}

function blockSourceRect(x: number, y: number, w: number, h: number) {
  blockSourcePolygon([
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]);
}

function blockSpaceBarrier({ x, y, width, height }: SourceRect) {
  const collisionWidth = Math.max(width, 28);
  const collisionHeight = Math.max(height, 28);
  blockSourceRect(
    x - (collisionWidth - width) / 2,
    y - (collisionHeight - height) / 2,
    collisionWidth,
    collisionHeight,
  );
}

function blockSourceCircle(x: number, y: number, radius: number) {
  const centerX = (x / SOURCE_WIDTH) * mapwidth;
  const centerY = (y / SOURCE_HEIGHT) * mapheight;
  const radiusX = (radius / SOURCE_WIDTH) * mapwidth;
  const radiusY = (radius / SOURCE_HEIGHT) * mapheight;
  for (let tileX = Math.floor(centerX - radiusX); tileX <= Math.ceil(centerX + radiusX); tileX++) {
    for (
      let tileY = Math.floor(centerY - radiusY);
      tileY <= Math.ceil(centerY + radiusY);
      tileY++
    ) {
      const nearestX = Math.max(tileX, Math.min(centerX, tileX + 1));
      const nearestY = Math.max(tileY, Math.min(centerY, tileY + 1));
      const normalizedDistance =
        (nearestX - centerX) ** 2 / radiusX ** 2 + (nearestY - centerY) ** 2 / radiusY ** 2;
      if (normalizedDistance <= 1) {
        blockTile(tileX, tileY);
      }
    }
  }
}

function blockCanvasTent(x: number, y: number, width: number, height: number) {
  blockSourcePolygon([
    [x + width * 0.5, y],
    [x + width, y + height * 0.72],
    [x + width * 0.78, y + height],
    [x + width * 0.22, y + height],
    [x, y + height * 0.72],
  ]);
}

function blockDiamondWall(x: number, y: number, count: number, size: number, step: number) {
  for (let i = 0; i < count; i++) {
    const cy = y + i * step;
    const lean = i % 2 === 0 ? -6 : 5;
    blockSourcePolygon([
      [x + lean, cy - size],
      [x + size + lean, cy],
      [x + lean, cy + size],
      [x - size + lean, cy],
    ]);
  }
}

// PDF plan boundaries, redrawn visually in PixiStaticMap with hand-drawn sand-city styling.
blockSourcePolygon([
  [0, 1038],
  [410, 1038],
  [620, 1072],
  [875, 1060],
  [1110, 1084],
  [1370, 1118],
  [1703, 1118],
  [1703, 1279],
  [0, 1279],
]);

blockSourcePolygon([
  [0, 0],
  [1703, 0],
  [1703, 58],
  [0, 58],
]);

// Main venues and structural footprints aligned to the PDF plan.
blockSourceRect(42, 124, 176, 170); // 候鸟巡游花车停放处
blockSourceRect(327, 122, 184, 168); // 伏园
blockSourceRect(360, 520, 75, 75); // 婚姻登记处
blockSourceRect(492, 828, 76, 38); // 候鸟电影院
blockSourceRect(655, 560, 88, 90); // 候鸟工作坊
blockSourceRect(875, 260, 245, 62); // 候鸟黑客松
blockSourceRect(1282, 596, 72, 78); // 鸟其林局部
blockSourceRect(1280, 745, 70, 86); // 候鸟俱乐部附属建筑
blockSourceRect(1418, 448, 140, 86); // 公路复古艺术展区
blockSourceRect(1328, 783, 112, 132); // 候鸟俱乐部 / 300.梯威周边
blockSourceRect(1452, 788, 86, 132); // 300.梯威
blockSourceCircle(148, 395, 55); // 候鸟中心
blockSourceCircle(1368, 886, 26); // 候鸟俱乐部圆形结构
blockCanvasTent(882, 190, 62, 54); // 候鸟黑客松帐篷
blockCanvasTent(962, 188, 58, 52); // 候鸟黑客松帐篷
blockCanvasTent(1042, 190, 58, 52); // 候鸟黑客松帐篷
blockCanvasTent(1380, 728, 58, 54); // 候鸟俱乐部帐篷

blockSourcePolygon([
  [1180, 548],
  [1268, 528],
  [1344, 575],
  [1360, 662],
  [1304, 732],
  [1205, 704],
  [1168, 625],
]); // 鸟其林主体

blockSourcePolygon([
  [1264, 300],
  [1348, 304],
  [1348, 476],
  [1268, 476],
  [1250, 420],
]); // 候鸟交易所

for (const barrier of SPACE_BARRIERS) {
  blockSpaceBarrier(barrier);
}

blockDiamondWall(254, 135, 9, 15, 34);
blockDiamondWall(258, 498, 11, 15, 34);
blockDiamondWall(1602, 342, 10, 16, 36);
blockDiamondWall(1608, 720, 12, 16, 36);

export const bgtiles = [emptyLayer()];
export const objmap = [blockedLayer];
export const animatedsprites: typeof gentle.animatedsprites = [];
