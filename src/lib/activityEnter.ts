// 模块级总线：节目单里的活动详情（深在 SidebarTabs 内）通知 App 进入某个活动的
// 专属 AIGC 游戏。仿照 mapFocus 的做法，避免层层 prop 透传。

// 进入活动时携带的描述，后端据此 get-or-create 该活动独立的 event。
export type ActivityDescriptor = {
  activityKey: string;
  title: string;
  theme: string;
  style: string;
  background: string;
  hostName?: string;
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

// 候鸟沙城统一的沙雕视觉风格——所有活动保持一致的美术调性，主题/背景各异。
const SAND_STYLE =
  'cinematic sand-sculpture diorama, warm golden hour light, fine sand grain texture, soft depth of field, dreamy storybook mood';

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
    style: SAND_STYLE,
    background: item.desc,
    hostName: item.venue,
    minPanels: 5,
    maxPanels: 8,
  };
}
