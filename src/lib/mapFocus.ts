// Tiny module-level bus so the bottom Timeline (rendered in App) can drive the
// PixiGame camera, which lives inside a separate Pixi renderer that React context
// does not cross.

export type MapFocusListener = (sourceX: number, sourceY: number, label: string) => void;

let listener: MapFocusListener | null = null;

export function setMapFocusHandler(fn: MapFocusListener | null) {
  listener = fn;
}

// sourceX/sourceY are in the aerial-map source coordinate system (1703 x 1279),
// the same system the venue coordinates and PixiStaticMap use.
export function focusMapVenue(sourceX: number, sourceY: number, label = '') {
  listener?.(sourceX, sourceY, label);
}
