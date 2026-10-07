"""產生社群分享預覽圖（1200×630）。由 build.py 呼叫。

需要：
  python3 -m pip install --user pillow
  字型放在 _tools/fonts/（Huninn-Regular.ttf、NotoSansTC.ttf，皆為 Google Fonts 的開源字型，授權見同資料夾的 OFL 檔）
  資料夾名稱以底線開頭，GitHub Pages 不會把它公開到網站上
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 630
FONT_DIR = Path(__file__).resolve().parent / "_tools" / "fonts"
BG = (6, 16, 26)
INK = (230, 241, 246)
MUTED = (141, 163, 179)
ICE = (143, 210, 240)
ICE2 = (74, 163, 212)
LINE = (28, 50, 69)
NO_LINE_START = set("，。、？！：；）」』》…—～,.?!:;)")


def fonts_ready():
    return (FONT_DIR / "Huninn-Regular.ttf").exists() and (FONT_DIR / "NotoSansTC.ttf").exists()


def noto(size, weight):
    f = ImageFont.truetype(str(FONT_DIR / "NotoSansTC.ttf"), size)
    try:
        f.set_variation_by_axes([weight])
    except Exception:
        pass
    return f


def huninn(size):
    return ImageFont.truetype(str(FONT_DIR / "Huninn-Regular.ttf"), size)


def background(seed):
    rnd = random.Random(seed)
    img = Image.new("RGB", (W, H), BG)
    glow = Image.new("RGB", (W, H), BG)
    g = ImageDraw.Draw(glow)
    for r, c in ((520, (17, 50, 74)), (360, (22, 66, 96))):
        g.ellipse((W - 260 - r, -220 - r, W - 260 + r, -220 + r), fill=c)
    img = Image.blend(img, glow.filter(ImageFilter.GaussianBlur(140)), 0.9)

    frost = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(frost)

    def branch(x, y, ang, length, depth):
        if depth > 3 or length < 3:
            return
        x2, y2 = x + math.cos(ang) * length, y + math.sin(ang) * length
        d.line((x, y, x2, y2), fill=150 - depth * 30, width=max(1, 2 - depth))
        for _ in range(2 + rnd.randint(0, 1)):
            f = 0.3 + rnd.random() * 0.6
            side = rnd.choice((-1, 1))
            branch(x + (x2 - x) * f, y + (y2 - y) * f, ang + side * (0.6 + rnd.random() * 0.5), length * 0.42, depth + 1)
        branch(x2, y2, ang + (rnd.random() - 0.5) * 0.5, length * 0.7, depth + 1)

    for _ in range(70):
        # 霜只長在四周邊緣
        edge = rnd.choice(("l", "r", "t", "b"))
        x = rnd.random() * 120 if edge == "l" else W - rnd.random() * 120 if edge == "r" else rnd.random() * W
        y = rnd.random() * 90 if edge == "t" else H - rnd.random() * 90 if edge == "b" else rnd.random() * H
        branch(x, y, rnd.random() * math.tau, 18 + rnd.random() * 40, 0)
    for _ in range(140):
        x, y, r = rnd.random() * W, rnd.random() * H, rnd.random() * 2.2 + 0.6
        d.ellipse((x - r, y - r, x + r, y + r), fill=int(60 + rnd.random() * 120))
    img.paste((205, 235, 250), (0, 0), frost.filter(ImageFilter.GaussianBlur(0.6)).point(lambda v: int(v * 0.55)))
    return img


def gradient_text(img, xy, text, font, c1=ICE, c2=ICE2):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).text(xy, text, font=font, fill=255)
    box = mask.getbbox()
    if not box:
        return
    grad = Image.new("RGB", img.size)
    gd = ImageDraw.Draw(grad)
    x0, x1 = box[0], box[2]
    for x in range(x0, x1 + 1):
        t = (x - x0) / max(1, x1 - x0)
        gd.line((x, 0, x, H), fill=tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)))
    img.paste(grad, (0, 0), mask)


def cube(img, cx, cy, s):
    """等角冰塊，帶高光。"""
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    top = [(cx, cy - s), (cx + s * 0.87, cy - s * 0.5), (cx, cy), (cx - s * 0.87, cy - s * 0.5)]
    left = [(cx - s * 0.87, cy - s * 0.5), (cx, cy), (cx, cy + s), (cx - s * 0.87, cy + s * 0.5)]
    right = [(cx, cy), (cx + s * 0.87, cy - s * 0.5), (cx + s * 0.87, cy + s * 0.5), (cx, cy + s)]
    d.polygon(top, fill=(214, 240, 252, 235))
    d.polygon(left, fill=(78, 166, 212, 225))
    d.polygon(right, fill=(134, 205, 238, 225))
    for poly in (top, left, right):
        d.line(poly + [poly[0]], fill=(255, 255, 255, 140), width=2)
    d.line((cx - s * 0.6, cy - s * 0.55, cx - s * 0.1, cy - s * 0.82), fill=(255, 255, 255, 220), width=5)
    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse((cx - s, cy + s * 0.85, cx + s, cy + s * 1.25), fill=(0, 0, 0, 120))
    img.paste(shadow.filter(ImageFilter.GaussianBlur(18)), (0, 0), shadow.filter(ImageFilter.GaussianBlur(18)))
    img.paste(layer, (0, 0), layer)


def pill(d, x, y, text, font, fill=None, outline=LINE, color=MUTED):
    tw = d.textlength(text, font=font)
    h = font.size + 18
    d.rounded_rectangle((x, y, x + tw + 32, y + h), radius=h // 2, fill=fill, outline=outline, width=2)
    d.text((x + 16, y + h / 2), text, font=font, fill=color, anchor="lm")
    return x + tw + 32 + 12


def wrap(text, font, width, d):
    lines, cur = [], ""
    for ch in text:
        if d.textlength(cur + ch, font=font) <= width or not cur:
            cur += ch
        elif ch in NO_LINE_START:
            # 標點不放行首：連同前一個字一起換行
            lines.append(cur[:-1])
            cur = cur[-1] + ch
        else:
            lines.append(cur)
            cur = ch
    if cur:
        lines.append(cur)
    return lines


def brand(img, d, x, y, size=30):
    s = size * 0.55
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    cx, cy = x + s * 0.87, y + s
    ld.polygon([(cx, cy - s), (cx + s * 0.87, cy - s * 0.5), (cx, cy), (cx - s * 0.87, cy - s * 0.5)], fill=(230, 246, 253))
    ld.polygon([(cx - s * 0.87, cy - s * 0.5), (cx, cy), (cx, cy + s), (cx - s * 0.87, cy + s * 0.5)], fill=(78, 166, 212))
    ld.polygon([(cx, cy), (cx + s * 0.87, cy - s * 0.5), (cx + s * 0.87, cy + s * 0.5), (cx, cy + s)], fill=(134, 205, 238))
    img.paste(layer, (0, 0), layer)
    d.text((x + s * 2 + 14, cy), "冷笑話製冰所", font=noto(size, 700), fill=INK, anchor="lm")


def home_image(path, count):
    img = background(2026)
    d = ImageDraw.Draw(img)
    cube(img, 940, 300, 150)
    d = ImageDraw.Draw(img)
    pill(d, 860, 500, "−38°C", noto(26, 700), fill=ICE, outline=ICE, color=BG)
    d.text((80, 92), "ICE FACTORY  ·  EST. 2026", font=noto(22, 700), fill=ICE)
    big = noto(150, 900)
    d.text((72, 128), "冷笑話", font=big, fill=INK)
    gradient_text(img, (72, 290), "製冰所", big)
    d = ImageDraw.Draw(img)
    d.text((80, 500), f"{count} 則冷到懷疑人生的冷笑話", font=huninn(40), fill=INK)
    d.text((80, 560), "daqingjuan.github.io", font=noto(24, 400), fill=MUTED)
    img.save(path, quality=84, optimize=True, progressive=True)


def joke_image(path, j, fmt):
    img = background(j["id"])
    d = ImageDraw.Draw(img)
    brand(img, d, 72, 60)
    x = pill(d, 72, 126, j["no"], noto(22, 400))
    x = pill(d, x, 126, j["cat"], noto(22, 400))
    pill(d, x, 126, "冷度 " + fmt(j["t"]), noto(22, 700), fill=ICE, outline=ICE, color=BG)

    box_w, top, bottom = W - 144, 200, 470
    for size in range(100, 39, -2):
        f = huninn(size)
        lines = wrap(j["q"], f, box_w, d)
        lh = int(size * 1.42)
        if len(lines) * lh <= bottom - top and len(lines) <= 4:
            break
    # 平衡換行：在行數不變的前提下，盡量縮短行寬，讓每行長度接近
    lo, hi = box_w * 0.4, box_w
    for _ in range(14):
        mid = (lo + hi) / 2
        if len(wrap(j["q"], f, mid, d)) <= len(lines):
            hi = mid
        else:
            lo = mid
    lines = wrap(j["q"], f, hi + 1, d)
    y = top + ((bottom - top) - len(lines) * lh) / 2
    for line in lines:
        d.text((72, y), line, font=f, fill=INK)
        y += lh

    # 底部的霜面按鈕
    bar = Image.new("RGBA", img.size, (0, 0, 0, 0))
    bd = ImageDraw.Draw(bar)
    bd.rounded_rectangle((72, 500, 72 + 560, 570), radius=35, fill=(58, 109, 143, 255), outline=(143, 210, 240, 160), width=2)
    img.paste(bar, (0, 0), bar)
    d = ImageDraw.Draw(img)
    d.text((72 + 280, 535), "答案藏在冰塊裡，點進來敲碎它", font=noto(26, 700), fill=(226, 245, 253), anchor="mm")
    d.text((W - 72, 535), "daqingjuan.github.io", font=noto(22, 400), fill=MUTED, anchor="rm")
    img.save(path, quality=84, optimize=True, progressive=True)
