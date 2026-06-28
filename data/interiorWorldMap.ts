import type { SerializedWorldMap } from '../convex/aiTown/worldMap';
import type { InteriorCircle, InteriorRect, VenueInteriorMap } from './birdRestaurantInterior';

// 内场被建模成引擎里的一张独立 WorldMap：bgTiles 留空（视觉由 PixiStaticMap 的内场矢量分支绘制），
// objectTiles 作为碰撞网格——把非 walkable 的家具/墙投影到格子上，玩家与 AI 走到这些格子即被挡。

// 阻挡类家具（与 InteriorRect/Circle 的 kind 对应）；其余 kind 与空地视为可走。
// walkable: true 的形状无条件可走，覆盖此集合。
const BLOCKING_KINDS = new Set([
  'wall',
  'stall',
  'counter',
  'stage',
  'speaker',
  'table',
  'seat',
  'sofa',
  'mound',
  'sea',
]);

// 内场逻辑格 32px/格：source 约 1280×720 → 40×24 格（与 data 里的 mapWidth/mapHeight 一致）。
const INTERIOR_TILE_DIM = 32;

function rectBlocks(shape: InteriorRect, sx: number, sy: number): boolean {
  return sx >= shape.x && sx <= shape.x + shape.width && sy >= shape.y && sy <= shape.y + shape.height;
}

function circleBlocks(shape: InteriorCircle, sx: number, sy: number): boolean {
  return Math.hypot(sx - shape.x, sy - shape.y) <= shape.radius;
}

function blockedAt(interior: VenueInteriorMap, sx: number, sy: number): boolean {
  for (const rect of interior.rects) {
    if (rect.walkable === true) continue;
    if (BLOCKING_KINDS.has(rect.kind) && rectBlocks(rect, sx, sy)) return true;
  }
  for (const circle of interior.circles) {
    if (circle.walkable === true) continue;
    if (BLOCKING_KINDS.has(circle.kind) && circleBlocks(circle, sx, sy)) return true;
  }
  return false;
}

export function interiorToWorldMap(interior: VenueInteriorMap): SerializedWorldMap {
  const width = interior.mapWidth;
  const height = interior.mapHeight;
  const sw = interior.source.width;
  const sh = interior.source.height;

  // tileLayer 形状为 [x][y]；-1 = 空/可走，1 = 阻挡。
  const objectLayer: number[][] = [];
  const bgLayer: number[][] = [];
  for (let x = 0; x < width; x++) {
    objectLayer[x] = [];
    bgLayer[x] = [];
    for (let y = 0; y < height; y++) {
      const sx = ((x + 0.5) / width) * sw;
      const sy = ((y + 0.5) / height) * sh;
      objectLayer[x][y] = blockedAt(interior, sx, sy) ? 1 : -1;
      bgLayer[x][y] = -1;
    }
  }

  return {
    width,
    height,
    // tileSet 字段对内场不参与渲染（视觉走矢量分支），给合法占位值即可。
    tileSetUrl: '/ai-town/assets/spritesheets/interior.png',
    tileSetDimX: 256,
    tileSetDimY: 256,
    tileDim: INTERIOR_TILE_DIM,
    bgTiles: [bgLayer],
    objectTiles: [objectLayer],
    animatedSprites: [],
  };
}
