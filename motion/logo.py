#!/usr/bin/env python3
"""
Génère le logo Time Weave en SVG (symbole tissé + mot-symbole « timeweave » vectorisé).

Le mot-symbole est converti en tracés à partir d'Inter (fontTools), pour que le SVG
s'affiche à l'identique sans police installée. Sorties dans docs/assets/ :
logo.svg (fond clair), logo-dark.svg (fond sombre), mark.svg (symbole seul).

    pip install fonttools
    python3 motion/logo.py [chemin/vers/Inter-SemiBold.otf chemin/vers/Inter-Regular.otf]
"""
import os
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "docs", "assets")
SEMIBOLD = sys.argv[1] if len(sys.argv) > 2 else "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
REGULAR = sys.argv[2] if len(sys.argv) > 2 else "/usr/share/fonts/opentype/inter/Inter-Regular.otf"

# Brins du symbole (grille 24 × 24), identiques à la fin du film
STRANDS = [[(3, 5), (8, 5), (14, 19), (19, 19)], [(3, 12), (8, 12), (14, 5), (19, 5)], [(3, 19), (8, 19), (14, 12), (19, 12)]]
THEMES = {
    "logo": {"strands": ["#4772E9", "#3E9C68", "#8C74CF"], "time": "#222832", "weave": "#646C79"},
    "logo-dark": {"strands": ["#7B9CF5", "#5CBF86", "#A48FE0"], "time": "#E6E9EF", "weave": "#8E97A6"},
}
SIZE, TRACK, MARK_S, GAP = 104, -4, 7.4, 40


def word(path, text, x, baseline):
    font = TTFont(path)
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    upm = font["head"].unitsPerEm
    k = SIZE / upm
    pen = SVGPathPen(gs)
    for ch in text:
        name = cmap[ord(ch)]
        gs[name].draw(TransformPen(pen, (k, 0, 0, -k, x, baseline)))
        x += gs[name].width * k + TRACK
    return pen.getCommands(), x - TRACK


def strands_svg(colors, tx=0.0, ty=0.0):
    out = []
    for pts, col in zip(STRANDS, colors):
        d = " ".join(("M" if i == 0 else "L") + f"{(px - 2) * MARK_S + tx:.2f} {py * MARK_S + ty:.2f}" for i, (px, py) in enumerate(pts))
        out.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{2.1 * MARK_S:.2f}" stroke-linecap="round" stroke-linejoin="round"/>')
    return "\n  ".join(out)


def main():
    os.makedirs(OUT, exist_ok=True)
    pad = 2.1 * MARK_S / 2 + 2
    cy = 12 * MARK_S  # milieu vertical du symbole
    font = TTFont(SEMIBOLD)
    hh = font["hhea"]
    middle = (hh.ascent + hh.descent) / 2 / font["head"].unitsPerEm * SIZE  # comme textBaseline « middle »
    baseline = cy + middle + 2
    x0 = 22 * MARK_S + GAP
    d_time, x1 = word(SEMIBOLD, "time", x0, baseline)
    d_weave, x2 = word(REGULAR, "weave", x1, baseline)
    vx, vy, vw, vh = -pad, 5 * MARK_S - pad - 6, x2 + pad + 6, 14 * MARK_S + 2 * pad + 12
    for name, th in THEMES.items():
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vx:.1f} {vy:.1f} {vw:.1f} {vh:.1f}" width="{vw * 0.5:.0f}" height="{vh * 0.5:.0f}" role="img" aria-label="Time Weave">
  <title>Time Weave</title>
  {strands_svg(th["strands"])}
  <path d="{d_time}" fill="{th["time"]}"/>
  <path d="{d_weave}" fill="{th["weave"]}"/>
</svg>
'''
        with open(os.path.join(OUT, f"{name}.svg"), "w") as f:
            f.write(svg)
    m = 24 * MARK_S
    mark = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {m:.1f} {m:.1f}" width="96" height="96" role="img" aria-label="Time Weave">
  <title>Time Weave</title>
  <rect width="{m:.1f}" height="{m:.1f}" rx="{5 * MARK_S:.1f}" fill="#FFFFFF"/>
  {strands_svg(THEMES["logo"]["strands"], tx=2 * MARK_S, ty=0)}
</svg>
'''
    with open(os.path.join(OUT, "mark.svg"), "w") as f:
        f.write(mark)
    print("docs/assets/logo.svg, logo-dark.svg, mark.svg")


if __name__ == "__main__":
    main()
