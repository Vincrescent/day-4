"""
Phase 2 — Inspect chess_set_2k.blend
Dumps full scene graph: objects, parents, transforms, meshes (polys),
materials, textures, image nodes, world, scale/orientation.
"""
import bpy
import sys
from collections import Counter

BLEND = sys.argv[-1]

bpy.ops.wm.open_mainfile(filepath=BLEND)

scene = bpy.context.scene
print("=== SCENE: %s ===" % scene.name)
print("collections:", [c.name for c in scene.collection.children])

def fmt_mat(m):
    if not m: return "None"
    parts = ["mat='%s'" % m.name]
    bsdf = None
    for n in m.node_tree.nodes:
        if n.type == 'BSDF_PRINCIPLED':
            bsdf = n
    if bsdf:
        for sock, label in [('Base Color', 'base'), ('Metallic', 'metal'), ('Roughness', 'rough'), ('Emission Color', 'emiss'), ('Normal', 'norm')]:
            inp = bsdf.inputs.get(sock)
            if inp is None: continue
            if inp.is_linked:
                src = inp.links[0].from_node
                parts.append("%s=LINK(%s:%s)" % (label, src.type, src.name[:24]))
            else:
                val = inp.default_value
                if hasattr(val, '__len__'):
                    parts.append("%s=%s" % (label, [round(x,3) for x in val]))
                else:
                    parts.append("%s=%s" % (label, round(float(val), 3)))
    return " ".join(parts)

print()
print("=== OBJECTS ===")
total_tris = 0
total_vtx = 0
name_counts = Counter()

for obj in scene.objects:
    parent = obj.parent.name if obj.parent else "-"
    loc = obj.location
    scale = obj.scale
    dim = obj.dimensions
    line = "[%s] type=%s parent=%s" % (obj.name, obj.type, parent)
    if obj.type == 'MESH':
        me = obj.data
        tris = sum(len(p.vertices) - 2 for p in me.polygons) if (me and hasattr(me.polygons, '__len__')) else 0
        total_tris += tris
        total_vtx += len(me.vertices) if me else 0
        mats = [m.name if m else "None" for m in (obj.material_slots if obj.material_slots else [])]
        line += " verts=%d tris=%d mats=%s" % (len(me.vertices) if me else 0, tris, mats)
        # unique UV channels
        line += " uv_layers=%s" % [l.name for l in me.uv_layers]
    line += " loc=(%.2f,%.2f,%.2f) scale=(%.2f,%.2f,%.2f) dim=(%.2f,%.2f,%.2f)" % (
        loc.x, loc.y, loc.z, scale.x, scale.y, scale.z, dim.x, dim.y, dim.z)
    line += " visible=%s" % (obj.hide_get() is False)
    print(line)
    # normalize name key: strip 001/002 suffixes
    import re
    base = re.sub(r'\.\d{3}$', '', obj.name)
    name_counts[base] += 1

print()
print("=== NAME BASE COUNTS ===")
for k, v in sorted(name_counts.items()):
    print("  %-40s x%d" % (k, v))

print()
print("TOTAL tris=%d verts=%d objects=%d" % (total_tris, total_vtx, len(scene.objects)))

print()
print("=== MATERIALS ===")
for m in bpy.data.materials:
    print("- " + fmt_mat(m))
    for n in m.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image:
            img = n.image
            print("    image='%s' (%dx%d) source=%s path=%s" % (
                n.image.name, img.size[0], img.size[1], getattr(n.image, 'source', '?'), img.filepath))

print()
print("=== IMAGES (all datablocks) ===")
for img in bpy.data.images:
    print("  '%s' %dx%d source=%s filepath=%s" % (img.name, img.size[0], img.size[1], getattr(img, 'source', '?'), img.filepath))

print()
print("=== WORLD ===")
w = scene.world
if w:
    print("world name:", w.name, "use_nodes:", w.use_nodes)
    for n in w.node_tree.nodes:
        print("  node:", n.type, n.name)

print()
print("=== CAMERAS/LIGHTS ===")
for obj in scene.objects:
    if obj.type in ('CAMERA', 'LIGHT'):
        print("  %s type=%s loc=(%.1f,%.1f,%.1f)" % (obj.name, obj.type, obj.location.x, obj.location.y, obj.location.z))

print()
print("DONE")
