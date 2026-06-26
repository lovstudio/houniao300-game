export type InstallationZone =
  | '巡游花车停放处'
  | '候鸟中心'
  | '一级城墙'
  | '伏园'
  | '沙城中区'
  | '时间广场'
  | '候鸟黑客松'
  | '鸟其林周边'
  | '公路复古艺术展区'
  | '300.梯威'
  | '二级城墙';

export type Installation = {
  id: string;
  artist: string;
  title: string;
  zone: InstallationZone;
  x: number;
  y: number;
  note?: string;
};

export const INSTALLATION_SOURCE = '作品点位（转曲）.pdf';

// Coordinates are manually aligned to the current 1703 x 1279 sand-city source grid
// from the numbered markers in the works-location PDF.
export const INSTALLATIONS: Installation[] = [
  {
    id: 'A1',
    artist: '张晓柳',
    title: '意式柴火披萨「灵菇萨」·焰海迁徙',
    zone: '巡游花车停放处',
    x: 285,
    y: 112,
  },
  {
    id: 'A2',
    artist: '中国美术学院艺术工程',
    title: '舟周而周',
    zone: '巡游花车停放处',
    x: 350,
    y: 108,
  },
  { id: 'A3', artist: '艺奇奇', title: '异想巴士', zone: '巡游花车停放处', x: 306, y: 152 },
  {
    id: 'A4',
    artist: '西美公共拓展计划-姚浩澜 TOP30、朱晟晟、刘钰源、张云哲',
    title: '逆骨机械，在陶醉与惊醒之间!',
    zone: '巡游花车停放处',
    x: 365,
    y: 154,
  },
  {
    id: 'A5',
    artist: '万偶煅',
    title: '森林乐队、马上疯猴、废土战车',
    zone: '巡游花车停放处',
    x: 430,
    y: 150,
  },
  {
    id: 'A6',
    artist: '牛啤堂',
    title: '精酿啤酒过客酒吧复活300小时',
    zone: '巡游花车停放处',
    x: 278,
    y: 198,
  },
  { id: 'A7', artist: 'CRAZY GRACE', title: 'CRAZY GRACE', zone: '巡游花车停放处', x: 344, y: 198 },
  {
    id: 'A8',
    artist: '大大大玩具',
    title: '调皮牛、羞羞的钱袋、浴缸鹿车',
    zone: '巡游花车停放处',
    x: 410,
    y: 198,
  },

  { id: 'B1', artist: '流动的画布', title: '流动的画布', zone: '候鸟中心', x: 178, y: 178 },
  {
    id: 'B2',
    artist: '罗马湖人',
    title: '所有道歉 la sante mentale eclatee',
    zone: '候鸟中心',
    x: 134,
    y: 220,
  },
  { id: 'B3', artist: 'AmilGer x 赛欣', title: '共同栖居', zone: '候鸟中心', x: 200, y: 610 },

  { id: 'C1', artist: '尝尝咸淡', title: '候鸟疯人院', zone: '一级城墙', x: 318, y: 260 },
  {
    id: 'C2',
    artist: '声声折学 x 立在目',
    title: '32位设计师共创知时节·节器/知时节·书几',
    zone: '一级城墙',
    x: 276,
    y: 330,
  },
  { id: 'C3', artist: '尝尝咸淡', title: '寰宇银河', zone: '一级城墙', x: 330, y: 328 },
  { id: 'C4', artist: '王语馨', title: '你好!', zone: '一级城墙', x: 360, y: 430 },
  {
    id: 'C5',
    artist: '中央美术学院实验艺术系团队',
    title: '候鸟五百岁 / The Journey',
    zone: '一级城墙',
    x: 348,
    y: 515,
    note: 'PDF 卡片含长段作品说明，侧栏先保留作品核心名。',
  },
  { id: 'C6', artist: '鸟竹·学院', title: '数字雕塑展', zone: '一级城墙', x: 285, y: 610 },
  {
    id: 'C7',
    artist: '踏人工坊',
    title: 'Body as Brush, Gesture as Landscape 京剧交互绘画装置',
    zone: '一级城墙',
    x: 340,
    y: 645,
  },
  {
    id: 'C8',
    artist: '晓涵姐杰和博敦巴图',
    title: '一盏宋茶纳山海·沉浸式宋式点茶工作坊',
    zone: '一级城墙',
    x: 360,
    y: 695,
  },
  { id: 'C9', artist: '向海偏移', title: '向海偏移-系列作品', zone: '一级城墙', x: 300, y: 730 },
  {
    id: 'C10',
    artist: '西美公共拓展计划-周建、徐淼熙干林',
    title: 'Trunk, Torso',
    zone: '一级城墙',
    x: 315,
    y: 790,
  },

  { id: 'D1', artist: '张佳晶 / 高目', title: '伏园', zone: '伏园', x: 555, y: 135 },
  { id: 'D2', artist: '毛艺洁', title: '风、大、人', zone: '伏园', x: 505, y: 148 },
  { id: 'D3', artist: 'Harper', title: '猫椅', zone: '伏园', x: 500, y: 205 },
  { id: 'D4', artist: 'Moomaa', title: '超尺度宠爱', zone: '伏园', x: 504, y: 250 },
  {
    id: 'D5',
    artist: 'Pebot x 星世力',
    title: '留光计划-PEBOT宇宙探索太空狗',
    zone: '伏园',
    x: 555,
    y: 286,
  },
  { id: 'D6', artist: '铂金宠粮', title: '谁动了我的铂金饭碗', zone: '伏园', x: 620, y: 200 },
  { id: 'D7', artist: '张鼎', title: '一块牛排', zone: '沙城中区', x: 378, y: 428 },
  { id: 'D8', artist: '王大广', title: '嘿!虎!', zone: '沙城中区', x: 420, y: 850 },
  { id: 'D9', artist: '骑行懒驴', title: '风的回应', zone: '沙城中区', x: 415, y: 560 },

  { id: 'E1', artist: '黎晓亮', title: '回声 Echo', zone: '沙城中区', x: 603, y: 392 },
  {
    id: 'E2',
    artist: 'VITANYI-DIHEN VIVIEN PETRA',
    title: '狄珂岚 飞向匈牙利',
    zone: '沙城中区',
    x: 536,
    y: 540,
  },
  { id: 'E3', artist: '杨仕明', title: '指量', zone: '沙城中区', x: 645, y: 575 },
  { id: 'E4', artist: 'BEATS ARCHITECTS', title: '岛屿生物', zone: '沙城中区', x: 705, y: 286 },
  { id: 'E5', artist: '独响', title: '墨水屏', zone: '沙城中区', x: 725, y: 430 },
  { id: 'E6', artist: '飞天葫芦娃', title: '万象', zone: '沙城中区', x: 705, y: 650 },
  { id: 'E7', artist: 'CrePoP', title: 'MOZZ', zone: '沙城中区', x: 735, y: 735 },

  { id: 'F1', artist: '王兴伟', title: 'AI 分身', zone: '沙城中区', x: 820, y: 380 },
  { id: 'F2', artist: '刘志韬团队', title: '栖与渡', zone: '沙城中区', x: 820, y: 465 },
  { id: 'F3', artist: '鲁迅美术学院杨硕团队', title: '爱海', zone: '沙城中区', x: 720, y: 850 },
  {
    id: 'F4',
    artist: '候鸟300 AI主义新浪潮',
    title: 'AIGC 影像大赛',
    zone: '沙城中区',
    x: 805,
    y: 245,
  },
  { id: 'F5', artist: '秋漠实验室', title: '归去来兮', zone: '沙城中区', x: 920, y: 380 },
  {
    id: 'F6',
    artist: '林泽楷、何沛远、戴佳杰、伍万艺',
    title: '摇醒一片海',
    zone: '沙城中区',
    x: 920,
    y: 500,
  },
  { id: 'F7', artist: '响屋建筑', title: '盐停', zone: '沙城中区', x: 895, y: 720 },
  { id: 'F8', artist: '王姝雅', title: '诺亚的冲浪板', zone: '沙城中区', x: 820, y: 865 },

  { id: 'G1', artist: '徐毛毛', title: '白眼睛黑帐篷', zone: '候鸟黑客松', x: 886, y: 248 },
  {
    id: 'G2',
    artist: '苏施予',
    title: '共鸣绿境 Living Plants',
    zone: '候鸟黑客松',
    x: 944,
    y: 248,
  },
  { id: 'G3', artist: 'Hyper3D', title: 'Rodin', zone: '候鸟黑客松', x: 1002, y: 248 },
  {
    id: 'G4',
    artist: '刘思琪、田佳宝、王麒晴、孙小琪、王家娜、孙仲阳',
    title: '光影画卷·潮梦',
    zone: '时间广场',
    x: 810,
    y: 410,
  },
  { id: 'G5', artist: '李宜桐 x 舒洁 x 董昱桦', title: '形', zone: '时间广场', x: 965, y: 520 },
  { id: 'G6', artist: '候鸟故映', title: '未来单元', zone: '时间广场', x: 770, y: 610 },
  { id: 'G7', artist: '漂流事务所', title: '潮汐遗物', zone: '时间广场', x: 785, y: 695 },
  { id: 'G8', artist: '对对队', title: '爱', zone: '时间广场', x: 780, y: 780 },
  { id: 'G9', artist: '内陆流', title: '我们曾去寻找流水的源头', zone: '时间广场', x: 790, y: 865 },

  { id: 'H1', artist: '赵半狄', title: '2026年熊猫表情', zone: '鸟其林周边', x: 1010, y: 500 },
  { id: 'H2', artist: '木白日生', title: '艺术设计 回·响', zone: '鸟其林周边', x: 1080, y: 500 },
  {
    id: 'H3',
    artist: '啾啾 Jiu Jiu（袁立语、刘泽楷、王乐乐、黄石）',
    title: '啾啾 Jiu Jiu',
    zone: '鸟其林周边',
    x: 955,
    y: 710,
  },
  { id: 'H4', artist: 'CINDYe 叶心怡', title: 'Butterman', zone: '鸟其林周边', x: 1120, y: 725 },
  { id: 'H5', artist: '冯梦波', title: '真人快打', zone: '鸟其林周边', x: 900, y: 850 },
  {
    id: 'H6',
    artist: '赵宝琛',
    title: '诗人不在浴室必有人重写爱情',
    zone: '鸟其林周边',
    x: 1000,
    y: 850,
  },
  {
    id: 'H7',
    artist: '直得建筑 / 非必要不合作 / 道酸 / 苗晶',
    title: 'OAS/S-AETHER',
    zone: '鸟其林周边',
    x: 1160,
    y: 1010,
  },
  {
    id: 'H8',
    artist: 'Punk_Cui 崔朋克',
    title: '一根金针菇 See you tomorrow',
    zone: '鸟其林周边',
    x: 1240,
    y: 1015,
  },

  {
    id: 'I1',
    artist: '西美公共拓展计划-王思纯、袁钰雅、冯玉淑芸、陈昊南',
    title: '环岛日记',
    zone: '鸟其林周边',
    x: 1210,
    y: 555,
  },
  {
    id: 'I2',
    artist: '中国美术学院雕塑与公共艺术学院艺术工程与科技研究所',
    title: '海·影',
    zone: '鸟其林周边',
    x: 1110,
    y: 720,
  },
  {
    id: 'I3',
    artist: '李振伟',
    title: '海之微光: 万物迁徙的共生坐标',
    zone: '鸟其林周边',
    x: 1260,
    y: 1000,
  },

  {
    id: 'J1',
    artist: '醉美江南 MC',
    title: '摩挲公路复古艺术展',
    zone: '公路复古艺术展区',
    x: 1450,
    y: 665,
  },
  { id: 'J2', artist: '徐玥', title: '断句', zone: '公路复古艺术展区', x: 1450, y: 725 },
  {
    id: 'J3',
    artist: '贪玩办 Naughty Crew',
    title: 'The Watcher',
    zone: '公路复古艺术展区',
    x: 1580,
    y: 600,
  },
  {
    id: 'J4',
    artist: 'LINKE',
    title: '记忆岛屿 Memory',
    zone: '公路复古艺术展区',
    x: 1650,
    y: 640,
  },

  {
    id: 'K1',
    artist: '中国美术学院工艺美术系师生',
    title: 'KeepTurning “反重力” 中国美术学院玻璃社群计划',
    zone: '300.梯威',
    x: 1240,
    y: 860,
  },
  { id: 'K2', artist: '张依', title: '0101', zone: '300.梯威', x: 1210, y: 930 },
  { id: 'K3', artist: '景蕨', title: '须臾相生', zone: '300.梯威', x: 1210, y: 1000 },
  { id: 'K4', artist: '临十鸟', title: '程式 n', zone: '300.梯威', x: 1300, y: 930 },
  { id: 'K5', artist: '张钰卿', title: '海藻的标本', zone: '300.梯威', x: 1300, y: 1000 },
  {
    id: 'K6',
    artist: '临时艺术小组',
    title: '“临时艺术小组”在地创作',
    zone: '二级城墙',
    x: 1550,
    y: 850,
  },
  { id: 'K7', artist: '陈双、张贤瑞', title: '日感纪', zone: '二级城墙', x: 1550, y: 970 },
];

export const INSTALLATION_ZONES: InstallationZone[] = [
  '巡游花车停放处',
  '候鸟中心',
  '一级城墙',
  '伏园',
  '沙城中区',
  '候鸟黑客松',
  '时间广场',
  '鸟其林周边',
  '公路复古艺术展区',
  '300.梯威',
  '二级城墙',
];
