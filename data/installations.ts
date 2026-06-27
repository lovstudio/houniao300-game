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
    x: 105,
    y: 134,
  },
  {
    id: 'A2',
    artist: '中国美术学院艺术工程',
    title: '舟周而周',
    zone: '巡游花车停放处',
    x: 175,
    y: 134,
  },
  { id: 'A3', artist: '艺奇奇', title: '异想巴士', zone: '巡游花车停放处', x: 156, y: 186 },
  {
    id: 'A4',
    artist: '西美公共拓展计划-姚浩澜 TOP30、朱晟晟、刘钰源、张云哲',
    title: '逆骨机械，在陶醉与惊醒之间!',
    zone: '巡游花车停放处',
    x: 187,
    y: 186,
  },
  {
    id: 'A5',
    artist: '万偶煅',
    title: '森林乐队、马上疯猴、废土战车',
    zone: '巡游花车停放处',
    x: 224,
    y: 186,
  },
  {
    id: 'A6',
    artist: '牛啤堂',
    title: '精酿啤酒过客酒吧复活300小时',
    zone: '巡游花车停放处',
    x: 106,
    y: 239,
  },
  { id: 'A7', artist: 'CRAZY GRACE', title: 'CRAZY GRACE', zone: '巡游花车停放处', x: 159, y: 239 },
  {
    id: 'A8',
    artist: '大大大玩具',
    title: '调皮牛、羞羞的钱袋、浴缸鹿车',
    zone: '巡游花车停放处',
    x: 202,
    y: 239,
  },

  { id: 'B1', artist: '流动的画布', title: '流动的画布', zone: '候鸟中心', x: 232, y: 394 },
  {
    id: 'B2',
    artist: '罗马湖人',
    title: '所有道歉 la sante mentale eclatee',
    zone: '候鸟中心',
    x: 148,
    y: 500,
  },
  { id: 'B3', artist: 'AmilGer x 赛欣', title: '共同栖居', zone: '候鸟中心', x: 209, y: 782 },

  { id: 'C1', artist: '尝尝咸淡', title: '候鸟疯人院', zone: '一级城墙', x: 313, y: 158 },
  {
    id: 'C2',
    artist: '声声折学 x 立在目',
    title: '32位设计师共创知时节·节器/知时节·书几',
    zone: '一级城墙',
    x: 278,
    y: 178,
  },
  { id: 'C3', artist: '尝尝咸淡', title: '寰宇银河', zone: '一级城墙', x: 312, y: 194 },
  { id: 'C4', artist: '王语馨', title: '你好!', zone: '一级城墙', x: 319, y: 234 },
  {
    id: 'C5',
    artist: '中央美术学院实验艺术系团队',
    title: '候鸟五百岁 / The Journey',
    zone: '一级城墙',
    x: 278,
    y: 259,
    note: 'PDF 卡片含长段作品说明，侧栏先保留作品核心名。',
  },
  { id: 'C6', artist: '鸟竹·学院', title: '数字雕塑展', zone: '一级城墙', x: 298, y: 635 },
  {
    id: 'C7',
    artist: '踏人工坊',
    title: 'Body as Brush, Gesture as Landscape 京剧交互绘画装置',
    zone: '一级城墙',
    x: 323,
    y: 675,
  },
  {
    id: 'C8',
    artist: '晓涵姐杰和博敦巴图',
    title: '一盏宋茶纳山海·沉浸式宋式点茶工作坊',
    zone: '一级城墙',
    x: 322,
    y: 732,
  },
  { id: 'C9', artist: '向海偏移', title: '向海偏移-系列作品', zone: '一级城墙', x: 287, y: 759 },
  {
    id: 'C10',
    artist: '西美公共拓展计划-周建、徐淼熙干林',
    title: 'Trunk, Torso',
    zone: '一级城墙',
    x: 279,
    y: 827,
  },

  { id: 'D1', artist: '张佳晶 / 高目', title: '伏园', zone: '伏园', x: 451, y: 138 },
  { id: 'D2', artist: '毛艺洁', title: '风、大、人', zone: '伏园', x: 413, y: 150 },
  { id: 'D3', artist: 'Harper', title: '猫椅', zone: '伏园', x: 397, y: 174 },
  { id: 'D4', artist: 'Moomaa', title: '超尺度宠爱', zone: '伏园', x: 397, y: 199 },
  {
    id: 'D5',
    artist: 'Pebot x 星世力',
    title: '留光计划-PEBOT宇宙探索太空狗',
    zone: '伏园',
    x: 432,
    y: 209,
  },
  { id: 'D6', artist: '铂金宠粮', title: '谁动了我的铂金饭碗', zone: '伏园', x: 502, y: 164 },
  { id: 'D7', artist: '张鼎', title: '一块牛排', zone: '沙城中区', x: 464, y: 416 },
  { id: 'D8', artist: '王大广', title: '嘿!虎!', zone: '沙城中区', x: 408, y: 917 },
  { id: 'D9', artist: '骑行懒驴', title: '风的回应', zone: '沙城中区', x: 510, y: 565 },

  { id: 'E1', artist: '黎晓亮', title: '回声 Echo', zone: '沙城中区', x: 574, y: 330 },
  {
    id: 'E2',
    artist: 'VITANYI-DIHEN VIVIEN PETRA',
    title: '狄珂岚 飞向匈牙利',
    zone: '沙城中区',
    x: 574,
    y: 537,
  },
  { id: 'E3', artist: '杨仕明', title: '指量', zone: '沙城中区', x: 615, y: 620 },
  { id: 'E4', artist: 'BEATS ARCHITECTS', title: '岛屿生物', zone: '沙城中区', x: 673, y: 214 },
  { id: 'E5', artist: '独响', title: '墨水屏', zone: '沙城中区', x: 690, y: 391 },
  { id: 'E6', artist: '飞天葫芦娃', title: '万象', zone: '沙城中区', x: 677, y: 698 },
  { id: 'E7', artist: 'CrePoP', title: 'MOZZ', zone: '沙城中区', x: 697, y: 814 },

  { id: 'F1', artist: '王兴伟', title: 'AI 分身', zone: '沙城中区', x: 754, y: 275 },
  { id: 'F2', artist: '刘志韬团队', title: '栖与渡', zone: '沙城中区', x: 754, y: 391 },
  { id: 'F3', artist: '鲁迅美术学院杨硕团队', title: '爱海', zone: '沙城中区', x: 754, y: 942 },
  {
    id: 'F4',
    artist: '候鸟300 AI主义新浪潮',
    title: 'AIGC 影像大赛',
    zone: '沙城中区',
    x: 854,
    y: 197,
  },
  { id: 'F5', artist: '秋漠实验室', title: '归去来兮', zone: '沙城中区', x: 836, y: 278 },
  {
    id: 'F6',
    artist: '林泽楷、何沛远、戴佳杰、伍万艺',
    title: '摇醒一片海',
    zone: '沙城中区',
    x: 836,
    y: 450,
  },
  { id: 'F7', artist: '响屋建筑', title: '盐停', zone: '沙城中区', x: 836, y: 789 },
  { id: 'F8', artist: '王姝雅', title: '诺亚的冲浪板', zone: '沙城中区', x: 836, y: 917 },

  { id: 'G1', artist: '徐毛毛', title: '白眼睛黑帐篷', zone: '候鸟黑客松', x: 957, y: 214 },
  {
    id: 'G2',
    artist: '苏施予',
    title: '共鸣绿境 Living Plants',
    zone: '候鸟黑客松',
    x: 1016,
    y: 214,
  },
  { id: 'G3', artist: 'Hyper3D', title: 'Rodin', zone: '候鸟黑客松', x: 1079, y: 214 },
  {
    id: 'G4',
    artist: '刘思琪、田佳宝、王麒晴、孙小琪、王家娜、孙仲阳',
    title: '光影画卷·潮梦',
    zone: '时间广场',
    x: 1015,
    y: 323,
  },
  { id: 'G5', artist: '李宜桐 x 舒洁 x 董昱桦', title: '形', zone: '时间广场', x: 924, y: 428 },
  { id: 'G6', artist: '候鸟故映', title: '未来单元', zone: '时间广场', x: 955, y: 620 },
  { id: 'G7', artist: '漂流事务所', title: '潮汐遗物', zone: '时间广场', x: 923, y: 718 },
  { id: 'G8', artist: '对对队', title: '爱', zone: '时间广场', x: 954, y: 810 },
  { id: 'G9', artist: '内陆流', title: '我们曾去寻找流水的源头', zone: '时间广场', x: 923, y: 882 },

  { id: 'H1', artist: '赵半狄', title: '2026年熊猫表情', zone: '鸟其林周边', x: 1130, y: 429 },
  { id: 'H2', artist: '木白日生', title: '艺术设计 回·响', zone: '鸟其林周边', x: 1187, y: 429 },
  {
    id: 'H3',
    artist: '啾啾 Jiu Jiu（袁立语、刘泽楷、王乐乐、黄石）',
    title: '啾啾 Jiu Jiu',
    zone: '鸟其林周边',
    x: 1090,
    y: 753,
  },
  { id: 'H4', artist: 'CINDYe 叶心怡', title: 'Butterman', zone: '鸟其林周边', x: 1204, y: 771 },
  { id: 'H5', artist: '冯梦波', title: '真人快打', zone: '鸟其林周边', x: 1018, y: 892 },
  {
    id: 'H6',
    artist: '赵宝琛',
    title: '诗人不在浴室必有人重写爱情',
    zone: '鸟其林周边',
    x: 1090,
    y: 890,
  },
  {
    id: 'H7',
    artist: '直得建筑 / 非必要不合作 / 道酸 / 苗晶',
    title: 'OAS/S-AETHER',
    zone: '鸟其林周边',
    x: 1185,
    y: 986,
  },
  {
    id: 'H8',
    artist: 'Punk_Cui 崔朋克',
    title: '一根金针菇 See you tomorrow',
    zone: '鸟其林周边',
    x: 1239,
    y: 986,
  },

  {
    id: 'I1',
    artist: '西美公共拓展计划-王思纯、袁钰雅、冯玉淑芸、陈昊南',
    title: '环岛日记',
    zone: '鸟其林周边',
    x: 1302,
    y: 450,
  },
  {
    id: 'I2',
    artist: '中国美术学院雕塑与公共艺术学院艺术工程与科技研究所',
    title: '海·影',
    zone: '鸟其林周边',
    x: 1313,
    y: 782,
  },
  {
    id: 'I3',
    artist: '李振伟',
    title: '海之微光: 万物迁徙的共生坐标',
    zone: '鸟其林周边',
    note: '现场为桥下场域：两侧沙丘墩托起横向桥梁，中部保留可进入、可穿行的桥下空间，面向海面形成视线通廊。',
    x: 1294,
    y: 986,
  },

  {
    id: 'J1',
    artist: '醉美江南 MC',
    title: '摩挲公路复古艺术展',
    zone: '公路复古艺术展区',
    x: 1507,
    y: 434,
  },
  { id: 'J2', artist: '徐玥', title: '断句', zone: '公路复古艺术展区', x: 1507, y: 500 },
  {
    id: 'J3',
    artist: '贪玩办 Naughty Crew',
    title: 'The Watcher',
    zone: '公路复古艺术展区',
    x: 1538,
    y: 384,
  },
  {
    id: 'J4',
    artist: 'LINKE',
    title: '记忆岛屿 Memory',
    zone: '公路复古艺术展区',
    x: 1575,
    y: 426,
  },

  {
    id: 'K1',
    artist: '中国美术学院工艺美术系师生',
    title: 'KeepTurning “反重力” 中国美术学院玻璃社群计划',
    zone: '300.梯威',
    x: 1483,
    y: 851,
  },
  { id: 'K2', artist: '张依', title: '0101', zone: '300.梯威', x: 1484, y: 886 },
  { id: 'K3', artist: '景蕨', title: '须臾相生', zone: '300.梯威', x: 1484, y: 912 },
  { id: 'K4', artist: '临十鸟', title: '程式 n', zone: '300.梯威', x: 1501, y: 887 },
  { id: 'K5', artist: '张钰卿', title: '海藻的标本', zone: '300.梯威', x: 1501, y: 911 },
  {
    id: 'K6',
    artist: '临时艺术小组',
    title: '“临时艺术小组”在地创作',
    zone: '二级城墙',
    x: 1541,
    y: 831,
  },
  { id: 'K7', artist: '陈双、张贤瑞', title: '日感纪', zone: '二级城墙', x: 1541, y: 945 },
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
