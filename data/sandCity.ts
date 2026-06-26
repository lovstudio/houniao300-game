import * as gentle from './gentle';

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

function blockSourcePolygon(points: SourcePoint[]) {
  const polygon = points.map(toGrid);
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      if (pointInPolygon([x + 0.5, y + 0.5], polygon)) {
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
blockSourceRect(1418, 448, 140, 86); // 公路复古艺术展区
blockSourceRect(1328, 783, 112, 132); // 候鸟俱乐部 / 300.梯威周边
blockSourceRect(1452, 788, 86, 132); // 300.梯威

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

for (const [x, y, height] of [
  [452, 320, 210],
  [500, 450, 250],
  [602, 350, 260],
  [668, 292, 245],
  [744, 318, 325],
  [823, 280, 370],
  [912, 355, 405],
  [986, 330, 230],
  [1078, 390, 300],
  [1140, 445, 220],
  [1188, 664, 215],
  [1280, 690, 180],
] as const) {
  blockSourceRect(x, y, 7, height);
}

blockDiamondWall(254, 135, 9, 15, 34);
blockDiamondWall(258, 498, 11, 15, 34);
blockDiamondWall(1602, 342, 10, 16, 36);
blockDiamondWall(1608, 720, 12, 16, 36);

export const bgtiles = [emptyLayer()];
export const objmap = [blockedLayer];
export const animatedsprites: typeof gentle.animatedsprites = [];
