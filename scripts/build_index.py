#!/usr/bin/env python3
"""Rebuild the Labs and Lessons card lists from their JSON files.

Single source of truth:
  labs/labs.json        -> labs/index.html  + Labs section of index.html
  lessons/lessons.json  -> lessons/index.html + Lessons section of index.html

The order in the JSON is the display order everywhere; the home page shows
the first `home_count` items and the "All N ..." link counts every item.

Usage:
  python3 scripts/build_index.py           # rewrite the HTML files
  python3 scripts/build_index.py --check   # exit 1 if any HTML is out of date
"""
import html, json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
esc = lambda s: html.escape(s, quote=True)


def load(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return json.load(f)


def check_files(items, base, path_of):
    missing = [path_of(i) for i in items if not os.path.exists(os.path.join(ROOT, base, path_of(i)))]
    if missing:
        raise SystemExit(f"{base}: missing files: " + ", ".join(missing))


# ---- card templates (one per page, matching each page's existing markup) ----
def lab_page_card(lab):
    badge = f'\n        <span class="badge">{esc(lab["badge"])}</span>' if lab.get("badge") else ""
    t = esc(lab["title"])
    return (f'      <a class="block" href="/labs/{lab["slug"]}/">{badge}\n'
            f'        <h2>{t}</h2>\n'
            f'        <img src="{lab["slug"]}/screenshot.png" alt="{t} preview" loading="lazy">\n'
            f'      </a>\n')


def lab_home_card(lab):
    badge = f'<span class="badge">{esc(lab["badge"])}</span>' if lab.get("badge") else ""
    cls = "tile rel" if badge else "tile"
    return (f'        <a class="{cls}" href="/labs/{lab["slug"]}/">{badge}<img src="/labs/{lab["slug"]}/screenshot.png" alt="" loading="lazy">'
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
    check_files(L, "labs", lambda i: f'{i["slug"]}/index.html')
    check_files(L, "labs", lambda i: f'{i["slug"]}/screenshot.png')
    check_files(S, "lessons", lambda i: i["file"])
    check_files(S, "lessons", lambda i: f'thumbs/{i["slug"]}.jpg')

    jobs = {
        "labs/index.html": [("labs", "".join(map(lab_page_card, L)))],
        "lessons/index.html": [("lessons", "".join(map(lesson_page_card, S)))],
        "index.html": [
            ("labs", "".join(map(lab_home_card, L[: labs["home_count"]]))),
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
            new = re.sub(r'(href="/labs/">All )\d+( labs)', rf"\g<1>{len(L)}\g<2>", new)
            new = re.sub(r'(href="/lessons/">All )\d+( lessons)', rf"\g<1>{len(S)}\g<2>", new)
        if new != old:
            stale.append(rel)
            if not check:
                with open(path, "w", encoding="utf-8") as f:
                    f.write(new)
    if check:
        if stale:
            raise SystemExit("Out of date (run python3 scripts/build_index.py): " + ", ".join(stale))
        print("Labs and lessons indexes are up to date.")
    else:
        print("Updated: " + ", ".join(stale) if stale else "Nothing to change.")


if __name__ == "__main__":
    main("--check" in sys.argv[1:])
