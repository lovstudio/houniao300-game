// GPS ↔ 地图坐标 的标定与换算。
//
// 坐标链路：
//   真实经纬度 (lat,lng)  --仿射变换-->  航拍源坐标 source(x,y) [1703×1279]
//   source(x,y)          --线性缩放-->   瓦片坐标 tile(x,y) [worldMap.width×height]
//
// 场地是平面的，所以经纬度→源坐标用一个二维仿射变换即可（旋转+缩放+错切+平移）。
// 在几百米的尺度内把经纬度当作平面坐标，墨卡托畸变可忽略。
//
// 标定方法：在现场选 ≥3 个互不共线的锚点，分别量出它们的真实经纬度和对应的源像素坐标，
// 用最小二乘解出仿射系数。锚点越多、越分散，精度越高。

import { SOURCE_HEIGHT, SOURCE_WIDTH } from '../../data/sandCityGeometry';

export type GpsAnchor = {
  // 现场实测：用手机站在该点读取的经纬度
  lat: number;
  lng: number;
  // 该点在航拍源坐标系（1703×1279）里的像素坐标
  sourceX: number;
  sourceY: number;
  label?: string;
};

// 仿射系数：sx = a·lng + b·lat + c ; sy = d·lng + e·lat + f
export type AffineTransform = { a: number; b: number; c: number; d: number; e: number; f: number };

export type GpsCalibration = {
  anchors: GpsAnchor[];
  transform: AffineTransform | null;
};

// 解 3×3 线性方程组 M·p = y（高斯消元，带部分主元）。失败返回 null。
function solve3x3(M: number[][], y: number[]): [number, number, number] | null {
  const a = M.map((row, i) => [...row, y[i]]); // 增广矩阵 3×4
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return null; // 奇异（锚点共线）
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const factor = a[r][col] / a[col][col];
      for (let k = col; k < 4; k++) a[r][k] -= factor * a[col][k];
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
}

// 从锚点最小二乘拟合仿射变换。<3 个锚点或锚点共线返回 null。
export function fitAffine(anchors: GpsAnchor[]): AffineTransform | null {
  if (anchors.length < 3) return null;
  // 设计矩阵行 [lng, lat, 1]，对 sx 和 sy 各做一次最小二乘（共用 normal equations 的 MᵀM）。
  let s11 = 0, s12 = 0, s13 = 0, s22 = 0, s23 = 0, s33 = 0;
  let tx1 = 0, tx2 = 0, tx3 = 0, ty1 = 0, ty2 = 0, ty3 = 0;
  for (const p of anchors) {
    const [u, v, w] = [p.lng, p.lat, 1];
    s11 += u * u; s12 += u * v; s13 += u * w;
    s22 += v * v; s23 += v * w; s33 += w * w;
    tx1 += u * p.sourceX; tx2 += v * p.sourceX; tx3 += w * p.sourceX;
    ty1 += u * p.sourceY; ty2 += v * p.sourceY; ty3 += w * p.sourceY;
  }
  const MtM = [
    [s11, s12, s13],
    [s12, s22, s23],
    [s13, s23, s33],
  ];
  const sx = solve3x3(MtM, [tx1, tx2, tx3]);
  const sy = solve3x3(MtM, [ty1, ty2, ty3]);
  if (!sx || !sy) return null;
  return { a: sx[0], b: sx[1], c: sx[2], d: sy[0], e: sy[1], f: sy[2] };
}

export function makeCalibration(anchors: GpsAnchor[]): GpsCalibration {
  return { anchors, transform: fitAffine(anchors) };
}

export function isCalibrated(cal: GpsCalibration | null): cal is GpsCalibration & { transform: AffineTransform } {
  return !!cal && !!cal.transform;
}

export type SourcePoint = { x: number; y: number };
export type TilePoint = { x: number; y: number };

// 经纬度 → 航拍源坐标。未标定返回 null。
export function gpsToSource(cal: GpsCalibration | null, lat: number, lng: number): SourcePoint | null {
  if (!isCalibrated(cal)) return null;
  const t = cal.transform;
  return { x: t.a * lng + t.b * lat + t.c, y: t.d * lng + t.e * lat + t.f };
}

// 航拍源坐标 → 瓦片坐标（玩家 position 用的坐标系）。
export function sourceToTile(src: SourcePoint, worldWidth: number, worldHeight: number): TilePoint {
  return { x: (src.x / SOURCE_WIDTH) * worldWidth, y: (src.y / SOURCE_HEIGHT) * worldHeight };
}

// 经纬度 → 瓦片坐标（一步到位）。未标定或落在地图外返回 null。
export function gpsToTile(
  cal: GpsCalibration | null,
  lat: number,
  lng: number,
  worldWidth: number,
  worldHeight: number,
): TilePoint | null {
  const src = gpsToSource(cal, lat, lng);
  if (!src) return null;
  return sourceToTile(src, worldWidth, worldHeight);
}

// 两点经纬度的真实地表距离（米），Haversine。
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371008.8; // 地球平均半径
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

// ── 现场标定 ─────────────────────────────────────────────────────────────
// TODO(现场标定)：把下面的占位锚点替换成鸟其林内场的真实实测值。
// 步骤：站在地图上 3~4 个容易辨认的点（如工坊门口、交换所角落、舞台中心），
// 用手机记下经纬度，再在 mappreview.html 上读出对应像素坐标，填进这里即可生效。
export const VENUE_GPS_ANCHORS: GpsAnchor[] = [
  // { label: '工坊门口', lat: 0, lng: 0, sourceX: 766, sourceY: 725 },
  // { label: '交换所角', lat: 0, lng: 0, sourceX: 1347, sourceY: 350 },
  // { label: '舞台中心', lat: 0, lng: 0, sourceX: 1396, sourceY: 968 },
];

export const VENUE_CALIBRATION: GpsCalibration = makeCalibration(VENUE_GPS_ANCHORS);
