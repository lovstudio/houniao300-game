// 模块级总线：底部状态栏（Timeline）在移动端点「节目单」时，打开 Game 里的侧边栏抽屉
// 并切到指定 tab。仿照 mapFocus / activityEnter 的做法，避免跨组件 prop 透传。

export type PanelTab = 'state' | 'chat' | 'schedule';

let openHandler: (() => void) | null = null;
let tabHandler: ((tab: PanelTab) => void) | null = null;

export function setPanelOpenHandler(fn: (() => void) | null) {
  openHandler = fn;
}

export function setPanelTabHandler(fn: ((tab: PanelTab) => void) | null) {
  tabHandler = fn;
}

// 打开侧边栏抽屉；可选地切到某个 tab。
export function openPanel(tab?: PanelTab) {
  openHandler?.();
  if (tab) tabHandler?.(tab);
}
