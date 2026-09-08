"""Analyze the board diffuse texture: detect 8x8 checkerboard layout + two square colors.
Sample the center of each cell of an assumed 8x8 grid and report the color of each cell,
so we can tell whether the GLB board already shows a proper checkered board.
"""
from PIL import Image
import os
p = r"D:/CODE/30 DAYS/DAY 4/assets/textures/chess_set_board_diff.png"
im = Image.open(p).convert("RGB")
w,h = im.size
print("board texture", w, "x", h)
px = im.load()

def sample(x, y):
    return px[int(x), int(y)]

# Assume the board fills most of the texture with some margin.
# Sample a grid of 8x8 cells over the central region (6%..94%).
m = 0.06
x0, x1 = int(w*m), int(w*(1-m))
y0, y1 = int(h*m), int(h*(1-m))
cellw = (x1-x0)/8
cellh = (y1-y0)/8
grid = []
for r in range(8):
    row = []
    for c in range(8):
        cx = x0 + (c+0.5)*cellw
        cy = y0 + (r+0.5)*cellh
        # average a small patch
        R=G=B=0; n=0
        for dx in (-6,0,6):
            for dy in (-6,0,6):
                rr,gg,bb = sample(cx+dx, cy+dy); R+=rr; G+=gg; B+=bb; n+=1
        row.append((R//n, G//n, B//n))
    grid.append(row)

# Print as a pattern using brightness
def bright(t): return sum(t)/3
print("\nCell brightness map (L=light dark square, D=dark):")
for r in range(8):
    line = ""
    for c in range(8):
        line += "L" if bright(grid[r][c]) > 90 else "D"
    print("  ", line)

# Distinct color clusters
from collections import Counter
flat = [grid[r][c] for r in range(8) for c in range(8)]
# round to nearest 20
buckets = Counter((r//20*20, g//20*20, b//20*20) for (r,g,b) in flat)
print("\nTop color buckets (r,g,b) -> count:")
for col, cnt in buckets.most_common(6):
    print("  ", col, cnt)
print("BOARD_ANALYSIS_DONE")
