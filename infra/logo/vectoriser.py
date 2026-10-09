"""Construit les logos SVG Flex’Checking : texte « Flex’Checking » converti en tracés (Axiforma Heavy)."""
import re, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

SRC = sys.argv[1]
OUT = sys.argv[2]
font = TTFont('/Users/gdapa/Library/Fonts/Kastelov - Axiforma Heavy.otf')
gs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font['head'].unitsPerEm
TAILLE = 209.68
s = TAILLE / upm
# tspans de l'original : (texte, x, espacement en em)
TSPANS = [('Fl', 0, -.05), ('e', 175.92, -.07), ('x', 295.86, -.05), ('’', 412.86, -.1), ('Checking', 448.93, -.05)]
OX, OY = 306.28, 1986.31

pen_svg = SVGPathPen(gs); bounds = BoundsPen(gs)
for texte, x0, ls in TSPANS:
    x = x0
    for ch in texte:
        g = cmap[ord(ch)]
        t = (s, 0, 0, -s, OX + x, OY)
        gs[g].draw(TransformPen(pen_svg, t)); gs[g].draw(TransformPen(bounds, t))
        x += gs[g].width * s + ls * TAILLE
mot = pen_svg.getCommands()
wb = bounds.bounds  # (xmin, ymin, xmax, ymax)

src = open(SRC).read()
paths = re.findall(r'<path class="cls-1" d="([^"]+)"/>', src)
assert len(paths) == 5, len(paths)
marque = ''.join(f'<path d="{d}"/>' for d in paths)
MB = (352.44, 234.65, 1715.88, 1658.03)  # boîte du pictogramme (cadre)

# 1) logo vertical (identique à l'original, texte vectorisé)
x0, y0, x1, y1 = 300, 230, max(1720, wb[2]) + 6, wb[3] + 6
vert = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.0f} {y0:.0f} {x1-x0:.0f} {y1-y0:.0f}" fill="currentColor" role="img">'
        f'<title>Flex’Checking</title>{marque}<path d="{mot}"/></svg>')
# (logo vertical non utilisé par l'application)

# 2) logo horizontal (pictogramme à gauche, mot à droite) : mêmes proportions que l'ancien PNG
H = MB[3] - MB[1]
hm = H * 0.36 / (wb[3] - wb[1])  # échelle du mot : hauteur = 36 % du pictogramme
gap = H * 0.2
tx = MB[2] + gap - wb[0] * hm
ty = MB[1] + (H - (wb[3] - wb[1]) * hm) / 2 - wb[1] * hm
largeur = MB[2] - MB[0] + gap + (wb[2] - wb[0]) * hm
horiz = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{MB[0]:.2f} {MB[1]:.2f} {largeur:.2f} {H:.2f}" fill="currentColor" role="img">'
         f'<title>Flex’Checking</title>{marque}<path transform="matrix({hm:.5f} 0 0 {hm:.5f} {tx:.2f} {ty:.2f})" d="{mot}"/></svg>')
open(f'{OUT}/logo.svg', 'w').write(horiz)

# 3) pictogramme seul (icônes PWA, favicon)
pic = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{MB[0]:.2f} {MB[1]:.2f} {MB[2]-MB[0]:.2f} {H:.2f}" fill="currentColor" role="img">'
       f'<title>Flex’Checking</title>{marque}</svg>')
open(f'{OUT}/logo-pictogramme.svg', 'w').write(pic)
print('ratio horizontal', round(largeur / H, 4), 'mot', [round(v, 1) for v in wb])
