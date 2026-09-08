"""Measure candidate Kenney room GLBs: bounding box, vertex/tri count, materials."""
import bpy
import os
import sys

KIT = r"D:\CODE\30 DAYS\DAY 4\kenney_modular-dungeon-kit_1.0\Models\GLB format"
cands = ["room-small.glb", "room-small-variation.glb", "room-large.glb", "room-wide.glb"]

for cand in cands:
    path = os.path.join(KIT, cand)
    if not os.path.isfile(path):
        print(cand, "MISSING"); continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        bpy.ops.import_scene.gltf(filepath=path)
    except Exception as e:
        print(cand, "IMPORT FAIL", e); continue
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not meshes:
        print(cand, "no meshes"); continue
    import mathutils
    minv = mathutils.Vector((1e9,1e9,1e9)); maxv = mathutils.Vector((-1e9,-1e9,-1e9))
    tris = 0; verts = 0
    for o in meshes:
        bb = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
        for v in bb:
            minv.x=min(minv.x,v.x); minv.y=min(minv.y,v.y); minv.z=min(minv.z,v.z)
            maxv.x=max(maxv.x,v.x); maxv.y=max(maxv.y,v.y); maxv.z=max(maxv.z,v.z)
        tris += sum(len(p.vertices)-2 for p in o.data.polygons)
        verts += len(o.data.vertices)
    size = maxv - minv
    mats = sorted(set(m.name for o in meshes for m in o.material_slots if m))
    print(f"\n=== {cand} ===")
    print(f"  meshes={len(meshes)} verts={verts} tris={tris}")
    print(f"  bbox min=({minv.x:.2f},{minv.y:.2f},{minv.z:.2f}) max=({maxv.x:.2f},{maxv.y:.2f},{maxv.z:.2f})")
    print(f"  size (meters) = {size.x:.2f} x {size.y:.2f} x {size.z:.2f}")
    print(f"  materials={mats}")
    print(f"  file KB = {os.path.getsize(path)//1024}")
    # clear for next
    bpy.ops.wm.read_factory_settings(use_empty=True)

print("\nMEASURE_DONE")
