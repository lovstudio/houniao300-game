// Based on https://codepen.io/inlet/pen/yLVmPWv.
// Copyright (c) 2018 Patrick Brouwer, distributed under the MIT license.

import { PixiComponent, useApp } from '@pixi/react';
import { Viewport } from 'pixi-viewport';
import { Application } from 'pixi.js';
import { MutableRefObject, ReactNode } from 'react';

export type ViewportProps = {
  app: Application;
  viewportRef?: MutableRefObject<Viewport | undefined>;

  screenWidth: number;
  screenHeight: number;
  worldWidth: number;
  worldHeight: number;
  children?: ReactNode;
};

export function viewportMinScale(
  props: Pick<ViewportProps, 'screenWidth' | 'screenHeight' | 'worldWidth' | 'worldHeight'>,
) {
  // cover：取宽高比例里的较大者，确保地图铺满视口（较长的一轴裁到屏幕外、可平移），
  // 而不是 contain（取较小者）那样四周留白。
  const coverWorldScale = Math.max(
    props.screenWidth / props.worldWidth,
    props.screenHeight / props.worldHeight,
  );
  return Math.min(3, Math.max(0.05, coverWorldScale));
}

// https://davidfig.github.io/pixi-viewport/jsdoc/Viewport.html
export default PixiComponent('Viewport', {
  create(props: ViewportProps) {
    const { app, children, viewportRef, ...viewportProps } = props;
    const minScale = viewportMinScale(props);
    // 移动端窄屏：初始按 minScale 铺满，避免强制 1.15× 只看到一小块地图；桌面端保持近景。
    const initialScale =
      props.screenWidth < 768 ? minScale : Math.min(3, Math.max(minScale, 1.15));
    const viewport = new Viewport({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      events: app.renderer.events,
      passiveWheel: false,
      ...viewportProps,
    });
    if (viewportRef) {
      viewportRef.current = viewport;
    }
    // Activate plugins
    viewport
      .drag()
      .pinch({})
      .wheel()
      .decelerate()
      .clamp({ direction: 'all', underflow: 'center' })
      .clampZoom({
        minScale,
        maxScale: 3.0,
      })
      .setZoom(initialScale)
      .moveCenter(props.worldWidth / 2, props.worldHeight / 2);
    return viewport;
  },
  applyProps(viewport, oldProps: any, newProps: any) {
    if (
      oldProps.screenWidth !== newProps.screenWidth ||
      oldProps.screenHeight !== newProps.screenHeight ||
      oldProps.worldWidth !== newProps.worldWidth ||
      oldProps.worldHeight !== newProps.worldHeight
    ) {
      viewport.resize(
        newProps.screenWidth,
        newProps.screenHeight,
        newProps.worldWidth,
        newProps.worldHeight,
      );
      const minScale = viewportMinScale(newProps);
      viewport.clampZoom({ minScale, maxScale: 3.0 });
      if (viewport.scaled < minScale) {
        viewport.setZoom(minScale, true);
      }
    }
    Object.keys(newProps).forEach((p) => {
      if (
        p !== 'app' &&
        p !== 'viewportRef' &&
        p !== 'children' &&
        p !== 'screenWidth' &&
        p !== 'screenHeight' &&
        p !== 'worldWidth' &&
        p !== 'worldHeight' &&
        oldProps[p] !== newProps[p]
      ) {
        // @ts-expect-error Ignoring TypeScript here
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        viewport[p] = newProps[p];
      }
    });
  },
});
