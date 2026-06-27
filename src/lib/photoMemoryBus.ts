// 模块级总线：深层组件（如作品详情）请求打开「照片记忆」弹窗，并可携带一个预选的拍摄地点。
// 仿照 activityEnter / mapFocus，避免把 onOpenPhotoMemory 层层透传到 SidebarTabs 深处。
import type { PhotoMemoryLocationOption } from '../components/PhotoMemoryModal';

type Opener = (option: PhotoMemoryLocationOption | null) => void;

let opener: Opener | null = null;

export function setPhotoMemoryOpener(fn: Opener | null) {
  opener = fn;
}

// option 为 null 时按当前全局上下文打开（与顶栏入口一致）。
export function openPhotoMemory(option: PhotoMemoryLocationOption | null = null) {
  opener?.(option);
}
