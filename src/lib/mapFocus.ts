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

// Focus the camera on a resident, addressed in tile coordinates (player.position).
export type MapFocusTileListener = (tileX: number, tileY: number) => void;

let tileListener: MapFocusTileListener | null = null;

export function setMapFocusTileHandler(fn: MapFocusTileListener | null) {
  tileListener = fn;
}

export function focusMapTile(tileX: number, tileY: number) {
  tileListener?.(tileX, tileY);
}

// Calibration capture: while a handler is registered, map taps are routed here (in
// aerial-source coords) instead of moving the player — used by the GPS calibration tool.
export type MapTapCaptureListener = (sourceX: number, sourceY: number) => void;

let tapCaptureListener: MapTapCaptureListener | null = null;

export function setMapTapCaptureHandler(fn: MapTapCaptureListener | null) {
  tapCaptureListener = fn;
}

export function isMapTapCaptureActive(): boolean {
  return tapCaptureListener !== null;
}

export function captureMapTap(sourceX: number, sourceY: number): boolean {
  if (!tapCaptureListener) return false;
  tapCaptureListener(sourceX, sourceY);
  return true;
}

// Reverse direction: a venue marker on the map was clicked; open its schedule in the sidebar.
export type VenueSelectListener = (venue: string) => void;

let venueSelectListener: VenueSelectListener | null = null;

export function setVenueSelectHandler(fn: VenueSelectListener | null) {
  venueSelectListener = fn;
}

export function selectVenueOnMap(venue: string) {
  venueSelectListener?.(venue);
}

// Reverse direction: an installation marker on the map was clicked; open its detail.
export type InstallationSelectListener = (installationId: string) => void;

let installationSelectListener: InstallationSelectListener | null = null;

export function setInstallationSelectHandler(fn: InstallationSelectListener | null) {
  installationSelectListener = fn;
}

export function selectInstallationOnMap(installationId: string) {
  installationSelectListener?.(installationId);
}
