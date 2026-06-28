import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { enterVenueInterior } from '../lib/mapFocus';
import { enterActivity, type ActivityDescriptor } from '../lib/activityEnter';
import { openPhotoMemory } from '../lib/photoMemoryBus';
import type { PhotoMemoryLocationOption } from './PhotoMemoryModal';

// 空间 / 作品 / 活动 三类实体共享的动作区：
// 进入内景（前置：内景已生成）、地图定位、拍照记忆、玩游戏（专属体验）。
// 每个动作仅在对应 prop 提供时渲染，其余自动隐藏——各实体只用其适用的子集。

// 判断某实体「内景是否已生成」：手工编排的内场恒为 true；否则查 materials 表同名 key 是否 ready。
// interiorId 约定与物料 key 同字符串（venue:<refId> / work:<slug>），故这里直接用它查。
export function useInteriorReady(args: {
  kind: 'venue' | 'work';
  refId: string;
  authored?: boolean;
}): boolean {
  const docs = useQuery(api.materials.list, { kind: args.kind });
  if (args.authored) return true;
  const key = `${args.kind}:${args.refId}`;
  return !!docs?.find((d) => d.key === key && d.status === 'ready');
}

const PRIMARY =
  'w-full rounded bg-clay-700 px-3 py-2.5 text-base font-bold text-white hover:bg-clay-500 disabled:cursor-not-allowed disabled:opacity-50';
const SECONDARY =
  'w-full rounded border-2 border-brown-700 px-3 py-2.5 text-base font-bold text-brown-100 hover:border-clay-500';

export default function EntityActions({
  interior,
  onLocate,
  photoMemory,
  activity,
  onBeforeEnterInterior,
}: {
  // 提供则显示「进入内景」；ready=false 时按钮置灰并提示先生成内景。
  interior?: { id: string; ready: boolean };
  onLocate?: () => void;
  photoMemory?: PhotoMemoryLocationOption;
  activity?: ActivityDescriptor;
  // 进入内景前的副作用（如打点 artwork_entered）。
  onBeforeEnterInterior?: () => void;
}) {
  // 主按钮：有内景时是「进入内景」，否则是「玩游戏」。
  const primary: 'interior' | 'activity' | null = interior ? 'interior' : activity ? 'activity' : null;

  return (
    <div className="mt-4 space-y-2">
      {interior && (
        <button
          disabled={!interior.ready}
          onClick={() => {
            onBeforeEnterInterior?.();
            enterVenueInterior(interior.id);
          }}
          className={PRIMARY}
          title={interior.ready ? undefined : '先在下方生成内景后才能进入'}
        >
          {interior.ready ? '进入可走动内景' : '进入内景（待生成）'}
        </button>
      )}
      {onLocate && (
        <button onClick={onLocate} className={SECONDARY}>
          在地图上定位
        </button>
      )}
      {photoMemory && (
        <button onClick={() => openPhotoMemory(photoMemory)} className={SECONDARY}>
          在此拍照记忆
        </button>
      )}
      {activity && (
        <button
          onClick={() => enterActivity(activity)}
          className={primary === 'activity' ? PRIMARY : SECONDARY}
        >
          玩这个专属体验
        </button>
      )}
    </div>
  );
}
