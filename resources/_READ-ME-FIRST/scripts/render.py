#!/usr/bin/env python3
"""Render a lesson HTML deck to an exact 960x540pt (16:9) PDF, plus a thumbnail.

Usage:
    python3 render.py <deck.html> <out.pdf> [--thumb <thumb.jpg>]

Two stages:
1. Math preprocessing. Any LaTeX math written in the deck as a custom tag is
   rendered to a real-LaTeX SVG and inlined before layout:
       <m>I_g</m>              inline math (default ink colour)
       <m c="d2552f">I_g</m>   inline math in a house colour (hex, no #)
       <md>U_g = I_g R_g</md>  display math (centred block, larger)
       <md c="2f5d4f">...</md>  display math in colour
   Write the maths in LaTeX (so `I_g`, `\dfrac{U}{I_g}`, `\mu`, `\Omega`, …),
   never as plain underscores. Size is controlled by the .math-inline /
   .math-display CSS in the template.
2. PDF render with WeasyPrint. The HTML's @page must be `size:1280px 720px;
   margin:0`, which renders to 960x540pt at 96dpi. Google Fonts embed
   automatically.

Requires WeasyPrint (`pip install weasyprint --break-system-packages`), plus
`latex` + `dvisvgm` (TeX Live) for the maths, and `pdftoppm` for the thumbnail.
"""
import argparse
import html as html_mod
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from render_math import render_tex  # noqa: E402

try:
    from weasyprint import HTML
except ImportError:
    sys.exit("WeasyPrint not installed. Run: pip install weasyprint --break-system-packages")

_TAG = re.compile(r"<(m|md)(?:\s+c=\"([0-9a-fA-F]{6})\")?\s*>(.*?)</\1>", re.S)


def preprocess_math(doc: str) -> str:
    cache: dict = {}

    def sub(match: "re.Match") -> str:
        tag, color, body = match.group(1), match.group(2), match.group(3)
        body = html_mod.unescape(body).strip()
        color = color or "1c2b25"
        display = tag == "md"
        key = (body, color, display)
        if key not in cache:
            cache[key] = render_tex(body, color=color, display=display)
        return cache[key]

    return _TAG.sub(sub, doc)


def make_thumb(pdf: Path, thumb: Path, dpi: int = 96):
    thumb.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["pdftoppm", "-jpeg", "-r", str(dpi), "-f", "1", "-l", "1",
         "-singlefile", str(pdf), str(thumb.with_suffix(""))],
        check=True,
    )
    print(f"thumbnail -> {thumb}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("html")
    ap.add_argument("pdf")
    ap.add_argument("--thumb")
    ap.add_argument("--thumb-dpi", type=int, default=96)
    a = ap.parse_args()

    src = Path(a.html).resolve()
    doc = preprocess_math(src.read_text(encoding="utf-8"))

    pdf = Path(a.pdf)
    pdf.parent.mkdir(parents=True, exist_ok=True)
    # base_url = the HTML's folder so relative <img src> and fonts resolve
    HTML(string=doc, base_url=str(src.parent)).write_pdf(str(pdf))
    print(f"pdf -> {pdf}")

    if a.thumb:
        make_thumb(pdf, Path(a.thumb), a.thumb_dpi)


if __name__ == "__main__":
    main()
