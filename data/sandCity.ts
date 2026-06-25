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

const seaPolygon: SourcePoint[] = [
  [0, 176],
  [268, 450],
  [508, 690],
  [690, 875],
  [951, 1050],
  [1245, 1230],
  [1340, 1279],
  [0, 1279],
];

const pondPolygon: SourcePoint[] = [
  [860, 888],
  [960, 884],
  [1038, 918],
  [1050, 978],
  [1008, 1032],
  [912, 1050],
  [838, 1020],
  [820, 948],
];

const forestPolygon: SourcePoint[] = [
  [560, 0],
  [1515, 0],
  [1510, 420],
  [1390, 500],
  [1210, 486],
  [1040, 420],
  [885, 392],
  [744, 302],
  [610, 218],
];

const hotelGreenPolygon: SourcePoint[] = [
  [1265, 420],
  [1703, 390],
  [1703, 620],
  [1430, 585],
  [1250, 525],
];

const sandWallPolygons: SourcePoint[][] = [
  [
    [292, 245],
    [514, 209],
    [525, 238],
    [307, 278],
  ],
  [
    [412, 295],
    [655, 244],
    [667, 273],
    [425, 326],
  ],
  [
    [546, 345],
    [804, 294],
    [816, 324],
    [560, 378],
  ],
  [
    [273, 358],
    [436, 316],
    [449, 345],
    [286, 390],
  ],
  [
    [398, 424],
    [584, 365],
    [599, 395],
    [416, 455],
  ],
  [
    [525, 486],
    [717, 423],
    [733, 455],
    [544, 517],
  ],
  [
    [675, 555],
    [875, 486],
    [892, 520],
    [694, 588],
  ],
  [
    [808, 628],
    [956, 575],
    [973, 607],
    [825, 660],
  ],
  [
    [494, 591],
    [635, 530],
    [654, 562],
    [515, 624],
  ],
  [
    [602, 662],
    [765, 594],
    [784, 628],
    [622, 696],
  ],
  [
    [1458, 792],
    [1660, 778],
    [1664, 812],
    [1464, 827],
  ],
  [
    [1510, 848],
    [1663, 835],
    [1666, 867],
    [1514, 881],
  ],
];

blockSourcePolygon(seaPolygon);
blockSourcePolygon(pondPolygon);
blockSourcePolygon(forestPolygon);
blockSourcePolygon(hotelGreenPolygon);

// Main modeled objects from the HouNiao Sand City site plan.
blockSourceRect(100, 128, 120, 72); // 候鸟中心
blockSourceRect(248, 88, 245, 90); // 巡游花车停放处
blockSourceRect(252, 160, 130, 66); // 一级城墙入口
blockSourceRect(485, 112, 105, 66); // 伏园
blockSourceRect(182, 270, 140, 74); // 婚姻登记处
blockSourceRect(214, 392, 140, 76); // 候鸟电影院
blockSourceRect(398, 366, 160, 92); // 候鸟工作坊
blockSourceRect(702, 298, 192, 156); // 候鸟黑客松
blockSourceRect(812, 430, 136, 76); // 时间广场
blockSourceRect(1125, 480, 145, 92); // 候鸟交易所
blockSourcePolygon([
  [955, 548],
  [1075, 556],
  [1118, 624],
  [1070, 698],
  [958, 700],
  [908, 628],
]); // 鸟其林
blockSourceRect(910, 710, 150, 70); // 候鸟俱乐部
blockSourceRect(640, 620, 210, 112); // 候鸟沙城剧场
blockSourceRect(1282, 612, 265, 122); // 公路复古艺术展区
blockSourceRect(1180, 845, 190, 145); // 300.梯威
blockSourceRect(1448, 780, 230, 120); // 二级城墙

for (const wall of sandWallPolygons) {
  blockSourcePolygon(wall);
}

// East-side glamping pods (kept in sync with podField() in PixiStaticMap).
for (let r = 0; r < 6; r++) {
  for (let c = 0; c < 6; c++) {
    blockSourceRect(1448 + c * 44 + r * 4 - 12, 726 + r * 80 + c * 6 - 9, 24, 18);
  }
}

export const bgtiles = [emptyLayer()];
export const objmap = [blockedLayer];
export const animatedsprites: typeof gentle.animatedsprites = [];
