import { selectInstallationOnMap } from './mapFocus';
import type { GameId } from '../../convex/aiTown/ids';

type NearbyVenueTarget = {
  key: string; // 去重/排序比较用，唯一
  kind: 'venue';
  id: string; // venue: 内场地图 id；work: 作品 slug
  label: string;
  interiorId: string; // 进入内场用的 id（== 物料 key）
  ready: true; // 内景是否就绪（venue 恒 true）
};

type NearbyWorkTarget = {
  key: string;
  kind: 'work';
  id: string;
  label: string;
  interiorId: string;
  ready: boolean;
};

type NearbyPlayerTarget = {
  key: string;
  kind: 'player';
  action: 'talk' | 'details';
  id: GameId<'players'>;
  actorId: GameId<'players'>;
  label: string;
};

// 走近时探测到的单个可交互目标（空间入口 / 作品·建筑 / 玩家）。
export type NearbyTarget = NearbyVenueTarget | NearbyWorkTarget | NearbyPlayerTarget;

export function nearbyActionLabel(t: NearbyTarget) {
  if (t.kind === 'player') return t.action === 'talk' ? '对话' : '查看资料';
  return t.kind === 'venue' || t.ready ? '进入' : '查看';
}

// 统一动作决策：场馆 / 内景已就绪 → 进入内景；未生成内景作品 → 打开侧栏详情；
// 玩家动作 → 打开资料或发起对话。enter 由调用方注入（外部小镇 = App.enterInterior）。
export function actOnNearbyTarget(
  t: NearbyTarget,
  handlers: {
    enter: (interiorId: string) => void;
    selectPlayer: (id: GameId<'players'>) => void;
    startConversation: (playerId: GameId<'players'>, invitee: GameId<'players'>) => void;
  },
) {
  if (t.kind === 'player') {
    handlers.selectPlayer(t.id);
    if (t.action === 'talk') handlers.startConversation(t.actorId, t.id);
    return;
  }
  if (t.kind === 'venue' || t.ready) handlers.enter(t.interiorId);
  else selectInstallationOnMap(t.id);
}
