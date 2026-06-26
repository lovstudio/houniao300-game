import * as PIXI from 'pixi.js';
import { useApp } from '@pixi/react';
import { Player, SelectElement } from './Player.tsx';
import { useEffect, useRef, useState } from 'react';
import { PixiStaticMap } from './PixiStaticMap.tsx';
import PixiViewport, { viewportMinScale } from './PixiViewport.tsx';
import { Viewport } from 'pixi-viewport';
import { Id } from '../../convex/_generated/dataModel';
import { useConvex, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api.js';
import { useSendInput } from '../hooks/sendInput.ts';
import { toastOnError } from '../toasts.ts';
import { DebugPath } from './DebugPath.tsx';
import { DebugCollisionOverlay } from './DebugCollisionOverlay.tsx';
import { PositionIndicator } from './PositionIndicator.tsx';
import { VenuePing } from './VenuePing.tsx';
import { setMapFocusHandler, setMapFocusTileHandler } from '../lib/mapFocus.ts';
import {
  sandCityGeometryControlsCollision,
  tilePositionBlockedBySolidGeometry,
} from '../../data/sandCityGeometry.ts';
import type { ControlMode } from './Game.tsx';
import { SHOW_DEBUG_UI, SHOW_DEV_TOOLS } from '../lib/debugSettings.ts';
import { ServerGame } from '../hooks/serverGame.ts';
import { COLLISION_THRESHOLD } from '../../convex/constants.ts';
import { Location, playerLocation } from '../../convex/aiTown/location.ts';

const MAP_SOURCE_WIDTH = 1703;
const MAP_SOURCE_HEIGHT = 1279;
const KEYBOARD_MOVE_REPEAT_MS = 180;
const LOCAL_PLAYER_SPEED_TILES_PER_SECOND = 4;
const MAX_OPTIMISTIC_PATH_LENGTH = 2;
const SERVER_SNAP_DISTANCE_TILES = 0.75;
const SERVER_SETTLE_DISTANCE_TILES = 0.05;
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
  if (
    sandCityGeometryControlsCollision(state.game.worldMap.width, state.game.worldMap.height)
  ) {
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
  showCollisionOverlay: boolean;
  setSelectedElement: SelectElement;
}) => {
  // PIXI setup.
  const pixiApp = useApp();
  const convex = useConvex();
  const viewportRef = useRef<Viewport | undefined>();

  const humanTokenIdentifier = useQuery(api.world.userStatus, { worldId: props.worldId }) ?? null;
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
    if (!humanPlayerId) {
      return;
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
    const roundedTiles = {
      x: Math.floor(gameSpaceTiles.x),
      y: Math.floor(gameSpaceTiles.y),
    };
    const state = latestGameStateRef.current;
    if (!state || isMapDestinationBlocked(roundedTiles, state)) {
      return;
    }
    setLastDestination({ t: Date.now(), ...gameSpaceTiles });
    console.log(`Moving to ${JSON.stringify(roundedTiles)}`);
    optimisticPathRef.current = [];
    lastSentDestinationRef.current = null;
    optimisticLocationRef.current = undefined;
    setOptimisticHumanLocation(undefined);
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
          Date.now() - pendingDestination.t < SERVER_CATCHUP_GRACE_MS &&
          serverToPending > SERVER_SETTLE_DISTANCE_TILES
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
            speed: 0,
          };
        } else {
          nextLocation = { ...serverLocation, speed: 0 };
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
        map={props.game.worldMap}
        onpointerup={onMapPointerUp}
        onpointerdown={onMapPointerDown}
      />
      {SHOW_DEV_TOOLS && props.showCollisionOverlay && (
        <DebugCollisionOverlay map={props.game.worldMap} />
      )}
      {ping && <VenuePing x={ping.x} y={ping.y} t={ping.t} tileDim={tileDim} />}
      {players.map(
        (p) =>
          // Only show the path for the human player in non-debug mode.
          (SHOW_DEBUG_UI || p.id === humanPlayerId) && (
            <DebugPath key={`path-${p.id}`} player={p} tileDim={tileDim} />
          ),
      )}
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
