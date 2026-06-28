import { selectInstallationOnMap } from './mapFocus';

// 走近时探测到的单个可交互目标（空间入口 / 作品·建筑）。
export type NearbyTarget = {
  key: string; // 去重/排序比较用，唯一
  kind: 'venue' | 'work';
  id: string; // venue: 内场地图 id；work: 作品 slug
  label: string;
  interiorId: string; // 进入内场用的 id（== 物料 key）
  ready: boolean; // 内景是否就绪（venue 恒 true）
};

// 统一动作决策：场馆 / 内景已就绪 → 进入内景；否则（作品未生成内景）→ 打开侧栏详情。
// enter 由调用方注入（外部小镇 = App.enterInterior），便于复用同一逻辑。
export function actOnNearbyTarget(t: NearbyTarget, enter: (interiorId: string) => void) {
  if (t.kind === 'venue' || t.ready) enter(t.interiorId);
  else selectInstallationOnMap(t.id);
}
