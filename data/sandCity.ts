import * as gentle from './gentle';
import {
  DIAMOND_WALL_BARRIERS,
  SOLID_CIRCLES,
  SOLID_POLYGONS,
  SOLID_RECTS,
  SOURCE_HEIGHT,
  SOURCE_WIDTH,
  SPACE_BARRIERS,
  pointInPolygon,
  type SourcePoint,
  type SourceRect,
} from './sandCityGeometry';

export const tilesetpath = gentle.tilesetpath;
// 128x96 collision grid at 16px/tile keeps the world a constant 2048x1536px
// (was 64x48 @ 32px), doubling collision precision so thin barriers ~1.5 tiles
// apart no longer merge. World pixel size, viewport, and 32px sprites are
// unchanged; only tile-denominated rates are rescaled (see movementSpeed etc.).
export const tiledim = 16;
export const screenxtiles = 128;
export const screenytiles = 96;
export const tilesetpxw = gentle.tilesetpxw;
export const tilesetpxh = gentle.tilesetpxh;
export const mapwidth = 128;
export const mapheight = 96;

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

function blockSpaceBarrier({ x, y, width, height }: SourceRect) {
  blockSourceRect(x, y, width, height);
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
      const tileCenterX = tileX + 0.5;
      const tileCenterY = tileY + 0.5;
      const normalizedDistance =
        (tileCenterX - centerX) ** 2 / radiusX ** 2 +
        (tileCenterY - centerY) ** 2 / radiusY ** 2;
      if (normalizedDistance <= 1) {
        blockTile(tileX, tileY);
      }
    }
  }
}

// PDF plan boundaries and solid structures redrawn in PixiStaticMap.
for (const polygon of SOLID_POLYGONS) {
  blockSourcePolygon(polygon);
}

for (const rect of SOLID_RECTS) {
  blockSourceRect(rect.x, rect.y, rect.width, rect.height);
}

for (const circle of SOLID_CIRCLES) {
  blockSourceCircle(circle.x, circle.y, circle.radius);
}

for (const barrier of SPACE_BARRIERS) {
  blockSpaceBarrier(barrier);
}

for (const barrier of DIAMOND_WALL_BARRIERS) {
  blockSpaceBarrier(barrier);
}

export const bgtiles = [emptyLayer()];
export const objmap = [blockedLayer];
export const animatedsprites: typeof gentle.animatedsprites = [];
