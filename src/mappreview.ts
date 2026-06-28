// Standalone preview of the procedural sand-city map, with no Convex backend.
// Renders drawSandCityModel at the real source resolution (1703x1279).
import * as PIXI from 'pixi.js';
import { drawSandCityModel } from './components/PixiStaticMap';
import { INSTALLATIONS } from '../data/installations';

const WIDTH = 1703;
const HEIGHT = 1279;

const app = new PIXI.Application({
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: 0xd8c194,
  antialias: true,
  resolution: 1,
});

document.getElementById('wrap')!.appendChild(app.view as HTMLCanvasElement);

const container = new PIXI.Container();
drawSandCityModel(container, WIDTH, HEIGHT, INSTALLATIONS);
app.stage.addChild(container);
