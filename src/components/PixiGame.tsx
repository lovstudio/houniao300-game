import * as PIXI from 'pixi.js';
import { useApp } from '@pixi/react';
import { Player, SelectElement } from './Player.tsx';
import { useEffect, useRef, useState } from 'react';
import { PixiStaticMap, type MapMarker } from './PixiStaticMap.tsx';
import PixiViewport, { viewportMinScale } from './PixiViewport.tsx';
import { Viewport } from 'pixi-viewport';
import { Id } from '../../convex/_generated/dataModel';
import { useConvex, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api.js';
import { useSendInput } from '../hooks/sendInput.ts';
import { toastOnError } from '../toasts.ts';
import { DebugCollisionOverlay } from './DebugCollisionOverlay.tsx';
import { PositionIndicator } from './PositionIndicator.tsx';
import { VenuePing } from './VenuePing.tsx';
import {
  setMapFocusHandler,
  setMapFocusTileHandler,
  isMapTapCaptureActive,
  captureMapTap,
  selectInstallationOnMap,
} from '../lib/mapFocus.ts';
import { INSTALLATIONS } from '../../data/installations.ts';
import {
  sandCityGeometryControlsCollision,
  tilePositionBlockedBySolidGeometry,
} from '../../data/sandCityGeometry.ts';
import { VENUE_INTERIOR_MAPS } from '../../data/birdRestaurantInterior.ts';
import type { ControlMode, NearbyPrompt } from './Game.tsx';
import { SHOW_DEV_TOOLS } from '../lib/debugSettings.ts';
import { ServerGame } from '../hooks/serverGame.ts';
import { COLLISION_THRESHOLD } from '../../convex/constants.ts';
import { Location, playerLocation } from '../../convex/aiTown/location.ts';

const MAP_SOURCE_WIDTH = 1703;
const MAP_SOURCE_HEIGHT = 1279;
// 走近作品多少格内开始提示「按空格查看详情」。
const INSTALLATION_PROMPT_RADIUS_TILES = 2.5;
const KEYBOARD_MOVE_REPEAT_MS = 180;
// 必须与服务器 data/characters.ts 的 movementSpeed 数值一致（同为 tiles/秒），否则点击移动的乐观
// 预测速率与服务器不符，角色会先慢爬再被拽正。此前 main 误以为服务器是 0.75（实为 8），慢了 5.3x。
const LOCAL_PLAYER_SPEED_TILES_PER_SECOND = 8;
const MAX_OPTIMISTIC_PATH_LENGTH = 2;
const SERVER_SNAP_DISTANCE_TILES = 1.5;
const SERVER_SETTLE_DISTANCE_TILES = 0.1;
const SERVER_SETTLE_LERP = 0.08;
const SERVER_CATCHUP_GRACE_MS = 2500;
const MOVEMENT_KEYS = new Set([
  'arrowleft',
  'arrowright',
  'arrowup',
  'arrowdown',
  'a',
  'd',
  'w',
  's',
]);

type RuntimeGameState = {
  controlMode: ControlMode;
  cameraFollow: boolean;
  engineId: Id<'engines'>;
  game: ServerGame;
  height: number;
  humanPlayerId?: string;
  onSetCameraFollow: (enabled: boolean) => void;
  onToggleCameraFollow: () => void;
  onToggleControlMode: () => void;
  players: any[];
  tileDim: number;
  width: number;
  worldHeightPx: number;
  worldWidthPx: number;
};

function isMapDestinationBlocked(destination: { x: number; y: number }, state: RuntimeGameState) {
  if (
    destination.x < 0 ||
    destination.y < 0 ||
    destination.x >= state.game.worldMap.width ||
    destination.y >= state.game.worldMap.height
  ) {
    return true;
  }
  if (sandCityGeometryControlsCollision(state.game.worldMap.width, state.game.worldMap.height)) {
    if (
      tilePositionBlockedBySolidGeometry(
        destination,
        state.game.worldMap.width,
        state.game.worldMap.height,
      )
    ) {
      return true;
    }
  } else {
    for (const layer of state.game.worldMap.objectTiles) {
      if (layer[destination.x]?.[destination.y] !== -1) {
        return true;
      }
    }
  }
  for (const player of state.players) {
    if (player.id === state.humanPlayerId) continue;
    const dx = player.position.x - destination.x;
    const dy = player.position.y - destination.y;
    if (Math.sqrt(dx * dx + dy * dy) < COLLISION_THRESHOLD) {
      return true;
    }
  }
  return false;
}

type GridDestination = { x: number; y: number };
type SentDestination = GridDestination & { t: number };

// 客户端 4-邻接 A*，复刻服务器 movement.ts:findRoute 的网格寻路，用于点击移动的本地预测。
// 地图仅 53×53，open set 用线性扫描足矣（KISS）。找不到路径时返回空数组，交还给服务器。
function findOptimisticGridPath(
  start: GridDestination,
  destination: GridDestination,
  state: RuntimeGameState,
): GridDestination[] {
  if (start.x === destination.x && start.y === destination.y) return [];
  const w = state.game.worldMap.width;
  const h = state.game.worldMap.height;
  const idx = (x: number, y: number) => y * w + x;
  const heuristic = (x: number, y: number) =>
    Math.abs(x - destination.x) + Math.abs(y - destination.y);
  const open: Array<{ x: number; y: number; g: number; f: number }> = [
    { x: start.x, y: start.y, g: 0, f: heuristic(start.x, start.y) },
  ];
  const gScore = new Map<number, number>([[idx(start.x, start.y), 0]]);
  const cameFrom = new Map<number, number>();
  const closed = new Set<number>();
  const directions = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];
  while (open.length > 0) {
    let bestIndex = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIndex].f) bestIndex = i;
    }
    const current = open.splice(bestIndex, 1)[0];
    const currentKey = idx(current.x, current.y);
    if (current.x === destination.x && current.y === destination.y) {
      const path: GridDestination[] = [];
      let key = currentKey;
      while (cameFrom.has(key)) {
        path.push({ x: key % w, y: Math.floor(key / w) });
        key = cameFrom.get(key)!;
      }
      return path.reverse();
    }
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);
    for (const { dx, dy } of directions) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const neighborKey = idx(nx, ny);
      if (closed.has(neighborKey)) continue;
      if (isMapDestinationBlocked({ x: nx, y: ny }, state)) continue;
      const tentativeG = current.g + 1;
      if (gScore.has(neighborKey) && tentativeG >= gScore.get(neighborKey)!) continue;
      gScore.set(neighborKey, tentativeG);
      cameFrom.set(neighborKey, currentKey);
      open.push({ x: nx, y: ny, g: tentativeG, f: tentativeG + heuristic(nx, ny) });
    }
  }
  return [];
}

function isKeyboardInputTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return !!element?.closest('input, textarea, select, [contenteditable="true"]');
}

function movementVector(key: string) {
  switch (key) {
    case 'arrowleft':
    case 'a':
      return { dx: -1, dy: 0 };
    case 'arrowright':
    case 'd':
      return { dx: 1, dy: 0 };
    case 'arrowup':
    case 'w':
      return { dx: 0, dy: -1 };
    case 'arrowdown':
    case 's':
      return { dx: 0, dy: 1 };
    default:
      return null;
  }
}

export const PixiGame = (props: {
  userId: string;
  worldId: Id<'worlds'>;
  engineId: Id<'engines'>;
  game: ServerGame;
  historicalTime: number | undefined;
  width: number;
  height: number;
  controlMode: ControlMode;
  cameraFollow: boolean;
  onToggleControlMode: () => void;
  onToggleCameraFollow: () => void;
  onSetCameraFollow: (enabled: boolean) => void;
  onEnterVenueInterior?: (interiorId: string) => void;
  showCollisionOverlay: boolean;
  setSelectedElement: SelectElement;
  setNearbyPrompt: (prompt: NearbyPrompt | null) => void;
  markers?: MapMarker[];
}) => {
  // PIXI setup.
  const pixiApp = useApp();
  const convex = useConvex();
  const viewportRef = useRef<Viewport | undefined>();

  const humanTokenIdentifier =
    useQuery(api.world.userStatus, { worldId: props.worldId, userId: props.userId }) ?? null;
  const humanPlayerId = [...props.game.world.players.values()].find(
    (p) => p.human === humanTokenIdentifier,
  )?.id;

  const [ping, setPing] = useState<{ x: number; y: number; t: number } | null>(null);

  const moveTo = useSendInput(props.engineId, 'moveTo');
  const activeMovementKeyRef = useRef<string | null>(null);
  const keysDownRef = useRef(new Set<string>());
  const lastKeyboardMoveAtRef = useRef(0);
  const keyboardMoveTimerRef = useRef<number>();
  const optimisticPathRef = useRef<GridDestination[]>([]);
  const optimisticLocationRef = useRef<Location>();
  const optimisticFrameRef = useRef<number>();
  const lastOptimisticFrameAtRef = useRef<number>();
  const lastSentDestinationRef = useRef<SentDestination | null>(null);
  const latestGameStateRef = useRef<RuntimeGameState>();
  // 当前可按空格交互的最近目标（空间入口或作品），供键盘处理读取。
  const nearbyTargetRef = useRef<NearbyPrompt | null>(null);
  const nearbyKeyRef = useRef<string | null>(null);
  // 让 keydown 一次性监听器始终拿到最新的进入回调（props 每次渲染都会变）。
  const onEnterVenueInteriorRef = useRef(props.onEnterVenueInterior);
  onEnterVenueInteriorRef.current = props.onEnterVenueInterior;

  // Interaction for clicking on the world to navigate.
  const dragStart = useRef<{ screenX: number; screenY: number } | null>(null);
  const onMapPointerDown = (e: any) => {
    // https://pixijs.download/dev/docs/PIXI.FederatedPointerEvent.html
    dragStart.current = { screenX: e.screenX, screenY: e.screenY };
  };

  const [lastDestination, setLastDestination] = useState<{
    x: number;
    y: number;
    t: number;
  } | null>(null);
  const [optimisticHumanLocation, setOptimisticHumanLocation] = useState<Location>();
  const onMapPointerUp = async (e: any) => {
    if (dragStart.current) {
      const { screenX, screenY } = dragStart.current;
      dragStart.current = null;
      const [dx, dy] = [screenX - e.screenX, screenY - e.screenY];
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 10) {
        console.log(`Skipping navigation on drag event (${dist}px)`);
        props.onSetCameraFollow(false);
        return;
      }
    }
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const gameSpacePx = viewport.toWorld(e.screenX, e.screenY);
    const tileDim = props.game.worldMap.tileDim;
    const gameSpaceTiles = {
      x: gameSpacePx.x / tileDim,
      y: gameSpacePx.y / tileDim,
    };
    // 标定模式：把点击点换算成航拍源坐标交给标定面板，不移动角色。
    if (isMapTapCaptureActive()) {
      captureMapTap(
        (gameSpaceTiles.x / props.game.worldMap.width) * MAP_SOURCE_WIDTH,
        (gameSpaceTiles.y / props.game.worldMap.height) * MAP_SOURCE_HEIGHT,
      );
      return;
    }
    if (!humanPlayerId) {
      return;
    }
    const roundedTiles = {
      x: Math.floor(gameSpaceTiles.x),
      y: Math.floor(gameSpaceTiles.y),
    };
    const state = latestGameStateRef.current;
    if (!state || isMapDestinationBlocked(roundedTiles, state)) {
      return;
    }
    const now = Date.now();
    setLastDestination({ t: now, ...gameSpaceTiles });
    console.log(`Moving to ${JSON.stringify(roundedTiles)}`);
    // 本地立即规划路径并乐观移动，避免等待服务器 ~2-3s 的输入/步进/缓冲延迟（起步 lag）。
    const humanPlayer = state.game.world.players.get(humanPlayerId as never);
    const startLocation = humanPlayer ? playerLocation(humanPlayer) : undefined;
    const startTile = startLocation
      ? { x: Math.round(startLocation.x), y: Math.round(startLocation.y) }
      : null;
    optimisticPathRef.current = startTile
      ? findOptimisticGridPath(startTile, roundedTiles, state)
      : [];
    lastSentDestinationRef.current = { ...roundedTiles, t: now };
    optimisticLocationRef.current = startLocation;
    setOptimisticHumanLocation(startLocation);
    await toastOnError(moveTo({ playerId: humanPlayerId, destination: roundedTiles }));
  };
  const { width, height, tileDim } = props.game.worldMap;
  const players = [...props.game.world.players.values()];
  const worldWidthPx = width * tileDim;
  const worldHeightPx = height * tileDim;
  latestGameStateRef.current = {
    controlMode: props.controlMode,
    cameraFollow: props.cameraFollow,
    engineId: props.engineId,
    game: props.game,
    height: props.height,
    humanPlayerId,
    onSetCameraFollow: props.onSetCameraFollow,
    onToggleCameraFollow: props.onToggleCameraFollow,
    onToggleControlMode: props.onToggleControlMode,
    players,
    tileDim,
    width: props.width,
    worldHeightPx,
    worldWidthPx,
  };

  // 走近一个「空间」入口或一件「作品」时，发布提示让玩家可按空格查看详情/进入。
  // 取最近的单个目标，避免同时弹多个提示。
  useEffect(() => {
    const publish = (next: NearbyPrompt | null) => {
      const key = next ? `${next.kind}:${next.kind === 'venue' ? next.interiorId : next.id}` : null;
      if (key === nearbyKeyRef.current) return;
      nearbyKeyRef.current = key;
      nearbyTargetRef.current = next;
      props.setNearbyPrompt(next);
    };

    if (!humanPlayerId) {
      publish(null);
      return;
    }
    const humanPlayer = props.game.world.players.get(humanPlayerId);
    if (!humanPlayer) {
      publish(null);
      return;
    }

    const { width: mapWidth, height: mapHeight } = props.game.worldMap;
    const location = optimisticHumanLocation ?? playerLocation(humanPlayer);
    let nearest: NearbyPrompt | null = null;
    let nearestDistance = Infinity;

    for (const interior of VENUE_INTERIOR_MAPS) {
      const [sourceX, sourceY] = interior.entrance.exteriorSource;
      const entryX = (sourceX / MAP_SOURCE_WIDTH) * mapWidth;
      const entryY = (sourceY / MAP_SOURCE_HEIGHT) * mapHeight;
      const distance = Math.hypot(location.x - entryX, location.y - entryY);
      if (distance <= interior.entrance.radiusTiles && distance < nearestDistance) {
        nearestDistance = distance;
        nearest = { kind: 'venue', interiorId: interior.id, label: interior.venue };
      }
    }

    for (const installation of INSTALLATIONS) {
      const tileX = (installation.x / MAP_SOURCE_WIDTH) * mapWidth;
      const tileY = (installation.y / MAP_SOURCE_HEIGHT) * mapHeight;
      const distance = Math.hypot(location.x - tileX, location.y - tileY);
      if (distance <= INSTALLATION_PROMPT_RADIUS_TILES && distance < nearestDistance) {
        nearestDistance = distance;
        nearest = { kind: 'installation', id: installation.id, label: installation.title };
      }
    }

    publish(nearest);
  }, [
    humanPlayerId,
    optimisticHumanLocation,
    props.game,
    props.game.worldMap.height,
    props.game.worldMap.width,
    props.setNearbyPrompt,
  ]);

  // 卸载时清除提示。
  useEffect(() => {
    return () => props.setNearbyPrompt(null);
  }, [props.setNearbyPrompt]);

  useEffect(() => {
    const currentState = () => latestGameStateRef.current;
    const getHumanPlayer = () => {
      const state = currentState();
      return state?.humanPlayerId
        ? state.game.world.players.get(state.humanPlayerId as never)
        : undefined;
    };
    const publishOptimisticLocation = (location?: Location) => {
      optimisticLocationRef.current = location;
      setOptimisticHumanLocation(location);
    };
    const locationDistance = (a: Location, b: Location) => {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    };
    const sameDestination = (a: GridDestination | null | undefined, b: GridDestination) =>
      !!a && a.x === b.x && a.y === b.y;
    const clampCenter = (x: number, y: number) => {
      const state = currentState();
      const viewport = viewportRef.current;
      if (!viewport || !state) return;

      const halfWidth = viewport.worldScreenWidth / 2;
      const halfHeight = viewport.worldScreenHeight / 2;
      const minX = halfWidth;
      const maxX = state.worldWidthPx - halfWidth;
      const minY = halfHeight;
      const maxY = state.worldHeightPx - halfHeight;

      viewport.moveCenter(
        maxX < minX ? state.worldWidthPx / 2 : Math.min(Math.max(x, minX), maxX),
        maxY < minY ? state.worldHeightPx / 2 : Math.min(Math.max(y, minY), maxY),
      );
    };

    const setZoom = (factor: number) => {
      const state = currentState();
      const viewport = viewportRef.current;
      if (!viewport || !state) return;

      const minScale = viewportMinScale({
        screenHeight: state.height,
        screenWidth: state.width,
        worldHeight: state.worldHeightPx,
        worldWidth: state.worldWidthPx,
      });
      const nextScale = Math.min(3, Math.max(minScale, viewport.scaled * factor));
      viewport.setZoom(nextScale, true);
      clampCenter(viewport.center.x, viewport.center.y);
    };
    const followLocation = (location: Pick<Location, 'x' | 'y'>) => {
      const state = currentState();
      if (!state?.cameraFollow || state.controlMode !== 'player') return;

      clampCenter(
        location.x * state.tileDim + state.tileDim / 2,
        location.y * state.tileDim + state.tileDim / 2,
      );
    };

    const toggleFullscreen = async () => {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    };
    const isDestinationBlocked = (destination: { x: number; y: number }) => {
      const state = currentState();
      if (!state) return true;
      return isMapDestinationBlocked(destination, state);
    };
    const sendHumanMove = (dx: number, dy: number) => {
      const state = currentState();
      if (!state?.humanPlayerId) return;

      const humanPlayer = getHumanPlayer();
      if (!humanPlayer) return;
      if (optimisticPathRef.current.length >= MAX_OPTIMISTIC_PATH_LENGTH) return;

      const now = Date.now();
      const optimisticLocation = optimisticLocationRef.current;
      const queuedDestination =
        optimisticPathRef.current[optimisticPathRef.current.length - 1] ?? null;
      const origin = queuedDestination ?? {
        x: Math.round(optimisticLocation?.x ?? humanPlayer.position.x),
        y: Math.round(optimisticLocation?.y ?? humanPlayer.position.y),
      };
      const destination = {
        x: Math.max(0, Math.min(state.game.worldMap.width - 1, origin.x + dx)),
        y: Math.max(0, Math.min(state.game.worldMap.height - 1, origin.y + dy)),
      };

      if (sameDestination(lastSentDestinationRef.current, destination)) {
        return;
      }
      if (destination.x === origin.x && destination.y === origin.y) {
        return;
      }
      if (isDestinationBlocked(destination)) {
        return;
      }

      lastSentDestinationRef.current = { ...destination, t: now };
      optimisticPathRef.current = [...optimisticPathRef.current, destination];
      setLastDestination({ ...destination, t: now });
      void convex
        .mutation(api.world.sendWorldInput, {
          engineId: state.engineId,
          name: 'moveTo',
          args: { playerId: humanPlayer.id, destination },
        })
        .catch((error: unknown) => {
          console.error('Keyboard movement failed', error);
          if (sameDestination(lastSentDestinationRef.current, destination)) {
            lastSentDestinationRef.current = null;
          }
          optimisticPathRef.current = optimisticPathRef.current.filter(
            (queued) => !sameDestination(queued, destination),
          );
        });
    };
    const currentMovementVector = () => {
      const activeKey = activeMovementKeyRef.current;
      if (activeKey && keysDownRef.current.has(activeKey)) {
        return movementVector(activeKey);
      }
      for (const key of keysDownRef.current) {
        const vector = movementVector(key);
        if (vector) {
          activeMovementKeyRef.current = key;
          return vector;
        }
      }
      activeMovementKeyRef.current = null;
      return null;
    };
    const tickOptimisticPlayer = (performanceNow: number) => {
      const state = currentState();
      const humanPlayer = getHumanPlayer();
      if (!state || !humanPlayer) {
        optimisticPathRef.current = [];
        lastSentDestinationRef.current = null;
        publishOptimisticLocation(undefined);
        optimisticFrameRef.current = window.requestAnimationFrame(tickOptimisticPlayer);
        return;
      }

      const serverLocation = playerLocation(humanPlayer);
      const previousLocation = optimisticLocationRef.current ?? serverLocation;
      const previousFrameAt = lastOptimisticFrameAtRef.current ?? performanceNow;
      const elapsedSeconds = Math.min((performanceNow - previousFrameAt) / 1000, 0.05);
      const target = optimisticPathRef.current[0];
      let nextLocation = previousLocation;

      if (target && elapsedSeconds > 0) {
        const remainingX = target.x - previousLocation.x;
        const remainingY = target.y - previousLocation.y;
        const remainingDistance = Math.sqrt(remainingX * remainingX + remainingY * remainingY);
        const stepDistance = LOCAL_PLAYER_SPEED_TILES_PER_SECOND * elapsedSeconds;
        const facing =
          Math.abs(remainingX) >= Math.abs(remainingY)
            ? { dx: Math.sign(remainingX), dy: 0 }
            : { dx: 0, dy: Math.sign(remainingY) };

        if (remainingDistance <= stepDistance || remainingDistance < 0.001) {
          optimisticPathRef.current = optimisticPathRef.current.slice(1);
          nextLocation = {
            x: target.x,
            y: target.y,
            dx: facing.dx || previousLocation.dx,
            dy: facing.dy || previousLocation.dy,
            speed: optimisticPathRef.current.length > 0 ? LOCAL_PLAYER_SPEED_TILES_PER_SECOND : 0,
          };
        } else {
          const moveRatio = stepDistance / remainingDistance;
          nextLocation = {
            x: previousLocation.x + remainingX * moveRatio,
            y: previousLocation.y + remainingY * moveRatio,
            dx: facing.dx,
            dy: facing.dy,
            speed: LOCAL_PLAYER_SPEED_TILES_PER_SECOND,
          };
        }
      } else {
        // 点击移动（以及任何没有本地预测的情况）：把渲染交还给 historical 平滑插值，
        // 与 NPC 完全一致。optimistic 的 lerp/snap settle 只用于收尾键盘预测；
        // 用在点击移动上会变成 0.08 慢 lerp + 0.75 snap 跳跃，正是「卡顿卡顿」的来源。
        if (
          optimisticLocationRef.current === undefined &&
          optimisticPathRef.current.length === 0 &&
          !lastSentDestinationRef.current
        ) {
          publishOptimisticLocation(undefined);
          lastOptimisticFrameAtRef.current = performanceNow;
          optimisticFrameRef.current = window.requestAnimationFrame(tickOptimisticPlayer);
          return;
        }
        const pendingDestination = lastSentDestinationRef.current;
        const serverToPending = pendingDestination
          ? Math.sqrt(
              (serverLocation.x - pendingDestination.x) ** 2 +
                (serverLocation.y - pendingDestination.y) ** 2,
            )
          : 0;
        if (pendingDestination && serverToPending <= SERVER_SETTLE_DISTANCE_TILES) {
          lastSentDestinationRef.current = null;
        }
        const distanceToServer = locationDistance(previousLocation, serverLocation);
        if (
          pendingDestination &&
          serverToPending > SERVER_SETTLE_DISTANCE_TILES &&
          // 服务器仍在赶来（移动中），或仍处于起步前的宽限期：冻结在本地终点等它追上，
          // 避免本地预测（领先 ~2-3s）走完后回退跳变。任意长度路径都靠 speed>0 兜住。
          (serverLocation.speed > 0 || Date.now() - pendingDestination.t < SERVER_CATCHUP_GRACE_MS)
        ) {
          nextLocation = { ...previousLocation, speed: 0 };
        } else if (distanceToServer > SERVER_SNAP_DISTANCE_TILES) {
          nextLocation = serverLocation;
        } else if (distanceToServer > SERVER_SETTLE_DISTANCE_TILES) {
          nextLocation = {
            x: previousLocation.x + (serverLocation.x - previousLocation.x) * SERVER_SETTLE_LERP,
            y: previousLocation.y + (serverLocation.y - previousLocation.y) * SERVER_SETTLE_LERP,
            dx: serverLocation.dx,
            dy: serverLocation.dy,
            // 保留服务器速度: 点击寻路时服务器在动(speed>0)就播放走路动画, 到站(speed=0)才停。
            speed: serverLocation.speed,
          };
        } else {
          // 稳定态跟随服务器位置, 连同其速度一起 (此前硬写 0 导致点击移动不播放走路动画)。
          nextLocation = serverLocation;
        }
      }

      lastOptimisticFrameAtRef.current = performanceNow;
      publishOptimisticLocation(nextLocation);
      followLocation(nextLocation);
      optimisticFrameRef.current = window.requestAnimationFrame(tickOptimisticPlayer);
    };
    const tickHeldMovement = () => {
      if (currentState()?.controlMode !== 'player') return;

      const vector = currentMovementVector();
      if (!vector) return;

      const now = Date.now();
      if (now - lastKeyboardMoveAtRef.current < KEYBOARD_MOVE_REPEAT_MS) return;

      lastKeyboardMoveAtRef.current = now;
      sendHumanMove(vector.dx, vector.dy);
    };
    const startHeldMovementLoop = () => {
      if (keyboardMoveTimerRef.current !== undefined) return;

      keyboardMoveTimerRef.current = window.setInterval(tickHeldMovement, KEYBOARD_MOVE_REPEAT_MS);
    };
    const stopHeldMovementLoopIfIdle = () => {
      if (keysDownRef.current.size > 0 || keyboardMoveTimerRef.current === undefined) return;

      window.clearInterval(keyboardMoveTimerRef.current);
      keyboardMoveTimerRef.current = undefined;
      activeMovementKeyRef.current = null;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isKeyboardInputTarget(event.target)) return;

      const viewport = viewportRef.current;
      if (!viewport) return;
      const state = currentState();
      if (!state) return;

      const key = event.key.toLowerCase();
      const baseStep = Math.max(
        48,
        Math.min(viewport.worldScreenWidth, viewport.worldScreenHeight) * 0.12,
      );
      const step = event.shiftKey ? baseStep * 2 : baseStep;
      let dx = 0;
      let dy = 0;

      if (key === 'arrowleft' || key === 'a') dx = -step;
      if (key === 'arrowright' || key === 'd') dx = step;
      if (key === 'arrowup' || key === 'w') dy = -step;
      if (key === 'arrowdown' || key === 's') dy = step;

      if (dx || dy) {
        event.preventDefault();
        if (state.controlMode === 'camera') {
          state.onSetCameraFollow(false);
          clampCenter(viewport.center.x + dx, viewport.center.y + dy);
        } else {
          const wasIdle = keysDownRef.current.size === 0;
          keysDownRef.current.add(key);
          activeMovementKeyRef.current = key;
          if (wasIdle) {
            lastKeyboardMoveAtRef.current = 0;
          }
          startHeldMovementLoop();
          tickHeldMovement();
        }
        return;
      }

      if (key === ' ' || event.code === 'Space') {
        const target = nearbyTargetRef.current;
        if (target) {
          event.preventDefault();
          if (target.kind === 'venue') {
            onEnterVenueInteriorRef.current?.(target.interiorId);
          } else {
            selectInstallationOnMap(target.id);
          }
        }
        return;
      }

      if (key === 'c') {
        event.preventDefault();
        state.onToggleControlMode();
        return;
      }

      if (key === 'v') {
        event.preventDefault();
        state.onToggleCameraFollow();
        return;
      }

      if (key === '+' || key === '=') {
        event.preventDefault();
        setZoom(1.12);
        return;
      }

      if (key === '-' || key === '_') {
        event.preventDefault();
        setZoom(0.88);
        return;
      }

      if (key === '0') {
        event.preventDefault();
        viewport.animate({
          position: new PIXI.Point(state.worldWidthPx / 2, state.worldHeightPx / 2),
          scale: viewportMinScale({
            screenHeight: state.height,
            screenWidth: state.width,
            worldHeight: state.worldHeightPx,
            worldWidth: state.worldWidthPx,
          }),
        });
        state.onSetCameraFollow(false);
        return;
      }

      if (key === 'f') {
        event.preventDefault();
        void toggleFullscreen();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!MOVEMENT_KEYS.has(key)) return;

      keysDownRef.current.delete(key);
      if (activeMovementKeyRef.current === key) {
        activeMovementKeyRef.current = null;
      }
      stopHeldMovementLoopIfIdle();
    };

    optimisticFrameRef.current = window.requestAnimationFrame(tickOptimisticPlayer);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
      if (keyboardMoveTimerRef.current !== undefined) {
        window.clearInterval(keyboardMoveTimerRef.current);
        keyboardMoveTimerRef.current = undefined;
      }
      if (optimisticFrameRef.current !== undefined) {
        window.cancelAnimationFrame(optimisticFrameRef.current);
        optimisticFrameRef.current = undefined;
      }
      keysDownRef.current.clear();
      optimisticPathRef.current = [];
      lastSentDestinationRef.current = null;
    };
  }, [convex]);

  // Zoom on the user’s avatar when it is created
  useEffect(() => {
    if (!viewportRef.current || humanPlayerId === undefined) return;

    const humanPlayer = props.game.world.players.get(humanPlayerId)!;
    viewportRef.current.animate({
      position: new PIXI.Point(
        humanPlayer.position.x * tileDim + tileDim / 2,
        humanPlayer.position.y * tileDim + tileDim / 2,
      ),
      scale: 1.5,
    });
  }, [humanPlayerId]);

  // Let the bottom Timeline focus the camera on a venue and drop a ping marker.
  useEffect(() => {
    setMapFocusHandler((sourceX, sourceY) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const x = (sourceX / MAP_SOURCE_WIDTH) * worldWidthPx;
      const y = (sourceY / MAP_SOURCE_HEIGHT) * worldHeightPx;
      props.onSetCameraFollow(false); // hold the framing on the venue
      const minScale = viewportMinScale({
        screenHeight: props.height,
        screenWidth: props.width,
        worldHeight: worldHeightPx,
        worldWidth: worldWidthPx,
      });
      viewport.animate({
        position: new PIXI.Point(x, y),
        scale: Math.max(minScale, 1.3),
        time: 700,
        ease: 'easeInOutCubic',
      });
      setPing({ x, y, t: Date.now() });
    });
    // Focus the camera on a resident picked from the sidebar (tile coordinates).
    setMapFocusTileHandler((tileX, tileY) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const x = tileX * tileDim + tileDim / 2;
      const y = tileY * tileDim + tileDim / 2;
      props.onSetCameraFollow(false);
      const minScale = viewportMinScale({
        screenHeight: props.height,
        screenWidth: props.width,
        worldHeight: worldHeightPx,
        worldWidth: worldWidthPx,
      });
      viewport.animate({
        position: new PIXI.Point(x, y),
        scale: Math.max(minScale, 1.6),
        time: 700,
        ease: 'easeInOutCubic',
      });
      setPing({ x, y, t: Date.now() });
    });
    return () => {
      setMapFocusHandler(null);
      setMapFocusTileHandler(null);
    };
  }, [worldWidthPx, worldHeightPx, tileDim, props.onSetCameraFollow, props.width, props.height]);

  useEffect(() => {
    if (!ping) return;
    const id = window.setTimeout(() => setPing(null), 2500);
    return () => window.clearTimeout(id);
  }, [ping]);

  return (
    <PixiViewport
      app={pixiApp}
      screenWidth={props.width}
      screenHeight={props.height}
      worldWidth={width * tileDim}
      worldHeight={height * tileDim}
      viewportRef={viewportRef}
    >
      <PixiStaticMap
        key={`map-${props.markers?.length ?? 0}`}
        map={props.game.worldMap}
        markers={props.markers}
        onpointerup={onMapPointerUp}
        onpointerdown={onMapPointerDown}
      />
      {SHOW_DEV_TOOLS && props.showCollisionOverlay && (
        <DebugCollisionOverlay map={props.game.worldMap} />
      )}
      {ping && <VenuePing x={ping.x} y={ping.y} t={ping.t} tileDim={tileDim} />}
      {lastDestination && <PositionIndicator destination={lastDestination} tileDim={tileDim} />}
      {players.map((p) => (
        <Player
          key={`player-${p.id}`}
          game={props.game}
          player={p}
          isViewer={p.id === humanPlayerId}
          optimisticLocation={p.id === humanPlayerId ? optimisticHumanLocation : undefined}
          onClick={props.setSelectedElement}
          historicalTime={props.historicalTime}
        />
      ))}
    </PixiViewport>
  );
};
export default PixiGame;
