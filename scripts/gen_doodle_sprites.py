#!/usr/bin/env python3
"""程序化简笔画角色图集生成器 v2。
参考: assets/ui/张钰卿-人物-简笔画.jpg —— 粗黑线条、白底无填色、涂鸦感、圆头友善脸。
输出:
  - public/assets/32x32folk.png      新图集 (沿用文件名以免改 textureUrl)
  - data/spritesheets/f1..f8.ts      帧定义 (64px)
布局: 4列 x 2行 角色块, 每块 192x256, 帧 64x64 -> 图集 768x512。
技术: 16x 超采样画圆角粗线 -> LANCZOS 缩小, 平滑笔触 (非像素风, 渲染端用 LINEAR)。
"""
import math, os
from PIL import Image, ImageDraw

T = 64
SS = 16
C = T * SS
BLACK = (24, 24, 24, 255)
CLEAR = (0, 0, 0, 0)
ROOT = os.path.join(os.path.dirname(__file__), '..')

def stroke(d, p0, p1, w):
    d.line([p0, p1], fill=BLACK, width=int(w))
    r = w / 2
    for (x, y) in (p0, p1):
        d.ellipse([x-r, y-r, x+r, y+r], fill=BLACK)

def polyline(d, pts, w):
    for a, b in zip(pts, pts[1:]):
        stroke(d, a, b, w)

def ring(d, cx, cy, r, w):
    d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=BLACK)
    d.ellipse([cx-r+w, cy-r+w, cx+r-w, cy+r-w], fill=CLEAR)

def dot(d, cx, cy, r):
    d.ellipse([cx-r, cy-r, cx+r, cy+r], fill=BLACK)

def arc(d, box, a0, a1, w):
    d.arc(box, a0, a1, fill=BLACK, width=int(w))

# 角色: 发型 + 体型 + 裙装 区分 (对应参考图人群 + 角色身份)
CHARS = {
    'f1': dict(hair='short',   build=1.00, skirt=False),  # 阿福 开朗少年
    'f2': dict(hair='spiky',   build=0.90, skirt=False),  # 备用 刺头
    'f3': dict(hair='wild',    build=1.04, skirt=False),  # 艾莉 科学家乱发
    'f4': dict(hair='cap',     build=1.05, skirt=False),  # 老木 园丁帽
    'f5': dict(hair='bald',    build=1.00, skirt=False),  # 备用 光头
    'f6': dict(hair='pony',    build=1.00, skirt=True),   # 思黛 长马尾裙
    'f7': dict(hair='bowl',    build=1.02, skirt=False),  # 阿信 朴素锅盖头
    'f8': dict(hair='pigtail', build=0.84, skirt=True),   # 备用 双马尾女孩
}
ORDER = ['f1','f2','f3','f4','f5','f6','f7','f8']
DIRS = ['down','left','right','up']   # 行顺序与 .ts 一致
PHASES = [0, 1, 2]                    # 走路三帧

def draw_hair(d, cx, cy, r, w, style, direction):
    back = direction == 'up'
    cap_box = [cx-r, cy-r, cx+r, cy+r]
    def cap(scale=1.0, lift=0.0):
        bx = [cx-r*scale, cy-r*scale-lift, cx+r*scale, cy+r*scale-lift]
        d.pieslice(bx, 180, 360, fill=BLACK)
        d.pieslice([bx[0]+w, bx[1]+w, bx[2]-w, bx[3]-w], 180, 360, fill=CLEAR)
        d.rectangle([bx[0], cy-w, bx[2], cy], fill=CLEAR)
    if style == 'short':
        cap()
    elif style == 'spiky':
        for i in range(-2, 3):
            x = cx + i*r*0.42
            stroke(d, (x, cy-r*0.2), (x+r*0.1, cy-r*1.4), w*0.9)
    elif style == 'wild':
        for ang in range(150, 391, 18):
            a = math.radians(ang)
            stroke(d, (cx+r*math.cos(a), cy+r*math.sin(a)),
                      (cx+r*1.55*math.cos(a), cy+r*1.55*math.sin(a)), w*0.8)
    elif style == 'cap':
        d.pieslice([cx-r*1.05, cy-r*1.15, cx+r*1.05, cy+r*0.15], 180, 360, fill=BLACK)
        brim = cx+r*1.6 if direction != 'left' else cx-r*1.6
        stroke(d, (cx, cy-r*0.05), (brim, cy-r*0.15), w*0.9)
    elif style == 'bald':
        arc(d, [cx-r*0.6, cy-r*1.0, cx+r*0.6, cy-r*0.2], 200, 340, w*0.7)
    elif style == 'bowl':
        d.pieslice([cx-r*1.05, cy-r*1.05, cx+r*1.05, cy+r*0.45], 180, 360, fill=BLACK)
        d.pieslice([cx-r+w, cy-r+w, cx+r-w, cy+r*0.45-w], 180, 360, fill=CLEAR)
    elif style == 'pony':
        cap()
        side = cx+r if direction != 'left' else cx-r
        sgn = 1 if side > cx else -1
        polyline(d, [(side, cy-r*0.2), (side+sgn*r*0.45, cy+r*1.1),
                     (side-sgn*r*0.1, cy+r*2.0)], w*0.85)
    elif style == 'pigtail':
        cap()
        for sgn in (-1, 1):
            x = cx + sgn*r*0.95
            polyline(d, [(x, cy-r*0.1), (x+sgn*r*0.55, cy+r*0.5),
                         (x+sgn*r*0.3, cy+r*1.25)], w*0.8)
            dot(d, x+sgn*r*0.3, cy+r*1.25, w*0.7)

def draw_figure(direction, phase, params):
    img = Image.new('RGBA', (C, C), CLEAR)
    d = ImageDraw.Draw(img)
    w = C * 0.05
    b = params['build']
    cx = C*0.5
    # 步态: 帧0=站立中性(停下时停在这帧), 帧1/2=左右脚交替迈步
    # (左腿, 右腿) 沿"前进轴"的位移: +前 / -后
    lf, rf = {0: (0, 0), 1: (1, -1), 2: (-1, 1)}[phase]
    # 朝向决定前进轴: 上下=纵向, 左右=横向
    fwd = {'down': (0, 1), 'up': (0, -1), 'left': (-1, 0), 'right': (1, 0)}[direction]
    STEP = C*0.075   # 迈步幅度
    LIFT = C*0.05    # 后摆脚抬起高度
    bounce = (-C*0.014) if phase != 0 else 0.0  # 迈步时身体轻微上弹
    head_r = C*0.115
    head_cy = C*(0.5-0.305*b) + bounce
    sh_y = head_cy + head_r + w*0.4
    hip_y = C*(0.52+0.10*b) + bounce
    foot_y = C*0.94
    sh_w = C*0.155
    hip_w = C*0.065

    # T 恤 (梯形躯干 + 短袖)
    torso = [(cx-sh_w, sh_y), (cx+sh_w, sh_y),
             (cx+hip_w*1.5, hip_y), (cx-hip_w*1.5, hip_y)]
    d.line(torso+[torso[0]], fill=BLACK, width=int(w), joint='curve')
    # 短袖肩
    stroke(d, (cx-sh_w, sh_y+w*0.2), (cx-sh_w*1.25, sh_y+w*1.6), w)
    stroke(d, (cx+sh_w, sh_y+w*0.2), (cx+sh_w*1.25, sh_y+w*1.6), w)
    # 颈
    stroke(d, (cx, head_cy+head_r-w*0.2), (cx, sh_y), w)
    # 头
    ring(d, cx, head_cy, head_r, w)
    # 脸
    ex = head_r*0.42
    ey = head_cy + head_r*0.02
    if direction == 'down':
        dot(d, cx-ex, ey, w*0.55); dot(d, cx+ex, ey, w*0.55)
        arc(d, [cx-head_r*0.42, ey, cx+head_r*0.42, ey+head_r*0.6], 20, 160, w*0.5)  # 微笑
    elif direction == 'left':
        dot(d, cx-ex*0.7, ey, w*0.55)
    elif direction == 'right':
        dot(d, cx+ex*0.7, ey, w*0.55)
    # 头发
    draw_hair(d, cx, head_cy, head_r, w, params['hair'], direction)
    # 手臂 (体侧下垂; 走路时与同侧腿反向摆)
    arm_amt = C*0.06
    for sgn, leg_st in ((-1, lf), (1, rf)):
        ax = cx + sgn*sh_w*1.0
        # 手臂沿前进轴反向摆 (横向朝向才明显; 纵向朝向手臂略前后)
        ahx = ax - leg_st*arm_amt*fwd[0]
        ahy = hip_y + C*0.03 - leg_st*arm_amt*fwd[1]*0.6
        stroke(d, (ax, sh_y+w*1.4), (ahx, ahy), w)
    # 裙
    if params['skirt']:
        d.polygon([(cx-hip_w*1.5, hip_y-w*0.4), (cx+hip_w*1.5, hip_y-w*0.4),
                   (cx+sh_w*1.05, hip_y+C*0.12), (cx-sh_w*1.05, hip_y+C*0.12)],
                  outline=BLACK, width=int(w))
        leg_top = hip_y+C*0.12
    else:
        leg_top = hip_y
    # 腿 (左右交替迈步, 后摆脚抬起)
    toe = C*0.05
    for sgn, st in ((-1, lf), (1, rf)):
        fx = cx + sgn*hip_w*1.25 + st*STEP*fwd[0]
        fy = foot_y + st*STEP*fwd[1]
        if st < 0:           # 后摆脚抬起离地
            fy -= LIFT
        stroke(d, (cx + sgn*hip_w, leg_top), (fx, fy), w)
        # 鞋: 横向朝向脚尖朝前, 纵向朝向脚尖朝外
        tdx = fwd[0]*toe if fwd[0] != 0 else sgn*toe
        stroke(d, (fx, fy), (fx + tdx, fy), w*1.1)

    return img.resize((T, T), Image.LANCZOS)

def build_atlas():
    W, H = 4*3*T, 2*4*T   # 768 x 512
    atlas = Image.new('RGBA', (W, H), CLEAR)
    for idx, key in enumerate(ORDER):
        col, row = idx % 4, idx // 4
        bx, by = col*3*T, row*4*T
        p = CHARS[key]
        for di, direction in enumerate(DIRS):
            for pi, ph in enumerate(PHASES):
                fr = draw_figure(direction, ph, p)
                atlas.paste(fr, (bx+pi*T, by+di*T), fr)
    out = os.path.join(ROOT, 'public/assets/32x32folk.png')
    atlas.save(out)
    big = atlas.resize((W*2, H*2), Image.NEAREST)
    bg = Image.new('RGBA', big.size, (255,255,255,255)); bg.alpha_composite(big)
    bg.convert('RGB').save(os.path.join(ROOT, 'output/sprites/preview.png'))
    return out

# ---- 生成 .ts 帧定义 ----
TS_TMPL = """import {{ SpritesheetData }} from './types';

export const data: SpritesheetData = {{
  frames: {{
{frames}  }},
  meta: {{
    scale: '1',
  }},
  animations: {{
    left: ['left', 'left2', 'left3'],
    right: ['right', 'right2', 'right3'],
    up: ['up', 'up2', 'up3'],
    down: ['down', 'down2', 'down3'],
  }},
}};
"""
FRAME_TMPL = """    {name}: {{
      frame: {{ x: {x}, y: {y}, w: {w}, h: {h} }},
      sourceSize: {{ w: {w}, h: {h} }},
      spriteSourceSize: {{ x: 0, y: 0 }},
    }},
"""
# 块内行顺序: down, left, right, up (与现有 .ts 的 frame y 对应)
ROW_NAMES = [('down','down2','down3'), ('left','left2','left3'),
             ('right','right2','right3'), ('up','up2','up3')]

def build_ts():
    for idx, key in enumerate(ORDER):
        col, row = idx % 4, idx // 4
        bx, by = col*3*T, row*4*T
        frames = ''
        for di, names in enumerate(ROW_NAMES):
            for pi, name in enumerate(names):
                frames += FRAME_TMPL.format(name=name, x=bx+pi*T, y=by+di*T, w=T, h=T)
        path = os.path.join(ROOT, f'data/spritesheets/{key}.ts')
        with open(path, 'w') as f:
            f.write(TS_TMPL.format(frames=frames))

if __name__ == '__main__':
    out = build_atlas()
    build_ts()
    print('atlas ->', out)
    print('ts -> data/spritesheets/f1..f8.ts (64px)')
    print('preview -> output/sprites/preview.png')
