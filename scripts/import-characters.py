#!/usr/bin/env python
"""
角色立绘落位：photo/角色形象/*.png → public/assets/characters/char-*.webp

输入素材现状（2026-10-19 实测）：
  2848x1600 PNG、RGBA 透明底、全身立像、人物居中偏右、脚贴画幅底部；
  透明区域约 90%，人物实际包围盒只有 440~480 x 1500 左右（宽高比 0.29~0.32）。

处理流程（四步，不改画面内容）：
  ① 按 alpha 包围盒裁掉四周空白（阈值 8，避免半透明描边被切）；
  ② 等比缩放到「人物高度 = TARGET_CHAR_H」；
  ③ 补透明 padding（左右按人宽比、上 2%、下 1%），避免贴边被裁；
  ④ 存为 webp（有损 92，保留 alpha）。

输出规范：
  透明底竖图，**人物高度占图高 ≈ 96%**，宽度按人物比例自动（约 0.31），
  不强制 2:3 —— CharacterLayer 以 height 定位、img 用 width:auto 适配任意比例。

用法：
  E:/Python/python.exe scripts/import-characters.py
"""
import os
from PIL import Image

# ---------------- 配置（改这里即可换图/改规格） ----------------
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # app/
SRC_DIR = os.path.join(BASE, '..', 'photo', '角色形象')
DST_DIR = os.path.join(BASE, 'public', 'assets', 'characters')

# 源文件名（photo/角色形象/） → 输出文件名（public/assets/characters/）
NAMING = {
    '九婆.png': 'char-jiupo.webp',
    '阿禾.png': 'char-ahe.webp',
    '知遥.png': 'char-lin-zhiyao-b.webp',
    '周经理.png': 'char-zhou.webp',
}

TARGET_CHAR_H = 1400   # 人物像素高度（CharacterLayer 最大 420px 高，2x/3x 屏够用）
PAD_X = 0.06           # 左右透明边（相对人物宽度）
PAD_TOP = 0.02         # 顶部透明边（相对人物高度）
PAD_BOTTOM = 0.01      # 底部透明边（相对人物高度）——脚下留一点，贴底时不被对白框压住
ALPHA_THRESHOLD = 8    # 包围盒判定阈值（0-255）
WEBP_QUALITY = 92

# ---------------- 执行 ----------------
os.makedirs(DST_DIR, exist_ok=True)
for src_name, dst_name in NAMING.items():
    src_path = os.path.join(SRC_DIR, src_name)
    if not os.path.exists(src_path):
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
    scale = TARGET_CHAR_H / ch
    new_w = max(1, round(cw * scale))
    char = char.resize((new_w, TARGET_CHAR_H), Image.LANCZOS)

    pad_x = round(new_w * PAD_X)
    pad_top = round(TARGET_CHAR_H * PAD_TOP)
    pad_bottom = round(TARGET_CHAR_H * PAD_BOTTOM)
    canvas = Image.new('RGBA', (new_w + pad_x * 2, TARGET_CHAR_H + pad_top + pad_bottom), (0, 0, 0, 0))
    canvas.paste(char, (pad_x, pad_top), char)

    out_path = os.path.join(DST_DIR, dst_name)
    canvas.save(out_path, 'WEBP', quality=WEBP_QUALITY, method=6)

    size_kb = os.path.getsize(out_path) / 1024
    ratio = canvas.size[0] / canvas.size[1]
    print(
        f'{src_name}  bbox={bbox} 人={cw}x{ch} → {dst_name}  '
        f'{canvas.size[0]}x{canvas.size[1]} 比例={ratio:.3f}  {size_kb:.0f} KB'
    )

print('\n完成。输出目录：', DST_DIR)
