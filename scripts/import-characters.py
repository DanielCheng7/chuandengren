#!/usr/bin/env python
"""
角色立绘落位：photo/角色形象/*_{左,右}站位.png → public/assets/characters/char-*-{left,right}.webp

素材现状（2026-10-19 补充站位分版）：
  · 人物：2848x1600 PNG、RGBA 透明底、全身立像；透明区域约 90%，
    包围盒约 440~500 x 1500（宽高比 0.29~0.33）
  · 阿鲟：1728x2320 PNG，横卧鱼灯，包围盒约 1620x735（约 2.2:1）

处理流程（不改画面内容）：
  ① 按 alpha 包围盒裁掉四周空白（阈值 8，避免半透明描边被切）；
  ② 等比缩放：人物按「高度 = TARGET_CHAR_H」，鱼灯按「宽度 = TARGET_LAMP_W」；
  ③ 补透明 padding（左右按人宽比、上 2%、下 1%）；
  ④ 存为 webp（有损 92，保留 alpha）。

命名规则（站位 → 素材）：
  场景里站在**左槽**的角色用 `*-left.webp`，站在**右槽**用 `*-right.webp`；
  由 CharacterLayer 按 cast 顺序决定（第 1 位在左、第 2 位在右）。

用法：
  E:/Python/python.exe scripts/import-characters.py
"""
import os
import sys
from PIL import Image

# ---------------- 配置（改这里即可换图/改规格） ----------------
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # app/
SRC_DIR = os.path.join(BASE, '..', 'photo', '角色形象')
DST_DIR = os.path.join(BASE, 'public', 'assets', 'characters')

# （源文件基名, 输出文件基名, 缩放模式）
CHARS = [
    ('九婆', 'char-jiupo', 'human'),
    ('阿禾', 'char-ahe', 'human'),
    ('林知遥', 'char-lin-zhiyao-b', 'human'),
    ('周经理', 'char-zhou', 'human'),
    ('阿鲟', 'char-ashun', 'lamp'),   # 横卧鱼灯：按宽度缩放，避免按高度撑满画面
]
# （源文件后缀, 输出文件后缀）
SIDES = [('左站位', 'left'), ('右站位', 'right')]

# 只处理指定角色：`python scripts/import-characters.py 阿禾 [九婆 ...]`
# 不传则处理全部（换单角色素材时建议只跑该角色，避免其余角色的 WebP 被重新编码）
_ONLY = [a for a in sys.argv[1:] if not a.startswith('--')]
if _ONLY:
    CHARS = [c for c in CHARS if c[0] in _ONLY]
    if not CHARS:
        print(f'未匹配到角色：{_ONLY}（可选：九婆 / 阿禾 / 知遥 / 周经理 / 阿鲟）')
        raise SystemExit(1)

TARGET_CHAR_H = 1400   # 人物像素高度（CharacterLayer 最大 88vh，2x 屏够用）
TARGET_LAMP_W = 1100   # 阿鲟鱼灯像素宽度（2:1 横图，按宽定尺）
PAD_X = 0.06           # 左右透明边（相对主体宽度）
PAD_TOP = 0.02         # 顶部透明边（相对主体高度）
PAD_BOTTOM = 0.01      # 底部透明边——脚下留一点，贴底时不被对白框压住
ALPHA_THRESHOLD = 8    # 包围盒判定阈值（0-255）
WEBP_QUALITY = 92

# ---------------- 执行 ----------------
os.makedirs(DST_DIR, exist_ok=True)
made = []
for src_base, dst_base, mode in CHARS:
    for side_cn, side_en in SIDES:
        src_name = f'{src_base}_{side_cn}.png'
        src_path = os.path.join(SRC_DIR, src_name)
        if not os.path.exists(src_path):
            # 该角色只给了一张通用图时，左右站位共用（2026-10-20 周经理即此情况）
            generic = os.path.join(SRC_DIR, f'{src_base}.png')
            if os.path.exists(generic):
                src_path = generic
                src_name = f'{src_base}.png（左右共用）'
            else:
                print(f'跳过（源文件不存在）：{src_name}')
                continue

        im = Image.open(src_path).convert('RGBA')
        alpha = im.split()[-1]
        mask = alpha.point(lambda v: 255 if v > ALPHA_THRESHOLD else 0)
        bbox = mask.getbbox()
        if bbox is None:
            print(f'跳过（整张透明）：{src_name}')
            continue

        char = im.crop(bbox)
        cw, ch = char.size
        if mode == 'lamp':
            scale = TARGET_LAMP_W / cw
            new_w, new_h = TARGET_LAMP_W, max(1, round(ch * scale))
        else:
            scale = TARGET_CHAR_H / ch
            new_w, new_h = max(1, round(cw * scale)), TARGET_CHAR_H
        char = char.resize((new_w, new_h), Image.LANCZOS)

        pad_x = round(new_w * PAD_X)
        pad_top = round(new_h * PAD_TOP)
        pad_bottom = round(new_h * PAD_BOTTOM)
        canvas = Image.new('RGBA', (new_w + pad_x * 2, new_h + pad_top + pad_bottom), (0, 0, 0, 0))
        canvas.paste(char, (pad_x, pad_top), char)

        dst_name = f'{dst_base}-{side_en}.webp'
        out_path = os.path.join(DST_DIR, dst_name)
        canvas.save(out_path, 'WEBP', quality=WEBP_QUALITY, method=6)
        made.append(dst_name)

        size_kb = os.path.getsize(out_path) / 1024
        ratio = canvas.size[0] / canvas.size[1]
        print(
            f'{src_name}  bbox={bbox} 主体={cw}x{ch} → {dst_name}  '
            f'{canvas.size[0]}x{canvas.size[1]} 比例={ratio:.3f}  {size_kb:.0f} KB'
        )

print(f'\n完成，共 {len(made)} 张。输出目录：{DST_DIR}')
