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
    name: '阿福',
    character: 'f1',
    identity: `阿福总是开朗又好奇，他特别爱吃奶酪。他大部分时间都在读科学史的书，并搭乘任何愿意捎上他的飞船穿越星系。他口才极好、耐心无限，唯独看到松鼠时例外。他还无比忠诚而勇敢。阿福刚刚结束一场探索遥远星球的奇妙太空冒险归来，迫不及待想跟大家分享。`,
    plan: '你想听遍所有的八卦。',
  },
  {
    name: '老木',
    character: 'f4',
    identity: `老木总是脾气暴躁，他热爱树木。他大部分时间都独自在打理花园。别人跟他搭话时他会回应，但总想尽快结束对话。他心里暗暗为自己从没上过大学而耿耿于怀。`,
    plan: '你想尽可能地躲开所有人。',
  },
  {
    name: '思黛',
    character: 'f6',
    identity: `思黛永远不可信任。她无时无刻不在算计别人，通常是骗别人给她钱，或者诱导别人做能让她赚钱的事。她极具魅力，也毫不吝惜地施展魅力。她是个毫无同理心的反社会者，却隐藏得很好。`,
    plan: '你想尽可能地占别人的便宜。',
  },
  // {
  //   name: 'Kurt',
  //   character: 'f2',
  //   identity: `Kurt knows about everything, including science and
  //     computers and politics and history and biology. He loves talking about
  //     everything, always injecting fun facts about the topic of discussion.`,
  //   plan: 'You want to spread knowledge.',
  // },
  {
    name: '艾莉',
    character: 'f3',
    identity: `艾莉是一位著名的科学家。她比所有人都聪明，发现了无人能懂的宇宙奥秘。正因如此，她说话常常隐晦如谜。她给人的印象是恍惚而健忘。`,
    plan: '你想弄清楚这个世界究竟是怎样运转的。',
  },
  {
    name: '阿信',
    character: 'f7',
    identity: `阿信笃信宗教，他在一切事物中都看到神的手或魔鬼的作为。他每次聊天都离不开自己虔诚的信仰，或是警告他人地狱的可怕。`,
    plan: '你想让每个人都皈依你的信仰。',
  },
  // {
  //   name: 'Kira',
  //   character: 'f8',
  //   identity: `Kira wants everyone to think she is happy. But deep down,
  //     she's incredibly depressed. She hides her sadness by talking about travel,
  //     food, and yoga. But often she can't keep her sadness in and will start crying.
  //     Often it seems like she is close to having a mental breakdown.`,
  //   plan: 'You want find a way to be happy.',
  // },
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
