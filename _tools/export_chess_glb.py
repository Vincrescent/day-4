"""
Phase 2 — Export chess_set_2k.blend to a clean, optimized GLB for Three.js.

Steps:
  - Open the blend
  - Select all mesh objects in the chess_set collection
  - Apply all transforms (so baked positions/scales are stable in glTF)
  - Re-normalize object names to a stable scheme: piece_<type>_<color>[_<idx>]
  - Export a single binary GLB with embedded 2K PBR textures
  - Verify the output (size, object count)
"""
import bpy
import sys
import re
import os
import json

BLEND = r"D:\CODE\30 DAYS\DAY 4\chess_set_2k.blend\chess_set_2k.blend"
OUT   = r"D:\CODE\30 DAYS\DAY 4\assets\models\chess_set.glb"

# type/color normalization map (names already follow this, but be safe)
def normalize(name):
    # piece_pawn_white_03 -> piece_pawn_white_03 (already good)
    n = name.lower().strip()
    m = re.match(r'^piece_(king|queen|rook|bishop|knight|pawn)_(white|black)(_\d+)?$', n)
    if m:
        return "piece_%s_%s%s" % (m.group(1), m.group(2), m.group(3) or "")
    return n

def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    scene = bpy.context.scene

    # Collect mesh objects
    meshes = [o for o in scene.objects if o.type == 'MESH']
    print("mesh objects found:", len(meshes))

    # Select only meshes, make none active first
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)

    # Apply transforms (location stays; we mainly want scale/rotation baked).
    # Pieces have unit scale & no rotation, board too. Applying is safe.
    with bpy.context.temp_override(selected_objects=meshes, active_object=meshes[0]):
        try:
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        except Exception as e:
            print("transform_apply note:", e)

    # Normalize names
    seen = {}
    for o in meshes:
        base = normalize(o.name)
        # ensure uniqueness
        if base in seen:
            seen[base] += 1
            new = "%s_%d" % (base, seen[base])
        else:
            seen[base] = 1
            new = base
        o.name = new
        o.data.name = new

    print("renamed objects:")
    for o in sorted(meshes, key=lambda x: x.name):
        print("  ", o.name, "| tris=",
              sum(len(p.vertices) - 2 for p in o.data.polygons))

    # Export binary GLB, embed everything
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format='GLB',
        use_selection=True,
        export_apply=True,            # apply modifiers
        export_yup=True,             # convert Z-up -> Y-up for glTF
        export_materials='EXPORT',
        export_image_format='AUTO',  # keep PNG
        export_extras=True,
        export_skins=False,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_draco_mesh_compression_enable=False,
    )

    size = os.path.getsize(OUT)
    print("GLB written:", OUT, "size_bytes=", size,
          "size_MB=%.2f" % (size / (1024*1024)))

    # Emit a manifest the runtime can read
    manifest = {
        "source": os.path.basename(BLEND),
        "object_count": len(meshes),
        "names": sorted(o.name for o in meshes),
        "materials": sorted(m.name for m in bpy.data.materials if m.name.startswith("chess_set")),
        "board_size_m": 0.55,
    }
    with open(os.path.join(os.path.dirname(OUT), "chess_set.manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print("manifest written")
    print("EXPORT_DONE")

main()
