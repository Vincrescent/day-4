import bpy, sys, math
import numpy as np

# Get scene, find knight
scene = bpy.context.scene
knight = bpy.data.objects.get('piece_knight_white_01')
if knight is None:
    for o in bpy.data.objects:
        print('OBJ:', o.name)
    sys.exit(0)

print('KNOB', knight.location[:])

# Remove other objects from view for clarity (don't delete, just hide)
for o in scene.objects:
    if o != knight:
        o.hide_set(True)

# Create top-down camera
cam_data = bpy.data.cameras.new('topcam')
cam_data.type = 'ORTHO'
cam_data.ortho_scale = 0.12
cam = bpy.data.objects.new('topcam', cam_data)
scene.collection.objects.link(cam)

# Place directly above knight center
import mathutils
center = mathutils.Vector(knight.location) + mathutils.Vector((0, 0, 0.075))
cam.location = center
cam.rotation_euler = (0, 0, 0)  # looking straight down -Z

# Rotate model? No — keep original orientation. Render and we'll infer.
scene.camera = cam
scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.film_transparent = False
# Simple bright lighting
for l in scene.objects:
    if l.type == 'LIGHT':
        l.hide_set(True)
light = bpy.data.objects.new('key', bpy.data.lights.new('key', 'SUN'))
light.data.energy = 3.0
light.rotation_euler = (math.radians(30), math.radians(20), 0)
scene.collection.objects.link(light)

scene.render.filepath = '/tmp/knight_top.png'
bpy.ops.render.render(write_still=True)
print('RENDERED /tmp/knight_top.png')
