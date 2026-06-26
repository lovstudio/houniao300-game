import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { WorldMap } from '../../convex/aiTown/worldMap';
import {
  BIRD_RESTAURANT_WALL_SEGMENTS,
  BIRD_RESTAURANT_WALLS,
  CLUB_BUILDING_RECTS,
  ICE_JOYS_BUILDING_RECTS,
  ICE_JOYS_SIDE_SLATS,
  SECONDARY_WALL_STRUCTURES,
  SPACE_BARRIERS,
} from '../../data/sandCityGeometry';
import { INSTALLATIONS, type Installation } from '../../data/installations';
import { selectInstallationOnMap, selectVenueOnMap } from '../lib/mapFocus';

const TILE = 32;
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

function addInstallationMarker(
  container: PIXI.Container,
  project: Projector,
  installation: Installation,
) {
  const accent = INSTALLATION_COLORS[installation.id.slice(0, 1)] ?? 0x1da76e;
  const wrapper = new PIXI.Container();
  wrapper.x = project.x(installation.x);
  wrapper.y = project.y(installation.y);
  wrapper.eventMode = 'static';
  wrapper.cursor = 'pointer';

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

function addInstallationMarkers(container: PIXI.Container, project: Projector) {
  for (const installation of INSTALLATIONS) {
    addInstallationMarker(container, project, installation);
  }
}

const planBlocks: PlanBlock[] = [
  { x: 42, y: 124, width: 176, height: 170, fill: 0xe6c684, stroke: 0xb78b46, radius: 10 },
  { x: 327, y: 122, width: 184, height: 168, fill: 0xd9b06c, stroke: 0xa87938, radius: 14 },
  { x: 360, y: 520, width: 75, height: 75, fill: 0xe7dcc8, stroke: 0xb99d74, radius: 4 },
  { x: 492, y: 828, width: 76, height: 38, fill: 0xf2e4ce, stroke: 0xb99d74, radius: 5 },
  { x: 655, y: 560, width: 88, height: 90, fill: 0xe5c18a, stroke: 0xb28548, radius: 4 },
  { x: 875, y: 260, width: 245, height: 62, fill: 0xe2d0b0, stroke: 0xae936d, radius: 4 },
  { x: 1418, y: 448, width: 140, height: 86, fill: 0xd8ad67, stroke: 0xaa7f43, radius: 5 },
  { x: 1452, y: 788, width: 86, height: 132, fill: 0xe0b86f, stroke: 0xaa7f43, radius: 5 },
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

  for (let i = 0; i < 7; i++) {
    const x = 1168 + i * 13;
    const rect = project.rect(x, 324, 10, 12);
    details.beginFill(0xc6aa78, 0.92);
    details.drawRect(rect.x, rect.y, rect.width, rect.height);
    details.endFill();
  }

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 5; col++) {
      details.beginFill(0xa58c62, 0.86);
      details.drawCircle(
        project.x(1255 + col * 15),
        project.y(370 + row * 15),
        2.8 * project.scale,
      );
      details.endFill();
    }
  }

  details.lineStyle(2 * project.scale, 0xb48d58, 0.78);
  for (let i = 0; i < 5; i++) {
    const x = 1258 + i * 17;
    details.moveTo(project.x(x), project.y(505));
    details.lineTo(project.x(x), project.y(600));
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

  drawPolyline(building, project, [[1162, 642], [1218, 684], [1164, 724]], 1, 0x8f806d, 0.5);
  drawPolyline(building, project, [[1290, 622], [1330, 678], [1280, 724]], 1, 0x8f806d, 0.5);
  drawPolyline(building, project, [[1196, 760], [1248, 782], [1318, 736]], 1, 0x8f806d, 0.5);

  building.beginFill(0xa58c62, 0.72);
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 3; col++) {
      const leftX = 1168 + col * 17;
      const rightX = 1292 + col * 17;
      const y = 628 + row * 18;
      building.drawRect(project.x(leftX), project.y(y), 6 * project.scale, 6 * project.scale);
      building.drawRect(project.x(rightX), project.y(y), 6 * project.scale, 6 * project.scale);
    }
  }
  building.endFill();

  container.addChild(building);
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
  const outer = project.rect(1228, 310, 130, 174);
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
  for (let i = 0; i < 6; i++) {
    const rect = project.rect(1234 + i * 18, 322, 11, 16);
    exchange.drawRect(rect.x, rect.y, rect.width, rect.height);
  }
  exchange.endFill();

  exchange.lineStyle(1.4 * project.scale, 0x9f8054, 0.82);
  for (let i = 0; i < 6; i++) {
    const x = 1240 + i * 18;
    exchange.moveTo(project.x(x), project.y(350));
    exchange.lineTo(project.x(x), project.y(468));
  }

  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 5; col++) {
      exchange.beginFill(0xa58c62, 0.82);
      exchange.drawCircle(
        project.x(1252 + col * 15),
        project.y(370 + row * 15),
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
    const sideWidth = 16 * project.scale;
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
  drawDiamondWall(container, project, 1602, 342, 10, 16, 36);
  drawDiamondWall(container, project, 1608, 720, 12, 16, 36);
  drawSecondaryWallStructures(container, project);

  drawPlanSlats(container, project);

  for (const block of planBlocks) {
    drawPlanBlock(container, project, block);
  }

  drawExchangeBuilding(container, project);
  drawBirdRestaurant(container, project);
  drawIceJoysBuilding(container, project);
  drawClubDetails(container, project);
  drawSketchCircle(container, project, 148, 395, 55, 0xe8ddc8);
  drawSketchCircle(container, project, 1368, 886, 26, 0xe0d0b6);
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
  drawTextOnPlan(container, project, '候鸟工作坊', 700, 606, 15, 'center', '候鸟工作坊');
  drawTextOnPlan(container, project, '候鸟黑客松', 998, 286, 15, 'center', '候鸟黑客松');
  drawTextOnPlan(container, project, '时间广场', 1010, 352, 15, 'center', '时间广场');
  drawTextOnPlan(container, project, '候鸟交易所', 1284, 362, 15);
  drawTextOnPlan(container, project, '鸟其林', 1232, 662, 16);
  drawTextOnPlan(container, project, '冰JOYS\n灵感发酵局', 1414, 660, 14);
  drawTextOnPlan(container, project, '公路复古艺术展区', 1488, 492, 15, 'center', '艺术作品展区');
  drawTextOnPlan(container, project, '候鸟俱乐部', 1344, 802, 13, 'center', '候鸟俱乐部');
  drawTextOnPlan(container, project, '300.梯威', 1496, 850, 15, 'center', '300.梯威');
  drawTextOnPlan(container, project, '沙城二级城墙', 1646, 612, 16);

  addVenueHotspot(container, project, '一级城墙', 230, 130, 105, 650);
  addVenueHotspot(container, project, '伏园', 327, 110, 225, 205);
  addVenueHotspot(container, project, '候鸟电影院', 470, 800, 130, 95);
  addVenueHotspot(container, project, '候鸟工作坊', 620, 535, 155, 150);
  addVenueHotspot(container, project, '候鸟黑客松', 855, 210, 290, 130);
  addVenueHotspot(container, project, '时间广场', 930, 330, 225, 235);
  addVenueHotspot(container, project, '候鸟俱乐部', 1290, 735, 130, 135);
  addVenueHotspot(container, project, '艺术作品展区', 1400, 425, 180, 135);
  addVenueHotspot(container, project, '300.梯威', 1435, 765, 125, 180);

  addInstallationMarkers(container, project);
}

export function drawSandCityModel(
  container: PIXI.Container,
  worldWidth: number,
  worldHeight: number,
) {
  const project = createProjector(worldWidth, worldHeight);
  drawSandCityPlan(container, project, worldWidth, worldHeight);

  const clip = new PIXI.Graphics();
  clip.beginFill(0xffffff);
  clip.drawRect(0, 0, worldWidth, worldHeight);
  clip.endFill();
  container.addChild(clip);
  container.mask = clip;
}

export const PixiStaticMap = PixiComponent('StaticMap', {
  create: (props: { map: WorldMap; [k: string]: any }) => {
    const map = props.map;
    const screenxtiles = map.bgTiles[0].length;
    const screenytiles = map.bgTiles[0][0].length;
    const worldWidth = screenxtiles * TILE;
    const worldHeight = screenytiles * TILE;

    const container = new PIXI.Container();
    drawSandCityModel(container, worldWidth, worldHeight);

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
