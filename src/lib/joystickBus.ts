// 模块级总线：移动端虚拟摇杆（DOM）驱动 PixiGame 渲染器内部的移动循环。
// 仿照 mapFocus / panelBus，避免跨 Pixi 渲染器（React context 不共享）的 prop 透传。

// dx/dy ∈ {-1, 0, 1}，已量化为 4-邻接方向；null 表示松手停止。
export type JoystickVector = { dx: number; dy: number } | null;
export type JoystickListener = (vector: JoystickVector) => void;

let listener: JoystickListener | null = null;

export function setJoystickHandler(fn: JoystickListener | null) {
  listener = fn;
}

export function pushJoystickVector(vector: JoystickVector) {
  listener?.(vector);
}
