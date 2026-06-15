#!/usr/bin/env python3
"""Render LaTeX math to a clean, CSS-sizable inline SVG.

Real LaTeX (Computer Modern) via `latex` + `dvisvgm`, so the maths looks like a
textbook — proper italic variables, real subscripts, fractions, Greek, etc. The
output SVG has its absolute width/height stripped and a class added, so size is
driven by CSS (`height` in em/px) while the viewBox preserves the aspect ratio.

Use as a library (see build_math in render.py) or standalone:
    python3 render_math.py "U_g = I_g R_g" out.svg --display --color 1c2b25

Requires TeX Live (`latex`) and `dvisvgm`. The colour is baked in via xcolor, so
pass the house hex (no leading #) for coloured symbols.
"""
import argparse
import hashlib
import pathlib
import re
import subprocess
import tempfile

_TEX = r"""\documentclass[12pt,border=1pt]{standalone}
\usepackage{amsmath,amssymb}
\usepackage{xcolor}
\definecolor{glyph}{HTML}{%(color)s}
\begin{document}\color{glyph}%(body)s\end{document}
"""


def _cssify(svg: str, cls: str) -> str:
    svg = re.sub(r"<\?xml[^>]*\?>\s*", "", svg)
    svg = re.sub(r"<!--.*?-->\s*", "", svg, flags=re.S)
    svg = re.sub(r"(<svg[^>]*?)\s(?:width|height)='[^']*'", r"\1", svg)
    svg = svg.replace("<svg ", f"<svg class='{cls}' ", 1)
    return svg.strip()


def render_tex(body: str, color: str = "1c2b25", display: bool = False) -> str:
    """Return an inline SVG string for a LaTeX math `body` (no $ delimiters)."""
    wrapped = (r"$\displaystyle %s$" % body) if display else (r"$%s$" % body)
    cls = "math-display" if display else "math-inline"
    with tempfile.TemporaryDirectory() as d:
        d = pathlib.Path(d)
        (d / "m.tex").write_text(_TEX % {"color": color, "body": wrapped})
        subprocess.run(
            ["latex", "-interaction=nonstopmode", "-halt-on-error", "m.tex"],
            cwd=d, check=True, capture_output=True,
        )
        subprocess.run(
            ["dvisvgm", "--no-fonts", "--exact-bbox", "--scale=1.4", "-o", "m.svg", "m.dvi"],
            cwd=d, check=True, capture_output=True,
        )
        svg = (d / "m.svg").read_text()
    return _cssify(svg, cls)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("tex")
    ap.add_argument("out")
    ap.add_argument("--display", action="store_true")
    ap.add_argument("--color", default="1c2b25")
    a = ap.parse_args()
    pathlib.Path(a.out).write_text(render_tex(a.tex, a.color, a.display))
    print(f"math -> {a.out}")


if __name__ == "__main__":
    main()
