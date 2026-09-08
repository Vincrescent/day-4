"""
Phase 2 (v3) — Re-export GLB with optimized textures, correct relative-path
resolution against the .blend directory.
"""
import bpy
import re
import os

BLEND = r"D:\CODE\30 DAYS\DAY 4\chess_set_2k.blend\chess_set_2k.blend"
BLEND_DIR = os.path.dirname(BLEND)
TEX   = r"D:\CODE\30 DAYS\DAY 4\assets\textures"
OUT   = r"D:\CODE\30 DAYS\DAY 4\assets\models\chess_set.glb"

def normalize(name):
    n = name.lower().strip()
    m = re.match(r'^piece_(king|queen|rook|bishop|knight|pawn)_(white|black)(_\d+)?$', n)
    return "piece_%s_%s%s" % (m.group(1), m.group(2), m.group(3) or "") if m else n

def resolve(p):
    # Blender relative '//' means relative to blend dir
    if p.startswith('//'):
        base = os.path.join(BLEND_DIR, p[2:].replace('/', os.sep))
    else:
        base = p
    return base

def main():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    scene = bpy.context.scene

    for img in bpy.data.images:
        if img.source != 'FILE' or not img.filepath:
            continue
        absold = resolve(img.filepath)
        base = os.path.basename(absold).replace("_2k", "")
        new = os.path.join(TEX, base)
        if os.path.isfile(new) and os.path.abspath(new) != os.path.abspath(absold):
            img.filepath = new
            img.filepath_raw = new
            img.source = 'FILE'
            img.reload()
            ok = os.path.isfile(img.filepath)
            print("remap:", img.name, "->", base, img.size[0], "x", img.size[1], "exists=", ok)
        else:
            print("SKIP:", img.name, "abs=", absold, "new=", new)

    # sanity: verify all images on disk
    for img in bpy.data.images:
        if img.source == 'FILE' and img.filepath:
            if not os.path.isfile(img.filepath):
                print("MISSING:", img.name, img.filepath)

    meshes = [o for o in scene.objects if o.type == 'MESH']
    print("meshes:", len(meshes))

    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    with bpy.context.temp_override(selected_objects=meshes, active_object=meshes[0]):
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    seen = {}
    for o in meshes:
        base = normalize(o.name)
        if base in seen:
            seen[base] += 1
            new = "%s_%d" % (base, seen[base])
        else:
            seen[base] = 1
            new = base
        o.name = new
        o.data.name = new

    bpy.ops.export_scene.gltf(
        filepath=OUT, export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_materials='EXPORT',
        export_image_format='AUTO', export_extras=True, export_skins=False,
        export_animations=False, export_cameras=False, export_lights=False,
        export_draco_mesh_compression_enable=False,
    )
    size = os.path.getsize(OUT)
    print("GLB:", OUT, "%.2f MB" % (size/(1024*1024)))
    print("EXPORT_DONE_V3")

main()
