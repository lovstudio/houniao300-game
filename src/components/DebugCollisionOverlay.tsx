import { Graphics } from '@pixi/react';
import { Graphics as PixiGraphics } from 'pixi.js';
import { useCallback } from 'react';
import { WorldMap } from '../../convex/aiTown/worldMap';
import { tilePositionBlockedBySolidGeometry } from '../../data/sandCityGeometry.ts';

function objectTileBlocked(map: WorldMap, x: number, y: number) {
  return map.objectTiles.some((layer) => layer[x]?.[y] !== -1);
}

export function DebugCollisionOverlay({ map }: { map: WorldMap }) {
  const draw = useCallback(
    (g: PixiGraphics) => {
      g.clear();
      for (let x = 0; x < map.width; x++) {
        for (let y = 0; y < map.height; y++) {
          const objectBlocked = objectTileBlocked(map, x, y);
          const geometryBlocked = tilePositionBlockedBySolidGeometry(
            { x, y },
            map.width,
            map.height,
          );
          if (!objectBlocked && !geometryBlocked) continue;

          const both = objectBlocked && geometryBlocked;
          const color = both ? 0xff4d3d : geometryBlocked ? 0xffc145 : 0x4fb7ff;
          const alpha = both ? 0.38 : 0.28;
          const px = x * map.tileDim;
          const py = y * map.tileDim;

          g.beginFill(color, alpha);
          g.drawRect(px, py, map.tileDim, map.tileDim);
          g.endFill();

          g.lineStyle(1, color, both ? 0.72 : 0.55);
          g.drawRect(px + 0.5, py + 0.5, map.tileDim - 1, map.tileDim - 1);
        }
      }
    },
    [map],
  );

  return <Graphics draw={draw} eventMode="none" />;
}
