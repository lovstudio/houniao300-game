import { PixiComponent, applyDefaultProps } from '@pixi/react';
import * as PIXI from 'pixi.js';
import { WorldMap } from '../../convex/aiTown/worldMap';
import { INSTALLATIONS, type Installation } from '../../data/installations';
import { selectInstallationOnMap, selectVenueOnMap } from '../lib/mapFocus';

const TILE = 32;
const SOURCE_WIDTH = 1703;
const SOURCE_HEIGHT = 1279;

type SourcePoint = [number, number];

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

function drawPolygon(
  graphics: PIXI.Graphics,
  project: ReturnType<typeof createProjector>,
  points: SourcePoint[],
) {
  graphics.drawPolygon(points.flatMap((point) => project.point(point)));
}

function drawBuilding(
  container: PIXI.Container,
  project: ReturnType<typeof createProjector>,
  x: number,
  y: number,
  width: number,
  height: number,
  fill = 0xf3ead9,
  radius = 8,
) {
  const rect = project.rect(x, y, width, height);
  const shadow = new PIXI.Graphics();
  shadow.beginFill(0x614a33, 0.2);
  shadow.drawRoundedRect(
    rect.x + 7 * project.scale,
    rect.y + 9 * project.scale,
    rect.width,
    rect.height,
    radius * project.scale,
  );
  shadow.endFill();
  container.addChild(shadow);

  const body = new PIXI.Graphics();
  body.lineStyle(2.5 * project.scale, 0xb99d74, 0.95);
  body.beginFill(fill);
  body.drawRoundedRect(rect.x, rect.y, rect.width, rect.height, radius * project.scale);
  body.endFill();
  body.lineStyle(1.4 * project.scale, 0xffffff, 0.35);
  body.moveTo(rect.x + 10 * project.scale, rect.y + 10 * project.scale);
  body.lineTo(rect.x + rect.width - 12 * project.scale, rect.y + 5 * project.scale);
  container.addChild(body);
}

function drawTent(
  container: PIXI.Container,
  project: ReturnType<typeof createProjector>,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const tent = new PIXI.Graphics();
  tent.lineStyle(1.5 * project.scale, 0xc5b79f, 0.9);
  tent.beginFill(0xf2eee6);
  drawPolygon(tent, project, [
    [x + width * 0.5, y],
    [x + width, y + height * 0.75],
    [x + width * 0.8, y + height],
    [x + width * 0.2, y + height],
    [x, y + height * 0.75],
  ]);
  tent.endFill();
  container.addChild(tent);
}

function drawPod(
  container: PIXI.Container,
  project: ReturnType<typeof createProjector>,
  x: number,
  y: number,
  r = 13,
) {
  const shadow = new PIXI.Graphics();
  shadow.beginFill(0x5a432c, 0.22);
  shadow.drawEllipse(
    project.x(x + 3),
    project.y(y + 4),
    r * 1.05 * project.scale,
    r * 0.7 * project.scale,
  );
  shadow.endFill();
  container.addChild(shadow);

  const pod = new PIXI.Graphics();
  pod.lineStyle(1.2 * project.scale, 0xcfc4b2, 0.9);
  pod.beginFill(0xf6f3ec);
  pod.drawEllipse(project.x(x), project.y(y), r * project.scale, r * 0.78 * project.scale);
  pod.endFill();
  // ridge highlight to suggest a rounded canvas dome
  pod.lineStyle(1 * project.scale, 0xffffff, 0.5);
  pod.moveTo(project.x(x - r * 0.6), project.y(y - r * 0.1));
  pod.quadraticCurveTo(
    project.x(x),
    project.y(y - r * 0.55),
    project.x(x + r * 0.6),
    project.y(y - r * 0.1),
  );
  container.addChild(pod);
}

function drawSandWall(
  container: PIXI.Container,
  project: ReturnType<typeof createProjector>,
  points: SourcePoint[],
) {
  const shadow = new PIXI.Graphics();
  shadow.beginFill(0x5a432c, 0.18);
  drawPolygon(
    shadow,
    project,
    points.map(([x, y]) => [x + 8, y + 8]),
  );
  shadow.endFill();
  container.addChild(shadow);

  const wall = new PIXI.Graphics();
  wall.lineStyle(2 * project.scale, 0xaa7f43, 0.9);
  wall.beginFill(0xd8ad67);
  drawPolygon(wall, project, points);
  wall.endFill();
  wall.lineStyle(1.4 * project.scale, 0xf3d58f, 0.65);
  const [a, b, c, d] = points;
  wall.moveTo(project.x((a[0] + d[0]) / 2), project.y((a[1] + d[1]) / 2));
  wall.lineTo(project.x((b[0] + c[0]) / 2), project.y((b[1] + c[1]) / 2));
  container.addChild(wall);
}

function addLabel(
  container: PIXI.Container,
  project: ReturnType<typeof createProjector>,
  text: string,
  x: number,
  y: number,
  venue?: string,
) {
  const wrapper = new PIXI.Container();
  wrapper.x = project.x(x);
  wrapper.y = project.y(y);

  const label = new PIXI.Text(text, {
    fill: 0xffffff,
    fontFamily: 'sans-serif',
    fontSize: 24 * project.scale,
    fontWeight: '700',
    letterSpacing: 1,
    lineJoin: 'round',
    stroke: 0x111111,
    strokeThickness: 2 * project.scale,
  });
  label.x = 9 * project.scale;
  label.y = 5 * project.scale;
  label.resolution = 2;

  const background = new PIXI.Graphics();
  background.beginFill(0x1a1a1a, 0.82);
  background.drawRoundedRect(
    0,
    0,
    label.width + 18 * project.scale,
    label.height + 10 * project.scale,
    3 * project.scale,
  );
  background.endFill();

  wrapper.addChild(background);
  wrapper.addChild(label);

  // Labels bound to a festival venue are clickable: open that venue's schedule in the
  // sidebar. Stop propagation so the tap doesn't also drive the map's move-to navigation.
  if (venue) {
    wrapper.eventMode = 'static';
    wrapper.cursor = 'pointer';
    const stop = (e: PIXI.FederatedPointerEvent) => e.stopPropagation();
    wrapper.on('pointerdown', stop);
    wrapper.on('pointerup', stop);
    wrapper.on('pointertap', (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      selectVenueOnMap(venue);
    });
  }

  container.addChild(wrapper);
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
  project: ReturnType<typeof createProjector>,
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
    letterSpacing: 0.4,
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

function addInstallationMarkers(
  container: PIXI.Container,
  project: ReturnType<typeof createProjector>,
) {
  for (const installation of INSTALLATIONS) {
    addInstallationMarker(container, project, installation);
  }
}

// Shoreline taken from the user's hand-drawn marks on the aerial photo: a steep upper
// segment, a bend at the tidal pond, then a flatter lower segment exiting the bottom
// edge at ~4/5 width. The lower segment runs through the pond so sea and pond connect.
const coastline: SourcePoint[] = [
  [0, 176],
  [268, 450],
  [508, 690],
  [690, 875],
  [951, 1050],
  [1245, 1230],
  [1340, 1279],
];

const seaPolygon: SourcePoint[] = [...coastline, [0, 1279]];

// Offset the shoreline perpendicularly into the sea (down-left) by `d` source-pixels.
function offsetCoast(d: number): SourcePoint[] {
  return coastline.map(([x, y], i) => {
    const prev = coastline[Math.max(0, i - 1)];
    const next = coastline[Math.min(coastline.length - 1, i + 1)];
    const tx = next[0] - prev[0];
    const ty = next[1] - prev[1];
    const len = Math.hypot(tx, ty) || 1;
    // right-hand normal (-ty, tx) points toward the sea (negative x / positive y)
    return [x + (-ty / len) * d, y + (tx / len) * d] as SourcePoint;
  });
}

function drawFoamLine(
  graphics: PIXI.Graphics,
  project: ReturnType<typeof createProjector>,
  pts: SourcePoint[],
  width: number,
  color: number,
  alpha: number,
) {
  graphics.lineStyle(width * project.scale, color, alpha);
  graphics.moveTo(...project.point(pts[0]));
  for (const p of pts.slice(1)) {
    graphics.lineTo(...project.point(p));
  }
}

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

// Deterministic layout of the east-side glamping pods (shared with sandCity collision).
function podField(): SourcePoint[] {
  const pods: SourcePoint[] = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      pods.push([1448 + c * 44 + r * 4, 726 + r * 80 + c * 6]);
    }
  }
  return pods;
}

function drawRoad(
  graphics: PIXI.Graphics,
  project: ReturnType<typeof createProjector>,
  width: number,
  color: number,
  alpha: number,
  points: SourcePoint[],
) {
  graphics.lineStyle(width * project.scale, color, alpha);
  const [first, ...rest] = points;
  graphics.moveTo(...project.point(first));
  for (const point of rest) {
    graphics.lineTo(...project.point(point));
  }
}

export function drawSandCityModel(
  container: PIXI.Container,
  worldWidth: number,
  worldHeight: number,
) {
  const project = createProjector(worldWidth, worldHeight);
  const terrain = new PIXI.Graphics();

  terrain.beginFill(0xd8c194);
  terrain.drawRect(0, 0, worldWidth, worldHeight);
  terrain.endFill();

  terrain.beginFill(0x5c7f7a);
  drawPolygon(terrain, project, seaPolygon);
  terrain.endFill();

  // Shallow-water tint hugging the shoreline.
  terrain.beginFill(0x6f968c, 0.6);
  drawPolygon(terrain, project, [...coastline, ...offsetCoast(120).reverse()]);
  terrain.endFill();

  // Muddy tidal pond in the centre of the site.
  terrain.lineStyle(3 * project.scale, 0x8a7448, 0.6);
  terrain.beginFill(0x6f5c3b);
  drawPolygon(terrain, project, pondPolygon);
  terrain.endFill();
  terrain.lineStyle(0);
  terrain.beginFill(0x83703f, 0.4);
  drawPolygon(
    terrain,
    project,
    pondPolygon.map(([x, y]) => [934 + (x - 934) * 0.6, 966 + (y - 966) * 0.6]),
  );
  terrain.endFill();

  terrain.beginFill(0x4f7a47);
  drawPolygon(terrain, project, forestPolygon);
  terrain.endFill();

  terrain.beginFill(0x679550);
  drawPolygon(terrain, project, hotelGreenPolygon);
  terrain.endFill();

  terrain.beginFill(0xd3bf94, 0.72);
  drawPolygon(terrain, project, [
    [740, 362],
    [1030, 418],
    [1240, 520],
    [1130, 605],
    [900, 505],
    [755, 452],
  ]);
  terrain.endFill();

  drawRoad(terrain, project, 26, 0xb8b0a0, 0.95, [
    [440, -20],
    [585, 145],
    [735, 225],
    [950, 332],
    [1220, 505],
    [1545, 610],
  ]);
  drawRoad(terrain, project, 15, 0xd7d1c4, 0.9, [
    [990, 372],
    [1100, 490],
    [1090, 720],
    [1225, 1020],
    [1350, 1279],
  ]);

  // White foam breaking along the shoreline (a few offset wavy lines inside the sea).
  drawFoamLine(terrain, project, offsetCoast(8), 7, 0xfbf8f0, 0.9);
  drawFoamLine(terrain, project, offsetCoast(34), 4, 0xffffff, 0.6);
  drawFoamLine(terrain, project, offsetCoast(64), 3, 0xffffff, 0.4);

  container.addChild(terrain);

  const treeLayer = new PIXI.Graphics();
  for (let i = 0; i < 190; i++) {
    const sourceX = 660 + ((i * 73) % 720);
    const sourceY = 18 + ((i * 47) % 420);
    if (!pointInRoughForest(sourceX, sourceY)) continue;
    treeLayer.beginFill(i % 3 === 0 ? 0x365f3f : i % 3 === 1 ? 0x4f7f52 : 0x2e5538, 0.92);
    treeLayer.drawCircle(project.x(sourceX), project.y(sourceY), (10 + (i % 5)) * project.scale);
    treeLayer.endFill();
  }
  container.addChild(treeLayer);

  const tracks = new PIXI.Graphics();
  tracks.lineStyle(1.8 * project.scale, 0x8f7651, 0.34);
  for (let i = 0; i < 18; i++) {
    const y = 500 + i * 32;
    tracks.moveTo(project.x(430 + i * 16), project.y(y));
    tracks.bezierCurveTo(
      project.x(650 + i * 8),
      project.y(y - 90),
      project.x(900 + i * 4),
      project.y(y - 20),
      project.x(1130 + i * 6),
      project.y(y + 75),
    );
  }
  tracks.lineStyle(1.6 * project.scale, 0x7f6a4a, 0.28);
  for (let i = 0; i < 9; i++) {
    tracks.moveTo(project.x(905 + i * 54), project.y(710 + i * 18));
    tracks.lineTo(project.x(1260 + i * 35), project.y(1030 + i * 20));
  }
  container.addChild(tracks);

  drawBuilding(container, project, 105, 138, 118, 68, 0xf3eadc);
  drawTent(container, project, 256, 74, 64, 44);
  drawTent(container, project, 332, 70, 70, 50);
  drawBuilding(container, project, 395, 92, 88, 58, 0xf1e2c8);
  drawBuilding(container, project, 250, 160, 138, 58, 0xf0d09a);
  drawBuilding(container, project, 490, 125, 96, 62, 0xf3e8d7);
  drawBuilding(container, project, 176, 276, 135, 68, 0xf4eee2);
  drawBuilding(container, project, 214, 400, 140, 72, 0xf1e7da);
  drawBuilding(container, project, 406, 374, 154, 88, 0xf0dbb6);
  drawBuilding(container, project, 702, 298, 192, 156, 0xf2eadc);
  drawBuilding(container, project, 1118, 482, 154, 94, 0xf3eadb);
  drawBuilding(container, project, 1288, 612, 255, 114, 0xe8ddc8);
  drawBuilding(container, project, 1182, 858, 180, 128, 0xf1eee7);

  const special = new PIXI.Graphics();
  special.lineStyle(3 * project.scale, 0xb99d74, 0.95);
  special.beginFill(0xf5efe4);
  drawPolygon(special, project, [
    [955, 548],
    [1075, 556],
    [1118, 624],
    [1070, 698],
    [958, 700],
    [908, 628],
  ]);
  special.endFill();
  container.addChild(special);

  drawBuilding(container, project, 910, 712, 150, 70, 0xead4b0);
  drawBuilding(container, project, 642, 625, 210, 112, 0xc8a16c);

  for (const wall of sandWallPolygons) {
    drawSandWall(container, project, wall);
  }

  // Glamping pod field on the east side; rows follow the diagonal coastline.
  for (const [px, py] of podField()) {
    drawPod(container, project, px, py);
  }

  const plazas = new PIXI.Graphics();
  plazas.lineStyle(3 * project.scale, 0xf4e7c8, 0.75);
  plazas.beginFill(0xd9c39b, 0.42);
  plazas.drawEllipse(project.x(800), project.y(498), 96 * project.scale, 40 * project.scale);
  plazas.drawEllipse(project.x(745), project.y(665), 112 * project.scale, 42 * project.scale);
  plazas.endFill();
  container.addChild(plazas);

  addLabel(container, project, '候鸟巡游花车停放处', 214, 45);
  addLabel(container, project, '候鸟中心', 102, 150);
  addLabel(container, project, '一级城墙', 252, 178, '一级城墙');
  addLabel(container, project, '伏园', 494, 137, '伏园');
  addLabel(container, project, '婚姻登记处', 180, 282);
  addLabel(container, project, '候鸟电影院', 212, 405, '候鸟电影院');
  addLabel(container, project, '候鸟工作坊', 398, 380, '候鸟工作坊');
  addLabel(container, project, '候鸟黑客松', 706, 312, '候鸟黑客松');
  addLabel(container, project, '时间广场', 762, 470, '时间广场');
  addLabel(container, project, '候鸟交易所', 1120, 494);
  addLabel(container, project, '鸟其林', 990, 590);
  addLabel(container, project, '候鸟俱乐部', 925, 718, '候鸟俱乐部');
  addLabel(container, project, '候鸟沙城剧场', 670, 642);
  addLabel(container, project, '公路复古艺术展区', 1305, 645, '艺术作品展区');
  addLabel(container, project, '300.梯威', 1180, 880, '300.梯威');
  addLabel(container, project, '二级城墙', 1480, 805);
  addInstallationMarkers(container, project);

  // Clip the whole model to the map rectangle: the sea / shallow water / foam are
  // projected past the shoreline (negative x, y beyond the bottom) and would
  // otherwise bleed outside the map container. The mask is a child so it tracks
  // the container's own transform.
  const clip = new PIXI.Graphics();
  clip.beginFill(0xffffff);
  clip.drawRect(0, 0, worldWidth, worldHeight);
  clip.endFill();
  container.addChild(clip);
  container.mask = clip;
}

function pointInRoughForest(x: number, y: number) {
  return x > 600 && y < 455 && !(x < 760 && y > 250) && !(x > 1375 && y > 330);
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
