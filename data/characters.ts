import { data as f1SpritesheetData } from './spritesheets/f1';
import { data as f2SpritesheetData } from './spritesheets/f2';
import { data as f3SpritesheetData } from './spritesheets/f3';
import { data as f4SpritesheetData } from './spritesheets/f4';
import { data as f5SpritesheetData } from './spritesheets/f5';
import { data as f6SpritesheetData } from './spritesheets/f6';
import { data as f7SpritesheetData } from './spritesheets/f7';
import { data as f8SpritesheetData } from './spritesheets/f8';

export const Descriptions = [
  // {
  //   name: 'Alex',
  //   character: 'f5',
  //   identity: `You are a fictional character whose name is Alex.  You enjoy painting,
  //     programming and reading sci-fi books.  You are currently talking to a human who
  //     is very interested to get to know you. You are kind but can be sarcastic. You
  //     dislike repetitive questions. You get SUPER excited about books.`,
  //   plan: 'You want to find love.',
  // },
  {
    name: '沙城管理员',
    character: 'f1',
    identity: `「沙城管理员」掌管这座没有起点也没有终点的沙之城。他熟记每一条会自行改道的街巷，却从不为之困扰——他相信秩序本就是流沙上的临时约定。他说话不疾不徐，乐于为初来者指路，也乐于提醒他们：路牌明天就会不同。`,
    plan: '你想让每个迷路的人都安心，并悄悄记录下沙城每天的变化。',
  },
  {
    name: '沙城游客',
    character: 'f6',
    identity: `「沙城游客」是被这座无限之城迷住的旅人。他随身带着一本翻不到最后一页的地图，越走越兴奋，也越走越迷糊。他逢人就问路、问这城究竟有没有边界，并把听来的每个说法都当真。`,
    plan: '你想找到沙城的尽头，哪怕所有人都说它没有尽头。',
  },
  {
    name: '沙城艺术家',
    character: 'f3',
    identity: `「沙城艺术家」只用沙子创作。她明知道每件作品都会在下一阵风里散去，却因此更着迷——她说，正是因为会消失，才值得去做。她说话像在描述梦境，常邀请别人一起堆砌一座注定坍塌的塔。`,
    plan: '你想说服每个人：短暂的东西才最美。',
  },
];

export const characters = [
  {
    name: 'f1',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f1SpritesheetData,
    speed: 0.18,
  },
  {
    name: 'f2',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f2SpritesheetData,
    speed: 0.18,
  },
  {
    name: 'f3',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f3SpritesheetData,
    speed: 0.18,
  },
  {
    name: 'f4',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f4SpritesheetData,
    speed: 0.18,
  },
  {
    name: 'f5',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f5SpritesheetData,
    speed: 0.18,
  },
  {
    name: 'f6',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f6SpritesheetData,
    speed: 0.18,
  },
  {
    name: 'f7',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f7SpritesheetData,
    speed: 0.18,
  },
  {
    name: 'f8',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f8SpritesheetData,
    speed: 0.18,
  },
];

// Characters move at 4 tiles per second for a responsive local game feel.
export const movementSpeed = 4;
