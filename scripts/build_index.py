#!/usr/bin/env python3
"""Rebuild the Labs and Lessons card lists from their JSON files.

Single source of truth:
  labs/labs.json        -> labs/index.html  + Labs section of index.html
  lessons/lessons.json  -> lessons/index.html + Lessons section of index.html

The order in the JSON is the display order everywhere; the home page shows
the first `home_count` items and the "All N ..." link counts every item.

Each lab keeps `screenshot.png` as its source picture. The cards show a much
lighter `screenshot.webp` made from it here (needs Pillow: pip3 install pillow).
A lab without a WebP copy still works: its card falls back to the PNG.

Usage:
  python3 scripts/build_index.py           # rewrite the HTML files, refresh WebP previews
  python3 scripts/build_index.py --check   # exit 1 if any HTML is out of date
"""
import hashlib, html, json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
esc = lambda s: html.escape(s, quote=True)


def load(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return json.load(f)


def check_files(items, base, path_of):
    missing = [path_of(i) for i in items if not os.path.exists(os.path.join(ROOT, base, path_of(i)))]
    if missing:
        raise SystemExit(f"{base}: missing files: " + ", ".join(missing))


# ---- lab previews: screenshot.png (source) -> screenshot.webp (shown on cards) ----
def make_previews(labs):
    """Write a WebP copy of every screenshot that is missing or older than its PNG."""
    todo = []
    for lab in labs:
        png = os.path.join(ROOT, "labs", lab["slug"], "screenshot.png")
        webp = png[:-4] + ".webp"
        if not os.path.exists(webp) or os.path.getmtime(png) > os.path.getmtime(webp):
            todo.append((lab["slug"], png, webp))
    if not todo:
        return []
    try:
        from PIL import Image
    except ImportError:
        print("Pillow is not installed (pip3 install pillow); these cards keep the PNG: "
              + ", ".join(slug for slug, _, _ in todo))
        return []
    for _, png, webp in todo:
        with Image.open(png) as im:
            im.convert("RGB").save(webp, "WEBP", quality=85, method=6)
    return [f"labs/{slug}/screenshot.webp" for slug, _, _ in todo]


def preview(slug):
    """Card image for a lab: the WebP copy when present, tagged with the PNG's
    hash so a replaced screenshot refreshes browser caches and fails --check
    until this script has been run again."""
    folder = os.path.join(ROOT, "labs", slug)
    with open(os.path.join(folder, "screenshot.png"), "rb") as f:
        tag = hashlib.sha1(f.read()).hexdigest()[:8]
    name = "screenshot.webp" if os.path.exists(os.path.join(folder, "screenshot.webp")) else "screenshot.png"
    return f"{slug}/{name}?v={tag}"


# ---- card templates (one per page, matching each page's existing markup) ----
def lab_page_card(lab):
    badge = f'\n        <span class="badge">{esc(lab["badge"])}</span>' if lab.get("badge") else ""
    t = esc(lab["title"])
    return (f'      <a class="block" href="/labs/{lab["slug"]}/">{badge}\n'
            f'        <h2>{t}</h2>\n'
            f'        <img src="{preview(lab["slug"])}" alt="{t} preview" loading="lazy" decoding="async">\n'
            f'      </a>\n')


def lab_group_card(group):
    """Card on the Labs page that opens a sub-list page for a group of labs."""
    t = esc(group["title"])
    n = len(group["labs"])
    cover = group.get("cover") or group["labs"][0]["slug"]
    return (f'      <a class="block group" href="/labs/{group["slug"]}/">\n'
            f'        <span class="badge">{n} labs</span>\n'
            f'        <h2>{t}</h2>\n'
            f'        <img src="{preview(cover)}" alt="{t} preview" loading="lazy" decoding="async">\n'
            f'      </a>\n')


def lab_home_card(lab):
    badge = f'<span class="badge">{esc(lab["badge"])}</span>' if lab.get("badge") else ""
    cls = "tile rel" if badge else "tile"
    return (f'        <a class="{cls}" href="/labs/{lab["slug"]}/">{badge}<img src="/labs/{preview(lab["slug"])}" alt="" loading="lazy" decoding="async">'
            f'<div class="t"><h3>{esc(lab["title"])}</h3></div></a>\n')


def lesson_alt(lesson):
    kind = "first slide preview" if lesson["file"].endswith(".html") else "first page preview"
    return lesson.get("alt") or f'{lesson["title"]} — {kind}'


def lesson_page_card(lesson):
    t = esc(lesson["title"])
    return (f'      <a class="block" href="{lesson["file"]}" target="_blank" rel="noopener">\n'
            f'        <h2>{t}</h2>\n'
            f'        <img src="thumbs/{lesson["slug"]}.jpg" alt="{esc(lesson_alt(lesson))}" loading="lazy">\n'
            f'      </a>\n')


def lesson_home_card(lesson):
    return (f'        <a class="tile lesson" href="/lessons/{lesson["file"]}"><img src="/lessons/thumbs/{lesson["slug"]}.jpg" alt="" loading="lazy">'
            f'<div class="t"><h3>{esc(lesson["title"])}</h3></div></a>\n')


def group_page(labs_page, group):
    """Build a group's sub-list page from the generated Labs page."""
    t = esc(group["title"])
    cards = "".join(lab_page_card(x).replace(f'src="{x["slug"]}/', f'src="/labs/{x["slug"]}/') for x in group["labs"])
    page = splice(labs_page, "labs", cards, "labs/index.html")
    page = page.replace("<title>Labs — PhyLab</title>", f"<title>{t} — PhyLab</title>", 1)
    page = page.replace('<h1 class="page-title">Labs</h1>', f'<h1 class="page-title">{t}</h1>', 1)
    page = page.replace('href="/" aria-label="Return to home page" title="Home"', 'href="/labs/" aria-label="Return to Labs" title="Labs"', 1)
    return page


# ---- splice generated cards between <!-- BEGIN:name --> / <!-- END:name --> ----
def splice(src, name, body, rel):
    pat = re.compile(r"(<!-- BEGIN:%s -->\n)(.*?)([ \t]*<!-- END:%s -->)" % (name, name), re.S)
    if not pat.search(src):
        raise SystemExit(f"{rel}: markers <!-- BEGIN:{name} --> / <!-- END:{name} --> not found")
    return pat.sub(lambda m: m.group(1) + body + m.group(3), src, count=1)


def main(check):
    labs = load("labs/labs.json")
    lessons = load("lessons/lessons.json")
    L, S = labs["labs"], lessons["lessons"]
    # An entry with a "labs" list is a group: a card that opens its own sub-list page.
    groups = [i for i in L if "labs" in i]
    flat = [i for i in L if "labs" not in i]
    every = flat + [x for g in groups for x in g["labs"]]
    check_files(every, "labs", lambda i: f'{i["slug"]}/index.html')
    check_files(every, "labs", lambda i: f'{i["slug"]}/screenshot.png')
    check_files(S, "lessons", lambda i: i["file"])
    check_files(S, "lessons", lambda i: f'thumbs/{i["slug"]}.jpg')
    made = [] if check else make_previews(every)

    jobs = {
        "labs/index.html": [("labs", "".join(lab_group_card(i) if "labs" in i else lab_page_card(i) for i in L))],
        "lessons/index.html": [("lessons", "".join(map(lesson_page_card, S)))],
        "index.html": [
            ("labs", "".join(map(lab_home_card, flat[: labs["home_count"]]))),
            ("lessons", "".join(map(lesson_home_card, S[: lessons["home_count"]]))),
        ],
    }
    stale = []
    for rel, parts in jobs.items():
        path = os.path.join(ROOT, rel)
        with open(path, encoding="utf-8") as f:
            old = f.read()
        new = old
        for name, body in parts:
            new = splice(new, name, body, rel)
        if rel == "index.html":
            new = re.sub(r'(href="/labs/">All )\d+( labs)', rf"\g<1>{len(every)}\g<2>", new)
            new = re.sub(r'(href="/lessons/">All )\d+( lessons)', rf"\g<1>{len(S)}\g<2>", new)
        if rel == "labs/index.html":
            labs_page = new
        if new != old:
            stale.append(rel)
            if not check:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(new)
    # Group pages: the Labs page template with the group's own title and cards.
    for g in groups:
        rel = f'labs/{g["slug"]}/index.html'
        page = group_page(labs_page, g)
        path = os.path.join(ROOT, rel)
        old = open(path, encoding="utf-8").read() if os.path.exists(path) else None
        if page != old:
            stale.append(rel)
            if not check:
                os.makedirs(os.path.dirname(path), exist_ok=True)
                with open(path, "w", encoding="utf-8") as f:
                    f.write(page)
    if check:
        if stale:
            raise SystemExit("Out of date (run python3 scripts/build_index.py): " + ", ".join(stale))
        print("Labs and lessons indexes are up to date.")
    else:
        print("Updated: " + ", ".join(stale + made) if stale or made else "Nothing to change.")


if __name__ == "__main__":
    main("--check" in sys.argv[1:])
