import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { WorldMap } from '../../convex/aiTown/worldMap';
import {
  BIRD_RESTAURANT_WALL_SEGMENTS,
  BIRD_RESTAURANT_WALLS,
  CLUB_BUILDING_RECTS,
  CLUB_ROUND_STAGE_CIRCLE,
  EXCHANGE_BUILDING_RECT,
  ICE_JOYS_BUILDING_RECTS,
  ICE_JOYS_SIDE_SLATS,
  LADDER_300_BUILDING_RECT,
  RETRO_ART_BUILDING_RECT,
  SECONDARY_WALL_STRUCTURES,
  SPACE_BARRIERS,
  WORKSHOP_BUILDING_RECT,
} from '../../data/sandCityGeometry';
import {
  BIRD_RESTAURANT_INTERIOR,
  I3_BRIDGE_FIELD_INTERIOR,
  type InteriorCircle,
  type InteriorRect,
  type VenueInteriorMap,
} from '../../data/birdRestaurantInterior';
import { INSTALLATIONS, type Installation } from '../../data/installations';
import { selectInstallationOnMap, selectVenueOnMap } from '../lib/mapFocus';

// Must match data/sandCity.ts tiledim: 128 tiles * 16px = 2048px world width.
const TILE = 16;
const SOURCE_WIDTH = 1703;
const SOURCE_HEIGHT = 1279;

type SourcePoint = [number, number];

type Projector = ReturnType<typeof createProjector>;

type PlanBlock = {
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: number;
  stroke?: number;
  radius?: number;
};

function createProjector(worldWidth: number, worldHeight: number) {
  const scaleX = worldWidth / SOURCE_WIDTH;
  const scaleY = worldHeight / SOURCE_HEIGHT;
  const scale = (scaleX + scaleY) / 2;
  return {
    point: ([x, y]: SourcePoint): SourcePoint => [x * scaleX, y * scaleY],
    rect: (x: number, y: number, width: number, height: number) => ({
      height: height * scaleY,
      width: width * scaleX,
      x: x * scaleX,
      y: y * scaleY,
    }),
    scale,
    x: (value: number) => value * scaleX,
    y: (value: number) => value * scaleY,
  };
}

function drawPolygon(graphics: PIXI.Graphics, project: Projector, points: SourcePoint[]) {
  graphics.drawPolygon(points.flatMap((point) => project.point(point)));
}

function offsetPoints(points: SourcePoint[], dx: number, dy: number): SourcePoint[] {
  return points.map(([x, y]) => [x + dx, y + dy]);
}

function drawPolyline(
  graphics: PIXI.Graphics,
  project: Projector,
  points: SourcePoint[],
  width: number,
  color: number,
  alpha = 1,
) {
  const [first, ...rest] = points;
  graphics.lineStyle(width * project.scale, color, alpha);
  graphics.moveTo(...project.point(first));
  for (const point of rest) {
    graphics.lineTo(...project.point(point));
  }
}

function drawDashedLine(
  graphics: PIXI.Graphics,
  project: Projector,
  from: SourcePoint,
  to: SourcePoint,
  segmentLength: number,
  gap: number,
  width: number,
  color: number,
  alpha: number,
) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const length = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.floor(length / (segmentLength + gap));
  const dx = (x2 - x1) / length;
  const dy = (y2 - y1) / length;
  graphics.lineStyle(width * project.scale, color, alpha);
  for (let i = 0; i <= steps; i++) {
    const start = i * (segmentLength + gap);
    const end = Math.min(start + segmentLength, length);
    graphics.moveTo(project.x(x1 + dx * start), project.y(y1 + dy * start));
    graphics.lineTo(project.x(x1 + dx * end), project.y(y1 + dy * end));
  }
}

const INSTALLATION_COLORS: Record<string, number> = {
  A: 0x1da76e,
  B: 0x2e9f8d,
  C: 0x1f9b77,
  D: 0x38a765,
  E: 0x20a892,
  F: 0x169a86,
  G: 0x2e8f69,
  H: 0x1e9a9a,
  I: 0x209a78,
  J: 0x2cae80,
  K: 0x34a069,
};

// 地图标记的最小数据形（兼容静态 Installation 与 DB artwork）。
export type MapMarker = { id: string; x: number; y: number; kind?: 'view' | 'space'; label?: string };

function addInstallationMarker(container: PIXI.Container, project: Projector, installation: MapMarker) {
  const accent = INSTALLATION_COLORS[installation.id.slice(0, 1)] ?? 0xcc785c;
  const wrapper = new PIXI.Container();
  wrapper.x = project.x(installation.x);
  wrapper.y = project.y(installation.y);
  wrapper.eventMode = 'static';
  wrapper.cursor = 'pointer';

  // 可进入的「空间」额外画一圈外环，与「仅观看」作品区分。
  if (installation.kind === 'space') {
    const ring = new PIXI.Graphics();
    ring.lineStyle(1.5 * project.scale, accent, 0.85);
    ring.drawCircle(0, 0, 9 * project.scale);
    wrapper.addChild(ring);
  }

  const dot = new PIXI.Graphics();
  dot.lineStyle(1.5 * project.scale, 0xffffff, 0.95);
  dot.beginFill(accent, 0.95);
  dot.drawCircle(0, 0, 5 * project.scale);
  dot.endFill();
  wrapper.addChild(dot);

  const text = new PIXI.Text(installation.id, {
    fill: 0xffffff,
    fontFamily: 'sans-serif',
    fontSize: 12 * project.scale,
    fontWeight: '800',
    letterSpacing: 0,
  });
  text.resolution = 2;

  const paddingX = 4 * project.scale;
  const paddingY = 2.5 * project.scale;
  const bg = new PIXI.Graphics();
  const width = text.width + paddingX * 2;
  const height = text.height + paddingY * 2;
  bg.lineStyle(1.4 * project.scale, 0xf8f0df, 0.9);
  bg.beginFill(accent, 0.96);
  bg.drawRoundedRect(-width / 2, -height - 7 * project.scale, width, height, 3 * project.scale);
  bg.endFill();
  text.x = -text.width / 2;
  text.y = -height - 7 * project.scale + paddingY;
  wrapper.addChild(bg);
  wrapper.addChild(text);
  wrapper.hitArea = new PIXI.Rectangle(
    -width / 2,
    -height - 7 * project.scale,
    width,
    height + 14 * project.scale,
  );

  const stop = (e: PIXI.FederatedPointerEvent) => e.stopPropagation();
  wrapper.on('pointerdown', stop);
  wrapper.on('pointerup', stop);
  wrapper.on('pointerover', () => {
    wrapper.scale.set(1.08);
  });
  wrapper.on('pointerout', () => {
    wrapper.scale.set(1);
  });
  wrapper.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
    e.stopPropagation();
    selectInstallationOnMap(installation.id);
  });

  container.addChild(wrapper);
}

function addInstallationMarkers(container: PIXI.Container, project: Projector, markers: MapMarker[]) {
  for (const marker of markers) {
    addInstallationMarker(container, project, marker);
  }
}

const planBlocks: PlanBlock[] = [
  { x: 42, y: 124, width: 176, height: 170, fill: 0xe6c684, stroke: 0xb78b46, radius: 10 },
  { x: 327, y: 122, width: 184, height: 168, fill: 0xd9b06c, stroke: 0xa87938, radius: 14 },
  { x: 360, y: 520, width: 75, height: 75, fill: 0xe7dcc8, stroke: 0xb99d74, radius: 4 },
  { x: 492, y: 828, width: 76, height: 38, fill: 0xf2e4ce, stroke: 0xb99d74, radius: 5 },
  { ...WORKSHOP_BUILDING_RECT, fill: 0xe5c18a, stroke: 0xb28548, radius: 4 },
  { x: 875, y: 260, width: 245, height: 62, fill: 0xe2d0b0, stroke: 0xae936d, radius: 4 },
  { ...RETRO_ART_BUILDING_RECT, fill: 0xd8ad67, stroke: 0xaa7f43, radius: 5 },
  { ...LADDER_300_BUILDING_RECT, fill: 0xe0b86f, stroke: 0xaa7f43, radius: 5 },
];

function drawPlanBlock(container: PIXI.Container, project: Projector, block: PlanBlock) {
  const rect = project.rect(block.x, block.y, block.width, block.height);
  const shadow = new PIXI.Graphics();
  shadow.beginFill(0x654622, 0.18);
  shadow.drawRoundedRect(
    rect.x + 8 * project.scale,
    rect.y + 10 * project.scale,
    rect.width,
    rect.height,
    (block.radius ?? 6) * project.scale,
  );
  shadow.endFill();
  container.addChild(shadow);

  const graphics = new PIXI.Graphics();
  graphics.lineStyle(2.4 * project.scale, block.stroke ?? 0xb99d74, 0.95);
  graphics.beginFill(block.fill ?? 0xf2eadc, 0.96);
  graphics.drawRoundedRect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    (block.radius ?? 3) * project.scale,
  );
  graphics.endFill();
  graphics.lineStyle(1.2 * project.scale, 0xffffff, 0.35);
  graphics.moveTo(rect.x + 10 * project.scale, rect.y + 12 * project.scale);
  graphics.lineTo(rect.x + rect.width - 12 * project.scale, rect.y + 7 * project.scale);
  graphics.lineStyle(1 * project.scale, 0x8d6937, 0.22);
  for (let i = 1; i < Math.max(2, Math.floor(block.width / 48)); i++) {
    const x = rect.x + (rect.width / Math.max(2, Math.floor(block.width / 48))) * i;
    graphics.moveTo(x, rect.y + 8 * project.scale);
    graphics.lineTo(x + 3 * project.scale, rect.y + rect.height - 8 * project.scale);
  }
  container.addChild(graphics);
}

function drawPlanSlats(container: PIXI.Container, project: Projector) {
  const graphics = new PIXI.Graphics();
  for (const slat of SPACE_BARRIERS) {
    const rect = project.rect(slat.x, slat.y, slat.width, slat.height);
    graphics.lineStyle(1.2 * project.scale, 0x9c7742, 0.72);
    graphics.beginFill(0xd4b071, 0.72);
    graphics.drawRoundedRect(rect.x, rect.y, rect.width, rect.height, 1 * project.scale);
    graphics.endFill();
    graphics.lineStyle(1 * project.scale, 0xf4d88f, 0.36);
    graphics.moveTo(rect.x + rect.width * 0.35, rect.y + 5 * project.scale);
    graphics.lineTo(rect.x + rect.width * 0.65, rect.y + rect.height - 5 * project.scale);
  }
  container.addChild(graphics);
}

function drawDiamondWall(
  container: PIXI.Container,
  project: Projector,
  x: number,
  y: number,
  count: number,
  size: number,
  step: number,
) {
  const graphics = new PIXI.Graphics();
  graphics.lineStyle(1.5 * project.scale, 0x9a733c, 0.88);
  for (let i = 0; i < count; i++) {
    const cy = y + i * step;
    const lean = i % 2 === 0 ? -6 : 5;
    graphics.beginFill(i % 2 === 0 ? 0xd9ad64 : 0xc99650, 0.96);
    drawPolygon(graphics, project, [
      [x + lean, cy - size],
      [x + size + lean, cy],
      [x + lean, cy + size],
      [x - size + lean, cy],
    ]);
    graphics.endFill();
  }
  container.addChild(graphics);
}

function drawTextOnPlan(
  container: PIXI.Container,
  project: Projector,
  text: string,
  x: number,
  y: number,
  fontSize = 18,
  align: 'left' | 'center' | 'right' = 'center',
  venue?: string,
) {
  const label = new PIXI.Text(text, {
    align,
    fill: 0x6d5638,
    fontFamily: 'sans-serif',
    fontSize: fontSize * project.scale,
    fontWeight: '700',
    letterSpacing: 0,
  });
  label.anchor.set(align === 'center' ? 0.5 : 0, 0.5);
  label.resolution = 2;
  label.x = project.x(x);
  label.y = project.y(y);
  if (venue) {
    label.eventMode = 'static';
    label.cursor = 'pointer';
    const stop = (e: PIXI.FederatedPointerEvent) => e.stopPropagation();
    label.on('pointerdown', stop);
    label.on('pointerup', stop);
    label.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      selectVenueOnMap(venue);
    });
  }
  container.addChild(label);
}

function addVenueHotspot(
  container: PIXI.Container,
  project: Projector,
  venue: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const rect = project.rect(x, y, width, height);
  const hit = new PIXI.Graphics();
  hit.beginFill(0xffffff, 0.001);
  hit.drawRect(rect.x, rect.y, rect.width, rect.height);
  hit.endFill();
  hit.eventMode = 'static';
  hit.cursor = 'pointer';
  const stop = (e: PIXI.FederatedPointerEvent) => e.stopPropagation();
  hit.on('pointerdown', stop);
  hit.on('pointerup', stop);
  hit.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
    e.stopPropagation();
    selectVenueOnMap(venue);
  });
  container.addChild(hit);
}

function drawVenueDetails(container: PIXI.Container, project: Projector) {
  const details = new PIXI.Graphics();
  details.lineStyle(1.2 * project.scale, 0x9e8054, 0.85);

  const exchange = EXCHANGE_BUILDING_RECT;
  for (let i = 0; i < 7; i++) {
    const x = exchange.x + 8 + i * 10;
    const rect = project.rect(x, exchange.y + 28, 7, 12);
    details.beginFill(0xc6aa78, 0.92);
    details.drawRect(rect.x, rect.y, rect.width, rect.height);
    details.endFill();
  }

  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      details.beginFill(0xa58c62, 0.86);
      details.drawCircle(
        project.x(exchange.x + 18 + col * 12),
        project.y(exchange.y + 98 + row * 18),
        2.8 * project.scale,
      );
      details.endFill();
    }
  }

  details.lineStyle(2 * project.scale, 0xb48d58, 0.78);
  for (let i = 0; i < 5; i++) {
    const x = 1258 + i * 17;
    details.moveTo(project.x(x), project.y(505));
    details.lineTo(project.x(x), project.y(640));
  }

  details.lineStyle(3 * project.scale, 0x9f8f75, 0.78);
  details.drawCircle(project.x(70), project.y(360), 11 * project.scale);
  details.drawCircle(project.x(112), project.y(360), 11 * project.scale);
  details.drawCircle(project.x(70), project.y(408), 11 * project.scale);
  details.drawCircle(project.x(111), project.y(408), 11 * project.scale);
  details.drawCircle(project.x(90), project.y(515), 12 * project.scale);
  details.moveTo(project.x(42), project.y(532));
  details.lineTo(project.x(68), project.y(532));
  details.moveTo(project.x(55), project.y(520));
  details.lineTo(project.x(55), project.y(545));

  container.addChild(details);
}

function drawSandTexture(container: PIXI.Container, project: Projector) {
  const texture = new PIXI.Graphics();
  for (let i = 0; i < 180; i++) {
    const x = 35 + ((i * 97) % 1620);
    const y = 185 + ((i * 53) % 760);
    const radius = 1.1 + (i % 4) * 0.45;
    texture.beginFill(i % 3 === 0 ? 0xc8aa76 : 0xe5c993, 0.18);
    texture.drawCircle(project.x(x), project.y(y), radius * project.scale);
    texture.endFill();
  }
  texture.lineStyle(1.2 * project.scale, 0xb9955b, 0.13);
  for (let i = 0; i < 14; i++) {
    const y = 240 + i * 52;
    texture.moveTo(project.x(330 + i * 19), project.y(y));
    texture.bezierCurveTo(
      project.x(560 + i * 14),
      project.y(y - 26),
      project.x(790 + i * 8),
      project.y(y + 24),
      project.x(1130 + i * 20),
      project.y(y - 8),
    );
  }
  container.addChild(texture);
}

function drawCanvasTent(
  container: PIXI.Container,
  project: Projector,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const tent = new PIXI.Graphics();
  tent.lineStyle(1.5 * project.scale, 0xb99d74, 0.95);
  tent.beginFill(0xf3efe6, 0.96);
  drawPolygon(tent, project, [
    [x + width * 0.5, y],
    [x + width, y + height * 0.72],
    [x + width * 0.78, y + height],
    [x + width * 0.22, y + height],
    [x, y + height * 0.72],
  ]);
  tent.endFill();
  tent.lineStyle(1 * project.scale, 0xffffff, 0.48);
  tent.moveTo(project.x(x + width * 0.5), project.y(y + 4));
  tent.lineTo(project.x(x + width * 0.34), project.y(y + height * 0.92));
  tent.moveTo(project.x(x + width * 0.5), project.y(y + 4));
  tent.lineTo(project.x(x + width * 0.66), project.y(y + height * 0.92));
  container.addChild(tent);
}

function drawSketchCircle(
  container: PIXI.Container,
  project: Projector,
  x: number,
  y: number,
  radius: number,
  fill: number,
) {
  const circle = new PIXI.Graphics();
  circle.beginFill(0x5f4225, 0.14);
  circle.drawCircle(project.x(x + 5), project.y(y + 7), radius * project.scale);
  circle.endFill();
  circle.lineStyle(2 * project.scale, 0xb99d74, 0.9);
  circle.beginFill(fill, 0.96);
  circle.drawCircle(project.x(x), project.y(y), radius * project.scale);
  circle.endFill();
  circle.lineStyle(1 * project.scale, 0xffffff, 0.4);
  circle.drawCircle(project.x(x - 4), project.y(y - 5), radius * 0.72 * project.scale);
  container.addChild(circle);
}

function drawBirdRestaurant(container: PIXI.Container, project: Projector) {
  const shadow = new PIXI.Graphics();
  shadow.beginFill(0x5f4225, 0.14);
  for (const wall of BIRD_RESTAURANT_WALLS) {
    drawPolygon(shadow, project, offsetPoints(wall, 5, 7));
  }
  shadow.endFill();
  container.addChild(shadow);

  const building = new PIXI.Graphics();
  for (const [index, wall] of BIRD_RESTAURANT_WALLS.entries()) {
    building.lineStyle(1.6 * project.scale, 0x726b61, 0.88);
    building.beginFill(index % 2 === 0 ? 0xbdb5aa : 0xada59b, 0.96);
    drawPolygon(building, project, wall);
    building.endFill();
  }

  building.lineStyle(0.95 * project.scale, 0x766c61, 0.58);
  for (const segment of BIRD_RESTAURANT_WALL_SEGMENTS) {
    const [x1, y1] = segment.from;
    const [x2, y2] = segment.to;
    const length = Math.hypot(x2 - x1, y2 - y1);
    const nx = (-(y2 - y1) / length) * (segment.width / 2);
    const ny = ((x2 - x1) / length) * (segment.width / 2);
    for (let i = 1; i < segment.divisions; i++) {
      const t = i / segment.divisions;
      const cx = x1 + (x2 - x1) * t;
      const cy = y1 + (y2 - y1) * t;
      building.moveTo(project.x(cx + nx), project.y(cy + ny));
      building.lineTo(project.x(cx - nx), project.y(cy - ny));
    }
  }

  drawPolyline(
    building,
    project,
    [
      [1290, 535],
      [1312, 625],
      [1284, 700],
    ],
    1,
    0x8f806d,
    0.5,
  );
  drawPolyline(
    building,
    project,
    [
      [1366, 530],
      [1390, 620],
      [1370, 716],
    ],
    1,
    0x8f806d,
    0.5,
  );
  drawPolyline(
    building,
    project,
    [
      [1306, 760],
      [1340, 780],
      [1390, 728],
    ],
    1,
    0x8f806d,
    0.5,
  );

  building.beginFill(0xa58c62, 0.72);
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 3; col++) {
      const leftX = 1300 + col * 16;
      const rightX = 1360 + col * 16;
      const y = 552 + row * 28;
      building.drawRect(project.x(leftX), project.y(y), 6 * project.scale, 6 * project.scale);
      building.drawRect(project.x(rightX), project.y(y), 6 * project.scale, 6 * project.scale);
    }
  }
  building.endFill();

  container.addChild(building);
}

function drawBirdRestaurantPhotoDetails(container: PIXI.Container, project: Projector) {
  const details = new PIXI.Graphics();

  details.beginFill(0x2c2924, 0.16);
  drawPolygon(details, project, [
    [1280, 512],
    [1368, 492],
    [1400, 535],
    [1394, 722],
    [1342, 780],
    [1296, 744],
  ]);
  details.endFill();

  details.lineStyle(1 * project.scale, 0xf2e2bd, 0.72);
  details.moveTo(project.x(1288), project.y(526));
  details.lineTo(project.x(1390), project.y(524));
  details.moveTo(project.x(1290), project.y(560));
  details.lineTo(project.x(1392), project.y(556));

  const leftStall = project.rect(1284, 520, 50, 48);
  details.lineStyle(1.2 * project.scale, 0xf4c9a0, 0.9);
  details.beginFill(0xb33f32, 0.92);
  details.drawRoundedRect(
    leftStall.x,
    leftStall.y,
    leftStall.width,
    leftStall.height,
    3 * project.scale,
  );
  details.endFill();
  details.lineStyle(1 * project.scale, 0xf7e2b8, 0.78);
  for (let i = 0; i < 4; i++) {
    details.moveTo(leftStall.x + 6 * project.scale, leftStall.y + (12 + i * 8) * project.scale);
    details.lineTo(
      leftStall.x + leftStall.width - 6 * project.scale,
      leftStall.y + (12 + i * 8) * project.scale,
    );
  }

  const counter = project.rect(1320, 546, 50, 24);
  details.lineStyle(1.2 * project.scale, 0xd78a42, 0.9);
  details.beginFill(0xe7aa55, 0.92);
  details.drawRoundedRect(counter.x, counter.y, counter.width, counter.height, 2 * project.scale);
  details.endFill();

  const stage = project.rect(1364, 516, 30, 78);
  details.lineStyle(1.1 * project.scale, 0x5f5650, 0.9);
  details.beginFill(0x55473f, 0.86);
  details.drawRoundedRect(stage.x, stage.y, stage.width, stage.height, 3 * project.scale);
  details.endFill();
  details.beginFill(0x1f1e1d, 0.9);
  details.drawRect(project.x(1355), project.y(532), 7 * project.scale, 24 * project.scale);
  details.drawRect(project.x(1396), project.y(532), 7 * project.scale, 24 * project.scale);
  details.endFill();

  const tables: SourcePoint[] = [
    [1310, 604],
    [1350, 610],
    [1298, 660],
    [1340, 675],
    [1376, 662],
    [1324, 724],
  ];
  for (const [index, [x, y]] of tables.entries()) {
    details.lineStyle(1 * project.scale, 0x9e8054, 0.82);
    details.beginFill(index % 2 === 0 ? 0xf0debd : 0xe1c58f, 0.94);
    details.drawCircle(project.x(x), project.y(y), 8.5 * project.scale);
    details.endFill();
    details.beginFill(0x4d4036, 0.76);
    details.drawCircle(project.x(x - 13), project.y(y - 4), 3.2 * project.scale);
    details.drawCircle(project.x(x + 12), project.y(y + 5), 3.2 * project.scale);
    details.drawCircle(project.x(x - 4), project.y(y + 13), 3.2 * project.scale);
    details.endFill();
  }

  const [entryX, entryY] = BIRD_RESTAURANT_INTERIOR.entrance.exteriorSource;
  details.lineStyle(2.2 * project.scale, 0xf5c15f, 0.95);
  details.beginFill(0xf5c15f, 0.2);
  details.drawCircle(project.x(entryX), project.y(entryY), 18 * project.scale);
  details.endFill();
  details.lineStyle(1 * project.scale, 0xffffff, 0.55);
  details.moveTo(project.x(entryX - 16), project.y(entryY));
  details.lineTo(project.x(entryX + 16), project.y(entryY));

  container.addChild(details);
  drawTextOnPlan(container, project, '入口', entryX, entryY + 28, 11);
}

function drawI3BridgeInstallation(container: PIXI.Container, project: Projector) {
  const bridge = new PIXI.Graphics();
  const [entryX, entryY] = I3_BRIDGE_FIELD_INTERIOR.entrance.exteriorSource;

  bridge.lineStyle(1.2 * project.scale, 0xf6d18c, 0.38);
  bridge.beginFill(0xd69e5b, 0.1);
  bridge.drawEllipse(project.x(1272), project.y(974), 112 * project.scale, 66 * project.scale);
  bridge.endFill();

  bridge.beginFill(0xb77849, 0.28);
  drawPolygon(bridge, project, [
    [1224, 958],
    [1296, 958],
    [1338, 1015],
    [1198, 1015],
  ]);
  bridge.endFill();

  const drawMound = (x: number, y: number, width: number, height: number, flip = false) => {
    const rect = project.rect(x, y, width, height);
    bridge.beginFill(0x6e4428, 0.16);
    bridge.drawEllipse(
      rect.x + rect.width / 2 + 5 * project.scale,
      rect.y + rect.height / 2 + 7 * project.scale,
      rect.width / 2,
      rect.height / 2,
    );
    bridge.endFill();

    bridge.lineStyle(1.4 * project.scale, 0xd8bd8e, 0.72);
    bridge.beginFill(0xd8bc8e, 0.92);
    bridge.drawEllipse(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width / 2, rect.height / 2);
    bridge.endFill();

    bridge.lineStyle(0.9 * project.scale, 0x9d7148, 0.34);
    for (let i = 0; i < 5; i++) {
      const t = 0.22 + i * 0.12;
      const sx = x + width * (flip ? 1 - t : t);
      const sy = y + height * 0.24;
      bridge.moveTo(project.x(sx), project.y(sy));
      bridge.bezierCurveTo(
        project.x(x + width * (flip ? 0.38 : 0.62)),
        project.y(y + height * (0.34 + i * 0.08)),
        project.x(x + width * (flip ? 0.28 : 0.72)),
        project.y(y + height * 0.78),
        project.x(x + width * (flip ? 0.16 : 0.84)),
        project.y(y + height * 0.94),
      );
    }
  };

  drawMound(1166, 930, 98, 76);
  drawMound(1278, 930, 98, 76, true);

  const shadow = project.rect(1170, 930, 206, 20);
  bridge.beginFill(0x1f1a17, 0.48);
  bridge.drawRoundedRect(shadow.x, shadow.y, shadow.width, shadow.height, 3 * project.scale);
  bridge.endFill();

  const beam = project.rect(1170, 912, 206, 17);
  bridge.lineStyle(1.2 * project.scale, 0x5c4638, 0.92);
  bridge.beginFill(0x2d241f, 0.96);
  bridge.drawRoundedRect(beam.x, beam.y, beam.width, beam.height, 2 * project.scale);
  bridge.endFill();
  bridge.lineStyle(1 * project.scale, 0x90735a, 0.45);
  bridge.moveTo(beam.x + 5 * project.scale, beam.y + 4 * project.scale);
  bridge.lineTo(beam.x + beam.width - 5 * project.scale, beam.y + 4 * project.scale);

  bridge.lineStyle(1.1 * project.scale, 0xf2e2bd, 0.44);
  bridge.moveTo(project.x(1248), project.y(950));
  bridge.bezierCurveTo(project.x(1262), project.y(938), project.x(1300), project.y(938), project.x(1314), project.y(950));
  bridge.moveTo(project.x(1246), project.y(1008));
  bridge.bezierCurveTo(project.x(1264), project.y(988), project.x(1300), project.y(988), project.x(1318), project.y(1008));

  bridge.lineStyle(2.2 * project.scale, 0xf5c15f, 0.92);
  bridge.beginFill(0xf5c15f, 0.18);
  bridge.drawCircle(project.x(entryX), project.y(entryY), 23 * project.scale);
  bridge.endFill();

  container.addChild(bridge);
}

function drawSecondaryWallStructures(container: PIXI.Container, project: Projector) {
  const wall = new PIXI.Graphics();
  wall.beginFill(0x5f4225, 0.13);
  for (const block of SECONDARY_WALL_STRUCTURES) {
    drawPolygon(wall, project, offsetPoints(block, 6, 7));
  }
  wall.endFill();

  for (const block of SECONDARY_WALL_STRUCTURES) {
    wall.lineStyle(1.6 * project.scale, 0x746b63, 0.9);
    wall.beginFill(0xb7b0aa, 0.96);
    drawPolygon(wall, project, block);
    wall.endFill();
    wall.lineStyle(0.9 * project.scale, 0x6f675f, 0.36);
    for (let i = 0; i < block.length; i++) {
      const from = block[i];
      const to = block[(i + 1) % block.length];
      wall.moveTo(project.x((from[0] + to[0]) / 2), project.y((from[1] + to[1]) / 2));
      wall.lineTo(project.x((from[0] + to[0]) / 2 + 16), project.y((from[1] + to[1]) / 2 + 14));
    }
  }

  container.addChild(wall);
}

function drawIceJoysBuilding(container: PIXI.Container, project: Projector) {
  const body = ICE_JOYS_BUILDING_RECTS[0];
  const rect = project.rect(body.x, body.y, body.width, body.height);
  const building = new PIXI.Graphics();

  building.beginFill(0x5f4225, 0.13);
  building.drawRoundedRect(
    rect.x + 7 * project.scale,
    rect.y + 9 * project.scale,
    rect.width,
    rect.height,
    4 * project.scale,
  );
  building.endFill();

  building.lineStyle(1.8 * project.scale, 0x928777, 0.92);
  building.beginFill(0xb9b3a6, 0.96);
  building.drawRoundedRect(rect.x, rect.y, rect.width, rect.height, 3 * project.scale);
  building.endFill();

  building.lineStyle(1 * project.scale, 0x7d7367, 0.42);
  for (let i = 1; i < 4; i++) {
    const x = rect.x + (rect.width / 4) * i;
    building.moveTo(x, rect.y + 8 * project.scale);
    building.lineTo(x + 2 * project.scale, rect.y + rect.height - 8 * project.scale);
  }
  for (let i = 1; i < 3; i++) {
    const y = rect.y + (rect.height / 3) * i;
    building.moveTo(rect.x + 8 * project.scale, y);
    building.lineTo(rect.x + rect.width - 8 * project.scale, y + 2 * project.scale);
  }

  for (const slat of ICE_JOYS_SIDE_SLATS) {
    const side = project.rect(slat.x, slat.y, slat.width, slat.height);
    building.lineStyle(1 * project.scale, 0x7b6f62, 0.85);
    building.beginFill(0xa9a198, 0.9);
    building.drawRect(side.x, side.y, side.width, side.height);
    building.endFill();
    building.lineStyle(1 * project.scale, 0xd7d0c4, 0.45);
    for (let y = side.y + 9 * project.scale; y < side.y + side.height; y += 12 * project.scale) {
      building.moveTo(side.x, y);
      building.lineTo(side.x + side.width, y + 2 * project.scale);
    }
  }

  container.addChild(building);
}

function drawExchangeBuilding(container: PIXI.Container, project: Projector) {
  const exchange = new PIXI.Graphics();
  const source = EXCHANGE_BUILDING_RECT;
  const outer = project.rect(source.x, source.y, source.width, source.height);
  exchange.beginFill(0x5f4225, 0.13);
  exchange.drawRoundedRect(
    outer.x + 7 * project.scale,
    outer.y + 8 * project.scale,
    outer.width,
    outer.height,
    6 * project.scale,
  );
  exchange.endFill();

  exchange.lineStyle(2 * project.scale, 0xb89b70, 0.9);
  exchange.beginFill(0xf1e5d2, 0.92);
  exchange.drawRoundedRect(outer.x, outer.y, outer.width, outer.height, 6 * project.scale);
  exchange.endFill();

  exchange.beginFill(0xd8b57a, 0.72);
  for (let i = 0; i < 7; i++) {
    const rect = project.rect(source.x + 8 + i * 10, source.y + 28, 7, 12);
    exchange.drawRect(rect.x, rect.y, rect.width, rect.height);
  }
  exchange.endFill();

  exchange.lineStyle(1.4 * project.scale, 0x9f8054, 0.82);
  for (let i = 0; i < 6; i++) {
    const x = source.x + 12 + i * 12;
    exchange.moveTo(project.x(x), project.y(source.y + 68));
    exchange.lineTo(project.x(x), project.y(source.y + source.height - 28));
  }

  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 5; col++) {
      exchange.beginFill(0xa58c62, 0.82);
      exchange.drawCircle(
        project.x(source.x + 18 + col * 12),
        project.y(source.y + 98 + row * 18),
        2.8 * project.scale,
      );
      exchange.endFill();
    }
  }

  container.addChild(exchange);
}

function drawClubDetails(container: PIXI.Container, project: Projector) {
  const club = new PIXI.Graphics();
  for (const body of CLUB_BUILDING_RECTS) {
    const rect = project.rect(body.x, body.y, body.width, body.height);
    club.beginFill(0x5f4225, 0.13);
    club.drawRoundedRect(
      rect.x + 7 * project.scale,
      rect.y + 8 * project.scale,
      rect.width,
      rect.height,
      4 * project.scale,
    );
    club.endFill();

    club.lineStyle(1.8 * project.scale, 0xb99d74, 0.9);
    club.beginFill(0xf0e2cc, 0.96);
    club.drawRoundedRect(rect.x, rect.y, rect.width, rect.height, 4 * project.scale);
    club.endFill();

    club.beginFill(0xb6aea4, 0.96);
    const sideWidth = Math.min(8 * project.scale, rect.width * 0.22);
    club.drawRect(rect.x, rect.y, sideWidth, rect.height);
    club.drawRect(rect.x + rect.width - sideWidth, rect.y, sideWidth, rect.height);
    club.endFill();

    club.lineStyle(0.9 * project.scale, 0x746b63, 0.65);
    for (let y = rect.y + 12 * project.scale; y < rect.y + rect.height; y += 15 * project.scale) {
      club.moveTo(rect.x, y);
      club.lineTo(rect.x + sideWidth, y);
      club.moveTo(rect.x + rect.width - sideWidth, y);
      club.lineTo(rect.x + rect.width, y);
    }

    club.lineStyle(1 * project.scale, 0x8d6937, 0.26);
    for (let i = 1; i < 3; i++) {
      const x = rect.x + (rect.width / 3) * i;
      club.moveTo(x, rect.y + 7 * project.scale);
      club.lineTo(x + 2 * project.scale, rect.y + rect.height - 7 * project.scale);
    }
    for (let i = 1; i < 3; i++) {
      const y = rect.y + (rect.height / 3) * i;
      club.moveTo(rect.x + 7 * project.scale, y);
      club.lineTo(rect.x + rect.width - 7 * project.scale, y + 1 * project.scale);
    }
  }
  container.addChild(club);
}

function drawSandCityPlan(
  container: PIXI.Container,
  project: Projector,
  worldWidth: number,
  worldHeight: number,
  markers: MapMarker[],
) {
  const terrain = new PIXI.Graphics();
  terrain.beginFill(0xd8c194);
  terrain.drawRect(0, 0, worldWidth, worldHeight);
  terrain.endFill();

  terrain.beginFill(0xbeb59e, 0.78);
  drawPolygon(terrain, project, [
    [0, 40],
    [112, 40],
    [137, 126],
    [1018, 126],
    [1018, 46],
    [1703, 46],
    [1703, 160],
    [0, 160],
  ]);
  terrain.endFill();

  terrain.beginFill(0xe0d5be, 0.92);
  drawPolygon(terrain, project, [
    [585, 160],
    [735, 160],
    [735, 130],
    [904, 130],
    [904, 160],
    [1703, 160],
    [1703, 215],
    [585, 195],
  ]);
  terrain.endFill();

  terrain.beginFill(0xd5bd8d, 0.96);
  drawPolygon(terrain, project, [
    [0, 905],
    [300, 900],
    [580, 928],
    [920, 932],
    [1210, 955],
    [1450, 985],
    [1703, 1090],
    [1703, 1279],
    [0, 1279],
  ]);
  terrain.endFill();

  terrain.beginFill(0x5c7f7a, 0.96);
  drawPolygon(terrain, project, [
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
  terrain.endFill();

  terrain.beginFill(0x6f968c, 0.42);
  drawPolygon(terrain, project, [
    [0, 990],
    [405, 994],
    [610, 1028],
    [860, 1018],
    [1110, 1040],
    [1390, 1088],
    [1703, 1098],
    [1703, 1135],
    [1370, 1118],
    [1110, 1084],
    [875, 1060],
    [620, 1072],
    [410, 1038],
    [0, 1038],
  ]);
  terrain.endFill();

  terrain.lineStyle(2 * project.scale, 0xc1b393, 0.65);
  terrain.moveTo(project.x(1020), project.y(38));
  terrain.lineTo(project.x(1703), project.y(158));
  terrain.lineStyle(4 * project.scale, 0xfbf8f0, 0.72);
  terrain.moveTo(project.x(0), project.y(1025));
  terrain.bezierCurveTo(
    project.x(410),
    project.y(1025),
    project.x(570),
    project.y(1070),
    project.x(770),
    project.y(1055),
  );
  terrain.bezierCurveTo(
    project.x(990),
    project.y(1042),
    project.x(1270),
    project.y(1104),
    project.x(1703),
    project.y(1118),
  );
  terrain.lineStyle(2 * project.scale, 0xffffff, 0.42);
  terrain.moveTo(project.x(0), project.y(1058));
  terrain.bezierCurveTo(
    project.x(420),
    project.y(1052),
    project.x(610),
    project.y(1094),
    project.x(790),
    project.y(1080),
  );
  terrain.bezierCurveTo(
    project.x(1020),
    project.y(1064),
    project.x(1260),
    project.y(1120),
    project.x(1703),
    project.y(1140),
  );

  terrain.beginFill(0xb19f86, 0.76);
  drawPolygon(terrain, project, [
    [432, 320],
    [470, 352],
    [496, 420],
    [570, 468],
    [650, 520],
    [795, 515],
    [930, 538],
    [1044, 600],
    [1160, 660],
    [1265, 705],
    [1314, 770],
    [1295, 840],
    [1242, 894],
    [1192, 836],
    [1078, 775],
    [950, 705],
    [825, 656],
    [684, 657],
    [575, 615],
    [504, 560],
    [430, 535],
    [392, 470],
    [386, 398],
  ]);
  terrain.endFill();

  terrain.beginFill(0xcbb78f, 0.42);
  drawPolygon(terrain, project, [
    [446, 350],
    [482, 397],
    [535, 456],
    [650, 536],
    [825, 545],
    [990, 574],
    [1120, 660],
    [1255, 740],
    [1228, 785],
    [1070, 696],
    [940, 640],
    [790, 596],
    [630, 595],
    [512, 515],
    [430, 482],
    [414, 420],
  ]);
  terrain.endFill();

  drawPolyline(
    terrain,
    project,
    [
      [560, 880],
      [620, 760],
      [688, 650],
      [760, 560],
      [824, 484],
      [892, 392],
    ],
    2,
    0x9d7a4d,
    0.85,
  );
  drawDashedLine(terrain, project, [840, 934], [890, 934], 18, 10, 4, 0xa17a48, 0.65);
  drawDashedLine(terrain, project, [842, 662], [895, 662], 18, 10, 4, 0xa17a48, 0.65);
  drawDashedLine(terrain, project, [834, 725], [885, 725], 18, 10, 4, 0xa17a48, 0.65);

  container.addChild(terrain);
  drawSandTexture(container, project);

  drawDiamondWall(container, project, 254, 135, 9, 15, 34);
  drawDiamondWall(container, project, 258, 498, 11, 15, 34);
  drawDiamondWall(container, project, 1572, 250, 12, 16, 36);
  drawDiamondWall(container, project, 1572, 666, 12, 16, 36);
  drawSecondaryWallStructures(container, project);

  drawPlanSlats(container, project);

  for (const block of planBlocks) {
    drawPlanBlock(container, project, block);
  }

  drawExchangeBuilding(container, project);
  drawBirdRestaurant(container, project);
  drawBirdRestaurantPhotoDetails(container, project);
  drawIceJoysBuilding(container, project);
  drawClubDetails(container, project);
  drawI3BridgeInstallation(container, project);
  drawSketchCircle(container, project, 148, 395, 55, 0xe8ddc8);
  drawSketchCircle(
    container,
    project,
    CLUB_ROUND_STAGE_CIRCLE.x,
    CLUB_ROUND_STAGE_CIRCLE.y,
    CLUB_ROUND_STAGE_CIRCLE.radius,
    0xe0d0b6,
  );
  drawCanvasTent(container, project, 882, 190, 62, 54);
  drawCanvasTent(container, project, 962, 188, 58, 52);
  drawCanvasTent(container, project, 1042, 190, 58, 52);

  drawVenueDetails(container, project);

  drawTextOnPlan(container, project, '候鸟巡游花车停放处', 132, 258, 16);
  drawTextOnPlan(container, project, '候鸟中心', 148, 395, 16);
  drawTextOnPlan(container, project, '沙城一级城墙', 298, 372, 16, 'center', '一级城墙');
  drawTextOnPlan(container, project, '伏园', 420, 198, 17, 'center', '伏园');
  drawTextOnPlan(container, project, '婚姻登记处', 398, 558, 16);
  drawTextOnPlan(container, project, '候鸟电影院', 528, 850, 14, 'center', '候鸟电影院');
  drawTextOnPlan(container, project, '候鸟工作坊', 766, 725, 15, 'center', '候鸟工作坊');
  drawTextOnPlan(container, project, '候鸟黑客松', 998, 286, 15, 'center', '候鸟黑客松');
  drawTextOnPlan(container, project, '时间广场', 1010, 352, 15, 'center', '时间广场');
  drawTextOnPlan(container, project, '候鸟交易所', 1348, 356, 15);
  drawTextOnPlan(container, project, '鸟其林', 1338, 650, 16);
  drawTextOnPlan(container, project, '冰JOYS\n灵感发酵局', 1476, 660, 14);
  drawTextOnPlan(container, project, '公路复古艺术展区', 1474, 388, 15, 'center', '艺术作品展区');
  drawTextOnPlan(container, project, '候鸟俱乐部', 1371, 838, 13, 'center', '候鸟俱乐部');
  drawTextOnPlan(container, project, '300.梯威', 1485, 918, 15, 'center', '300.梯威');
  drawTextOnPlan(container, project, '沙城二级城墙', 1620, 612, 16);

  addVenueHotspot(container, project, '一级城墙', 230, 130, 105, 650);
  addVenueHotspot(container, project, '伏园', 327, 110, 225, 205);
  addVenueHotspot(container, project, '候鸟电影院', 470, 800, 130, 95);
  addVenueHotspot(container, project, '候鸟工作坊', 690, 625, 150, 195);
  addVenueHotspot(container, project, '候鸟黑客松', 855, 210, 290, 130);
  addVenueHotspot(container, project, '时间广场', 930, 330, 225, 235);
  addVenueHotspot(container, project, '候鸟俱乐部', 1325, 775, 125, 230);
  addVenueHotspot(container, project, '艺术作品展区', 1415, 295, 125, 190);
  addVenueHotspot(container, project, '300.梯威', 1438, 800, 120, 240);

  addInstallationMarkers(container, project, markers);
}

export function drawSandCityModel(
  container: PIXI.Container,
  worldWidth: number,
  worldHeight: number,
  markers: MapMarker[],
) {
  const project = createProjector(worldWidth, worldHeight);
  drawSandCityPlan(container, project, worldWidth, worldHeight, markers);

  const clip = new PIXI.Graphics();
  clip.beginFill(0xffffff);
  clip.drawRect(0, 0, worldWidth, worldHeight);
  clip.endFill();
  container.addChild(clip);
  container.mask = clip;
}

// 内场各 kind 的填充色（Pixi 数值色），与 VenueInteriorMap.tsx 的配色大致对齐。
const INTERIOR_FILL: Record<InteriorRect['kind'], number> = {
  wall: 0xb39b72,
  sand: 0xc58f5d,
  sea: 0x8ba39d,
  mound: 0xc9a06f,
  bridge: 0xb9794b,
  shadow: 0x2d2520,
  path: 0xaa6c3e,
  stall: 0xb84a37,
  counter: 0xd4944b,
  stage: 0x46392f,
  speaker: 0x201f1d,
  table: 0xead6aa,
  seat: 0x312821,
  sofa: 0xd8c9a8,
  aisle: 0xcdb488,
  entry: 0xf5c15f,
  light: 0xffde97,
};

// 内场矢量渲染：把 source 坐标系（如 1280×720）的矩形/圆形铺到世界像素空间。
// 视觉与 data 里的布局一致；碰撞由 objectTiles 提供（见 data/interiorWorldMap.ts）。
export function drawInteriorModel(
  container: PIXI.Container,
  worldWidth: number,
  worldHeight: number,
  interior: VenueInteriorMap,
) {
  const sx = worldWidth / interior.source.width;
  const sy = worldHeight / interior.source.height;

  // 地面底色。
  const floor = new PIXI.Graphics();
  floor.beginFill(interior.scene === 'bridge' ? 0x9f633c : 0x7c5d3e);
  floor.drawRect(0, 0, worldWidth, worldHeight);
  floor.endFill();
  container.addChild(floor);

  const g = new PIXI.Graphics();
  for (const rect of interior.rects as InteriorRect[]) {
    g.beginFill(INTERIOR_FILL[rect.kind], rect.walkable ? 0.45 : 1);
    const x = rect.x * sx;
    const y = rect.y * sy;
    const w = rect.width * sx;
    const h = rect.height * sy;
    if (rect.kind === 'mound') {
      g.drawEllipse(x + w / 2, y + h / 2, w / 2, h / 2);
    } else if (rect.radius) {
      g.drawRoundedRect(x, y, w, h, Math.min(rect.radius * sx, Math.min(w, h) / 2));
    } else {
      g.drawRect(x, y, w, h);
    }
    g.endFill();
  }
  for (const circle of interior.circles as InteriorCircle[]) {
    g.beginFill(INTERIOR_FILL[circle.kind], circle.walkable ? 0.45 : 1);
    g.drawCircle(circle.x * sx, circle.y * sy, circle.radius * Math.min(sx, sy));
    g.endFill();
  }
  container.addChild(g);

  // 入口光环。
  const [ex, ey] = interior.entrance.interiorSource;
  const ring = new PIXI.Graphics();
  ring.lineStyle(3, 0xf5c15f, 0.9);
  ring.drawCircle(ex * sx, ey * sy, 1.4 * TILE);
  container.addChild(ring);

  // 区域文字标签，帮助辨认（与侧栏一致）。
  for (const label of interior.labels) {
    const text = new PIXI.Text(label.label, {
      fontSize: 13,
      fill: 0xffe3a8,
      fontWeight: 'bold',
      stroke: 0x2a1b13,
      strokeThickness: 3,
      align: 'center',
    });
    text.anchor.set(0.5);
    text.x = label.x * sx;
    text.y = label.y * sy;
    container.addChild(text);
  }
}

export const PixiStaticMap = PixiComponent('StaticMap', {
  create: (props: { map: WorldMap; markers?: MapMarker[]; interior?: VenueInteriorMap; [k: string]: any }) => {
    const map = props.map;
    const screenxtiles = map.bgTiles[0].length;
    const screenytiles = map.bgTiles[0][0].length;
    const worldWidth = screenxtiles * TILE;
    const worldHeight = screenytiles * TILE;

    // 优先用 DB 传入的作品标记；缺省回退静态种子。
    const markers: MapMarker[] = props.markers ?? INSTALLATIONS;

    const container = new PIXI.Container();
    if (props.interior) {
      drawInteriorModel(container, worldWidth, worldHeight, props.interior);
    } else {
      drawSandCityModel(container, worldWidth, worldHeight, markers);
    }

    container.x = 0;
    container.y = 0;
    container.interactive = true;
    container.hitArea = new PIXI.Rectangle(0, 0, worldWidth, worldHeight);

    return container;
  },

  applyProps: (instance, oldProps, newProps) => {
    applyDefaultProps(instance, oldProps, newProps);
  },
});
