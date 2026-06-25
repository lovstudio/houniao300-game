// 模块级总线：节目单里的活动详情（深在 SidebarTabs 内）通知 App 进入某个活动的
// 专属 AIGC 游戏。仿照 mapFocus 的做法，避免层层 prop 透传。
import { CATEGORY_COLORS, type Category } from '../../data/schedule';

// 进入活动时携带的描述，后端据此 get-or-create 该活动独立的 event。
export type ActivityDescriptor = {
  activityKey: string;
  title: string;
  theme: string;
  style: string;
  background: string;
  hostName?: string;
  category?: string; // 节目单分类，用于"推荐下一个活动"
  minPanels: number;
  maxPanels: number;
};

export type ActivityEnterListener = (activity: ActivityDescriptor) => void;

let listener: ActivityEnterListener | null = null;

export function setActivityEnterHandler(fn: ActivityEnterListener | null) {
  listener = fn;
}

export function enterActivity(activity: ActivityDescriptor) {
  listener?.(activity);
}

// 所有活动统一在「沙雕材质」母题下成系列；各类别只在打光/构图/氛围上做变体，
// 既去模板化（不同类别首格风格一眼可辨），又与任务2的主角/色板锁定兼容
// （后续格靠首格参考图锁一致，类别风格主要在首格定调）。
const SAND_BASE =
  'cinematic sand-sculpture diorama, intricate carved sand, fine sand grain texture, miniature world made entirely of sculpted sand';

// 八类活动各自的风格变体（仅描述打光/构图/氛围，调色锚点单独由 CATEGORY_COLORS 注入）。
const STYLE_VARIANT: Record<Category, string> = {
  戏剧: 'theatrical stage with a single dramatic spotlight, heavy velvet curtains framing the scene, strong chiaroscuro shadows, operatic tension',
  舞蹈: 'dynamic motion-blur long exposure, sweeping movement trails of flowing sand, kinetic grace and rhythm, energetic dancing silhouettes',
  放映: 'vintage cinematic film grain, a projector beam cutting through dusty haze, soft letterbox framing, nostalgic screening-room glow',
  科技: 'futuristic holographic glow, luminous data lines and circuit motifs etched in sand, sleek clean high-tech ambience, cool luminescence',
  音乐: 'rhythmic glowing soundwaves rippling through the air, concert-stage haze and stage lights, vibrant pulsing musical energy',
  魔术: 'deep velvet darkness pierced by a mysterious spotlight, drifting theatrical smoke, glints of golden sparkle, air of illusion and wonder',
  工作坊: 'warm handcrafted workshop light, scattered tools and raw materials, cozy artisanal hands-on mood, soft tactile warmth',
  脱口秀: 'intimate comedy-club spotlight on a lone microphone, warm brick-wall backdrop, casual playful mood, relaxed late-night glow',
};

// 默认风格（无类别命中时退回的暖色沙雕基调）。
const DEFAULT_STYLE = `${SAND_BASE}, warm golden hour light, soft depth of field, dreamy storybook mood`;

// 组合：沙雕母题 + 类别变体 + 该类别调色锚点（复用 schedule.ts 的 CATEGORY_COLORS）。
function styleFor(cat: string): string {
  const variant = STYLE_VARIANT[cat as Category];
  if (!variant) return DEFAULT_STYLE;
  const accent = CATEGORY_COLORS[cat as Category];
  return `${SAND_BASE}, ${variant}, accent color palette anchored on ${accent}`;
}

// 把节目单条目转成进入描述。activityKey 用 date+time+venue+title 唯一标识一个活动。
export function activityFromSchedule(item: {
  date: string;
  time: string;
  venue: string;
  cat: string;
  title: string;
  desc: string;
}): ActivityDescriptor {
  return {
    activityKey: `${item.date}|${item.time}|${item.venue}|${item.title}`,
    title: item.title,
    theme: `「${item.title}」——${item.cat}，发生在候鸟沙城的${item.venue}`,
    style: styleFor(item.cat),
    background: item.desc,
    hostName: item.venue,
    category: item.cat,
    minPanels: 5,
    maxPanels: 8,
  };
}
