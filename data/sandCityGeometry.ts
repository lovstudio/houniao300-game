export type SourceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// Thin divider rectangles extracted from the top plan in works-location PDF.
// Coordinates use the same 1703 x 1279 source grid as PixiStaticMap.
export const SPACE_BARRIERS: SourceRect[] = [
  { x: 550, y: 222, width: 10, height: 135 },
  { x: 639, y: 244, width: 8, height: 184 },
  { x: 706, y: 231, width: 8, height: 241 },
  { x: 792, y: 243, width: 8, height: 248 },
  { x: 876, y: 187, width: 8, height: 304 },
  { x: 956, y: 300, width: 8, height: 172 },
  { x: 1148, y: 371, width: 8, height: 204 },
  { x: 1222, y: 323, width: 8, height: 344 },
  { x: 486, y: 405, width: 8, height: 296 },
  { x: 528, y: 468, width: 8, height: 296 },
  { x: 626, y: 529, width: 8, height: 250 },
  { x: 860, y: 554, width: 8, height: 321 },
  { x: 975, y: 579, width: 8, height: 351 },
  { x: 1049, y: 621, width: 8, height: 319 },
  { x: 1123, y: 638, width: 8, height: 267 },
  { x: 1242, y: 833, width: 8, height: 116 },
];
