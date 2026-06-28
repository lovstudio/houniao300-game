import { useRef, useState } from 'react';
import { pushJoystickVector, type JoystickVector } from '../lib/joystickBus.ts';

// 死区（相对基座半径）：低于此不触发移动，避免轻触误走。
const DEAD_ZONE = 0.3;
// 摇杆头最大行程（相对半径），略小于半径以免视觉溢出。
const MAX_TRAVEL_RATIO = 0.7;

// 量化为 4-邻接方向（取主导轴），与键盘 sendHumanMove 完全一致——网格世界本就 4-邻接寻路。
function quantize(nx: number, ny: number): JoystickVector {
  if (Math.hypot(nx, ny) < DEAD_ZONE) return null;
  if (Math.abs(nx) >= Math.abs(ny)) return { dx: Math.sign(nx), dy: 0 };
  return { dx: 0, dy: Math.sign(ny) };
}

// 移动端虚拟摇杆：固定左下角，触摸/拖动驱动角色持续移动（取代「点哪走哪」）。
export default function Joystick() {
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const lastVecRef = useRef<JoystickVector>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const update = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const radius = r.width / 2;
    const dx = clientX - (r.left + radius);
    const dy = clientY - (r.top + radius);
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const travel = Math.min(dist, radius * MAX_TRAVEL_RATIO);
    setKnob({ x: Math.cos(angle) * travel, y: Math.sin(angle) * travel });

    const vec = quantize(dx / radius, dy / radius);
    const changed =
      (vec?.dx ?? 0) !== (lastVecRef.current?.dx ?? 0) ||
      (vec?.dy ?? 0) !== (lastVecRef.current?.dy ?? 0);
    if (changed) {
      lastVecRef.current = vec;
      pushJoystickVector(vec);
    }
  };

  const onDown = (e: React.PointerEvent) => {
    if (pointerIdRef.current !== null) return;
    pointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setActive(true);
    update(e.clientX, e.clientY);
  };
  const onMove = (e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return;
    update(e.clientX, e.clientY);
  };
  const onUp = (e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    lastVecRef.current = null;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    pushJoystickVector(null);
  };

  return (
    <div className="pointer-events-none absolute bottom-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] left-[calc(env(safe-area-inset-left,0px)+1.5rem)] z-40 select-none">
      <div
        ref={baseRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className={clsxBase(active)}
      >
        <div
          className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-[#cc785c]/85 shadow-lg ring-2 ring-white/40 transition-[background-color] duration-150"
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        />
      </div>
    </div>
  );
}

function clsxBase(active: boolean) {
  return [
    'pointer-events-auto relative grid h-32 w-32 touch-none place-items-center rounded-full',
    'border bg-brown-900/35 backdrop-blur-sm transition-colors duration-150',
    active ? 'border-[#cc785c]/70 bg-brown-900/45' : 'border-[#cc785c]/35',
  ].join(' ');
}
