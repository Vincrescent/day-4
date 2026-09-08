"""Sample board top-surface colors using Blender's own image pixels (no PIL)."""
import bpy

BLEND = r"D:\CODE\30 DAYS\DAY 4\chess_set_2k.blend\chess_set_2k.blend"
bpy.ops.wm.open_mainfile(filepath=BLEND)

img = bpy.data.images.get("chess_set_board_diff.png")
img.reload()
W, H = img.size
px = img.pixels  # flat, row-major from bottom-left, RGBA
def sample_uv(u, v):
    u = min(0.9999, max(0.0, u)); v = min(0.9999, max(0.0, v))
    x = int(u * (W - 1)); y = int(v * (H - 1))
    i = (y * W + x) * 4
    return (px[i], px[i+1], px[i+2])

board = bpy.data.objects.get("board")
me = board.data
uvl = me.uv_layers.active.data

faces = []
umin, umax, vmin, vmax = 1, 0, 1, 0
for poly in me.polygons:
    n = poly.normal
    if abs(n.z) > 0.5:
        us = [uvl[li].uv.x for li in poly.loop_indices]
        vs = [uvl[li].uv.y for li in poly.loop_indices]
        u = sum(us)/len(us); v = sum(vs)/len(vs)
        umin=min(umin,u); umax=max(umax,u); vmin=min(vmin,v); vmax=max(vmax,v)
        col = sample_uv(u, v)
        faces.append((poly.center.z, poly.center.x, poly.center.y, u, v, col))

print("top/bottom faces:", len(faces), "UV bbox u[%.3f,%.3f] v[%.3f,%.3f]" % (umin,umax,vmin,vmax))
top_z = max(f[0] for f in faces)
top = [f for f in faces if abs(f[0]-top_z) < 0.001]
print("top faces:", len(top))
xs=[f[1] for f in top]; ys=[f[2] for f in top]
xmin,xmax,ymin,ymax=min(xs),max(xs),min(ys),max(ys)
grid=[['?']*8 for _ in range(8)]
for (z,cx,cy,u,v,col) in top:
    colx=min(7,max(0,int((cx-xmin)/(xmax-xmin+1e-6)*8)))
    coly=min(7,max(0,int((cy-ymin)/(ymax-ymin+1e-6)*8)))
    b=sum(col)/3
    grid[coly][colx]='L' if b>0.28 else 'D'
print("TOP SURFACE checker (L=light,D=dark), row0=top(y+):")
for row in reversed(grid): print("   "," ".join(row))
bb=board.bound_box
xs2=[b[0] for b in bb];ys2=[b[1] for b in bb];zs2=[b[2] for b in bb]
print("BOARD bbox x[%.3f,%.3f] y[%.3f,%.3f] z[%.3f,%.3f]"%(min(xs2),max(xs2),min(ys2),max(ys2),min(zs2),max(zs2)))
print("BOARD_UV_DONE")
