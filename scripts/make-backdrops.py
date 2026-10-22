"""
批量出「场景底图」webp（16:9 / 1920×1080 / ≤400KB）

用途（2026-10-22 背景图复查后的补图）：
  1. bg_fish_parade.webp —— 尾声 EP 与结局页 B/C 一直缺这张，实机落到渐变底。
     源用 `photo/序章/PRO-6_夜游鱼河.png`（2048×1152，正好 16:9，已通过的美术）。
  2. 第一章三张底图重出为统一 16:9 —— 原先分别 1920×1023 / 1932×1185 / 1920×1079。

策略：cover 裁切（居中）→ LANCZOS 缩到 1920×1080 → webp，质量从 QUALITY 起降档，
直到体积 ≤ MAX_KB。
"""

import os
from PIL import Image

# —— 配置：源图 → 输出 ——
SRC_ROOT = r'D:\Agent Project\race\photo'
OUT_ROOT = r'D:\Agent Project\race\app\public\assets\scenes'

JOBS = [
    # (源文件相对 SRC_ROOT 的路径, 输出相对 OUT_ROOT 的路径)
    (r'序章\PRO-6_夜游鱼河.png', 'bg_fish_parade.webp'),
    (r'第一章\C1-2(1).jpg', 'bg_laoxu_street.webp'),
    (r'第一章\C1-4a.jpg', 'bg_museum_case.webp'),
    (r'第一章\C1-4b.jpg', 'bg_gift_shop.webp'),
]

W, H = 1920, 1080
QUALITY = 86          # 起始质量
QUALITY_MIN = 70      # 体积压不下来时的下限
MAX_KB = 400
METHOD = 6

for rel_src, rel_out in JOBS:
    src = os.path.join(SRC_ROOT, rel_src)
    out = os.path.join(OUT_ROOT, rel_out)

    im = Image.open(src).convert('RGB')
    sw, sh = im.size
    # cover：先把源图裁成 16:9（居中），再缩放
    if sw / sh > W / H:
        cw = round(sh * W / H)
        box = ((sw - cw) // 2, 0, (sw + cw) // 2, sh)
    else:
        ch = round(sw * H / W)
        box = (0, (sh - ch) // 2, sw, (sh + ch) // 2)
    im = im.crop(box).resize((W, H), Image.LANCZOS)

    q = QUALITY
    while True:
        im.save(out, 'WEBP', quality=q, method=METHOD)
        kb = os.path.getsize(out) / 1024
        if kb <= MAX_KB or q <= QUALITY_MIN:
            break
        q -= 4

    print(f'{rel_out:24s} {sw}x{sh} → {W}x{H}  q={q}  {kb:.0f}KB')
