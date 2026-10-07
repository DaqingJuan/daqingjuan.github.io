#!/usr/bin/env python3
"""冷笑話製冰所的產生器。

用法：編輯 jokes.json（新笑話加在最後面，不要改動既有順序，批號才不會跑掉），
然後執行：python3 build.py

會更新：
  index.html     首頁的笑話資料與靜態卡片（讓 Google 不用執行程式也讀得到）
  j/<編號>/      每則笑話的獨立頁面
  sitemap.xml    網站地圖
  robots.txt     告訴搜尋引擎可以收錄
  og.jpg、j/<編號>/og.jpg   分享到 LINE / Facebook 時的預覽圖（需要 Pillow 與 ../工具/fonts）
"""
import datetime
import html
import json
import re
import shutil
from pathlib import Path

SITE = "https://daqingjuan.github.io/"

try:
    import og
    OG = og.fonts_ready()
    if not OG:
        print("提醒：找不到 ../工具/fonts 裡的字型，這次不產生預覽圖")
except ImportError:
    OG = False
    print("提醒：沒有安裝 Pillow，這次不產生預覽圖（安裝：python3 -m pip install --user pillow）")
ROOT = Path(__file__).resolve().parent
TODAY = datetime.date.today().isoformat()


def esc(s):
    return html.escape(s, quote=True)


def fmt(t):
    return ("−" if t < 0 else "") + f"{abs(t)}°C"


def load():
    jokes = json.loads((ROOT / "jokes.json").read_text(encoding="utf-8"))
    for i, j in enumerate(jokes, 1):
        j["id"] = i
        j["no"] = f"No.{i:03d}"
        j["v"] = round(min(1, abs(j["t"]) / 40), 3)
    return jokes


def card(j):
    return (
        f'<article class="card" id="j{j["id"]}">'
        f'<div class="card-top"><a class="no" href="j/{j["id"]}/">{j["no"]}</a>'
        f'<span class="pill">{esc(j["cat"])}</span><span class="pill temp">{fmt(j["t"])}</span></div>'
        f'<p class="q" id="q{j["id"]}">{esc(j["q"])}</p>'
        f'<div class="box"><p class="a" tabindex="-1" aria-hidden="true">{esc(j["a"])}</p>'
        f'<button class="cover frost-tex" type="button" aria-describedby="q{j["id"]}">敲碎看答案</button></div>'
        f'<div class="card-foot"><span class="bc"></span><div class="acts" hidden>'
        f'<button class="mini share" type="button">分享</button><button class="mini again" type="button">冰回去</button>'
        f"</div></div></article>"
    )


def build_index(jokes):
    p = ROOT / "index.html"
    s = p.read_text(encoding="utf-8")
    data = json.dumps([{k: j[k] for k in ("q", "a", "cat", "t")} for j in jokes], ensure_ascii=False)
    data = data.replace("</", "<\\/")
    s, n1 = re.subn(r"/\*JOKES\*/.*?/\*/JOKES\*/", lambda m: f"/*JOKES*/{data}/*/JOKES*/", s, flags=re.S)
    cards = "\n" + "\n".join(card(j) for j in jokes) + "\n"
    s, n2 = re.subn(r"<!--CARDS-->.*?<!--/CARDS-->", lambda m: f"<!--CARDS-->{cards}<!--/CARDS-->", s, flags=re.S)
    assert n1 == 1 and n2 == 1, "index.html 裡找不到 JOKES 或 CARDS 標記"
    n = len(jokes)
    if OG:
        og.home_image(ROOT / "og.jpg", n)
        tags = og_tags(SITE + "og.jpg", "冷笑話製冰所")
        s, k = re.subn(r"<!--OG-->.*?<!--/OG-->", lambda m: f"<!--OG-->\n{tags}\n<!--/OG-->", s, flags=re.S)
        assert k == 1, "index.html 裡找不到 OG 標記"
    for pat in (r"冷笑話大全｜\d+ 則", r"冷笑話大全：\d+ 則", r"製冰所｜\d+ 則", r"收錄 \d+ 則"):
        s = re.sub(pat, lambda m: re.sub(r"\d+", str(n), m.group(0)), s)
    p.write_text(s, encoding="utf-8")


PAGE_CSS = """
:root{--bg:#eef4f6;--surface:#fbfdfe;--ink:#0b1a2b;--muted:#4f6476;--line:#cbdae1;--ice:#1b6a95;--ice-2:#4ea6d4;--ice-soft:#d5eaf4;--hot:#e04a26;
--frost-a:rgba(255,255,255,.96);--frost-b:rgba(196,226,242,.94);--frost-c:rgba(160,205,230,.96);--frost-ink:#0d3a55;
--head:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;--display:"Huninn","Noto Sans TC","PingFang TC",sans-serif;--mono:"JetBrains Mono",ui-monospace,Menlo,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){color-scheme:dark;--bg:#06101a;--surface:#0d1c2a;--ink:#e6f1f6;--muted:#8da3b3;--line:#1c3245;--ice:#8fd2f0;--ice-2:#4aa3d4;--ice-soft:#11324a;--hot:#ff7a52;--frost-a:#3a6d8f;--frost-b:#24506f;--frost-c:#2f6283;--frost-ink:#e2f5fd}}
:root[data-theme=dark]{color-scheme:dark;--bg:#06101a;--surface:#0d1c2a;--ink:#e6f1f6;--muted:#8da3b3;--line:#1c3245;--ice:#8fd2f0;--ice-2:#4aa3d4;--ice-soft:#11324a;--hot:#ff7a52;--frost-a:#3a6d8f;--frost-b:#24506f;--frost-c:#2f6283;--frost-ink:#e2f5fd}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:radial-gradient(900px 500px at 85% -10%,var(--ice-soft),transparent 70%),var(--bg);background-attachment:fixed;color:var(--ink);font-family:var(--head);line-height:1.7;-webkit-font-smoothing:antialiased}
a{color:inherit}
:focus-visible{outline:3px solid var(--hot);outline-offset:3px;border-radius:8px}
.wrap{max-width:760px;margin:0 auto;padding-inline:clamp(16px,4vw,32px)}
.top{display:flex;align-items:center;gap:10px;height:60px;border-bottom:1px solid var(--line)}
.top a{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:700}
.top svg{width:24px;height:24px}
main{padding-block:clamp(40px,8vw,80px) 40px}
.meta{display:flex;flex-wrap:wrap;gap:8px;font-family:var(--mono);font-size:12px;color:var(--muted);margin-bottom:18px}
.pill{padding:3px 10px;border-radius:999px;border:1px solid var(--line);background:var(--surface)}
.pill.temp{border-color:transparent;background:var(--ice);color:var(--bg);font-weight:600}
h1{font-family:var(--display);font-weight:400;font-size:clamp(28px,5.5vw,46px);line-height:1.4;margin:0 0 28px;text-wrap:balance}
details{border-radius:18px;overflow:hidden;border:1px solid var(--line);background:var(--surface)}
summary{list-style:none;cursor:pointer;padding:22px;text-align:center;font-weight:700;letter-spacing:.06em;color:var(--frost-ink);
background:linear-gradient(125deg,var(--frost-a),var(--frost-b) 46%,var(--frost-c) 54%,var(--frost-b))}
summary::-webkit-details-marker{display:none}
details[open] summary{display:none}
.ans{margin:0;padding:22px 24px;font-family:var(--display);font-size:clamp(22px,4vw,30px);color:var(--ice);animation:thaw .8s cubic-bezier(.16,1,.3,1)}
@keyframes thaw{from{opacity:0;filter:blur(8px)}}
.acts{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:12px 20px;border-radius:999px;font-weight:700;font-size:15px;text-decoration:none;border:0;cursor:pointer;font-family:inherit}
.btn-primary{background:var(--ink);color:var(--bg)}
.btn-line{box-shadow:inset 0 0 0 1.5px var(--line);background:transparent;color:var(--ink)}
.btn-line:hover{box-shadow:inset 0 0 0 1.5px var(--ink)}
h2{font-size:20px;margin:64px 0 14px;font-weight:900;letter-spacing:-.02em}
.list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.list a{display:flex;gap:12px;align-items:baseline;padding:14px 16px;border-radius:14px;border:1px solid var(--line);background:var(--surface);text-decoration:none;transition:border-color .2s}
.list a:hover{border-color:var(--ice-2)}
.list small{font-family:var(--mono);color:var(--muted);flex:none}
.pager{display:flex;justify-content:space-between;gap:12px;margin-top:40px;font-size:14px}
.pager a{text-decoration:none;color:var(--muted)}
.pager a:hover{color:var(--ink)}
footer{padding-block:48px;font-size:13px;color:var(--muted);border-top:1px solid var(--line);margin-top:48px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
"""

LOGO = ('<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6 56 19v26L32 58 8 45V19z" fill="#86cdee"/>'
        '<path d="M32 6 56 19 32 32 8 19z" fill="#e6f6fd"/><path d="M32 32v26L8 45V19z" fill="#4ea6d4"/></svg>')

FAVICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath d='M32 6 56 19v26L32 58 8 45V19z' fill='%2386cdee'/%3E"
           "%3Cpath d='M32 6 56 19 32 32 8 19z' fill='%23e6f6fd'/%3E%3Cpath d='M32 32v26L8 45V19z' fill='%235ab0dc'/%3E%3C/svg%3E")


def og_tags(img_url, alt):
    if not img_url:
        return '<meta name="twitter:card" content="summary">'
    return (f'<meta property="og:image" content="{img_url}">\n'
            f'<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n'
            f'<meta property="og:image:alt" content="{esc(alt)}">\n'
            f'<meta name="twitter:card" content="summary_large_image">\n<meta name="twitter:image" content="{img_url}">')


def head(title, desc, url, extra="", img_url=None):
    return f"""<!DOCTYPE html>
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article">
<meta property="og:locale" content="zh_TW">
<meta property="og:site_name" content="冷笑話製冰所">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}">
{og_tags(img_url, title)}
<link rel="icon" href="{FAVICON}">
<script>try{{const t=localStorage.getItem("icefactory:theme");if(t==='"light"'||t==='"dark"')document.documentElement.dataset.theme=JSON.parse(t)}}catch(e){{}}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Huninn&family=Noto+Sans+TC:wght@400;700;900&family=JetBrains+Mono:wght@400;600&display=swap">
<style>{PAGE_CSS}</style>
{extra}
</head>
<body>
<header class="wrap top"><a href="/">{LOGO}<span>冷笑話製冰所</span></a></header>
"""


def related(j, jokes, k=6):
    same = [x for x in jokes if x["cat"] == j["cat"] and x["id"] != j["id"]]
    same.sort(key=lambda x: (abs(x["id"] - j["id"])))
    return same[:k]


def build_page(j, jokes):
    n = len(jokes)
    url = f"{SITE}j/{j['id']}/"
    title = f"{j['q']}｜{j['cat']}冷笑話｜冷笑話製冰所"
    desc = f"冷笑話：{j['q']} 答案是「{j['a']}」。冷度 {fmt(j['t'])}，冷笑話製冰所收錄 {n} 則冷笑話、諧音梗與腦筋急轉彎。"
    crumbs = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "冷笑話製冰所", "item": SITE},
            {"@type": "ListItem", "position": 2, "name": f"{j['cat']}冷笑話 {j['no']}", "item": url},
        ],
    }
    extra = '<script type="application/ld+json">' + json.dumps(crumbs, ensure_ascii=False) + "</script>"
    prev_j = jokes[(j["id"] - 2) % n]
    next_j = jokes[j["id"] % n]
    out = ROOT / "j" / str(j["id"])
    out.mkdir(parents=True, exist_ok=True)
    rel = "\n".join(
        f'<li><a href="/j/{r["id"]}/"><small>{r["no"]}</small><span>{esc(r["q"])}</span></a></li>' for r in related(j, jokes)
    )
    body = f"""<main class="wrap">
  <div class="meta"><span class="pill">{j['no']}</span><span class="pill">{esc(j['cat'])}</span><span class="pill temp">冷度 {fmt(j['t'])}</span></div>
  <h1>{esc(j['q'])}</h1>
  <details>
    <summary>❄ 敲碎冰塊看答案</summary>
    <p class="ans">{esc(j['a'])}</p>
  </details>
  <div class="acts">
    <a class="btn btn-primary" href="/j/{next_j['id']}/">下一則冷笑話 →</a>
    <button class="btn btn-line" type="button" id="rand">隨機抽一則</button>
    <button class="btn btn-line" type="button" id="share">分享給朋友</button>
  </div>
  <h2>更多{esc(j['cat'])}冷笑話</h2>
  <ul class="list">
{rel}
  </ul>
  <nav class="pager" aria-label="上一則與下一則">
    <a href="/j/{prev_j['id']}/">← {prev_j['no']} {esc(prev_j['q'][:14])}{'…' if len(prev_j['q']) > 14 else ''}</a>
    <a href="/#j{j['id']}">回到冷笑話製冰所（共 {n} 則）</a>
  </nav>
</main>
<footer class="wrap">© {datetime.date.today().year} DaqingJuan · <a href="/">冷笑話製冰所</a> · 本廠產品零笑點添加，食用後如有不適，屬正常現象。</footer>
<script>
document.getElementById("rand").addEventListener("click",()=>{{let r;do{{r=1+Math.floor(Math.random()*{n})}}while(r==={j['id']}&&{n}>1);location.href="/j/"+r+"/"}});
document.getElementById("share").addEventListener("click",async()=>{{
  const d={{title:document.title,text:{json.dumps(j['q'] + "（答案在冷笑話製冰所）", ensure_ascii=False)},url:location.href}};
  if(navigator.share){{try{{await navigator.share(d);return}}catch(e){{if(e.name==="AbortError")return}}}}
  try{{await navigator.clipboard.writeText(d.text+"\\n"+d.url);document.getElementById("share").textContent="已複製連結 ✓"}}catch(e){{}}
}});
</script>
</body>
</html>
"""
    img_url = None
    if OG:
        og.joke_image(out / "og.jpg", j, fmt)
        img_url = url + "og.jpg"
    (out / "index.html").write_text(head(title, desc, url, extra, img_url) + body, encoding="utf-8")


def build_404():
    body = """<main class="wrap">
  <div class="meta"><span class="pill">ERROR 404</span><span class="pill temp">冷度 −404°C</span></div>
  <h1>這塊冰已經融化了。</h1>
  <p>你要找的頁面不存在，可能被誰偷偷拿去做手搖飲了。</p>
  <div class="acts"><a class="btn btn-primary" href="/">回到冷笑話製冰所</a></div>
</main>
"""
    page = head("找不到這塊冰｜冷笑話製冰所", "你要找的頁面已經融化了。", SITE).replace("<head>", '<head>\n<meta name="robots" content="noindex">', 1)
    (ROOT / "404.html").write_text(page + body + "</body>\n</html>\n", encoding="utf-8")


def build_sitemap(jokes):
    urls = [f"  <url><loc>{SITE}</loc><lastmod>{TODAY}</lastmod><priority>1.0</priority></url>"]
    urls += [f"  <url><loc>{SITE}j/{j['id']}/</loc><lastmod>{TODAY}</lastmod></url>" for j in jokes]
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls) + "\n</urlset>\n", encoding="utf-8")
    (ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {SITE}sitemap.xml\n", encoding="utf-8")


def main():
    jokes = load()
    build_index(jokes)
    shutil.rmtree(ROOT / "j", ignore_errors=True)
    for j in jokes:
        build_page(j, jokes)
    build_404()
    build_sitemap(jokes)
    print(f"完成：{len(jokes)} 則笑話、{len(jokes)} 個獨立頁面、sitemap.xml、robots.txt、404.html" + ("、預覽圖" if OG else ""))


if __name__ == "__main__":
    main()
