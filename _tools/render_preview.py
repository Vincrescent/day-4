"""Render a preview of the chess set to confirm the look."""
import bpy
BLEND = r"D:\CODE\30 DAYS\DAY 4\chess_set_2k.blend\chess_set_2k.blend"
OUT   = r"D:\CODE\30 DAYS\DAY 4\_tools\chess_preview.png"

bpy.ops.wm.open_mainfile(filepath=BLEND)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.render.resolution_x = 1280
scene.render.resolution_y = 800
scene.render.image_settings.file_format = 'PNG'

# Add a camera at a 3/4 view above the board
cam_data = bpy.data.cameras.new('PreviewCam')
cam_data.lens = 50
cam = bpy.data.objects.new('PreviewCam', cam_data)
scene.collection.objects.link(cam)
cam.location = (0.0, -0.5, 0.35)
# point at the board center
import mathutils
target = mathutils.Vector((0, 0, 0.05))
direction = target - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
scene.camera = cam

# Add a key light
light_data = bpy.data.lights.new('Key', 'SUN')
light_data.energy = 3.0
light_data.angle = 0.5
light = bpy.data.objects.new('KeyLight', light_data)
scene.collection.objects.link(light)
light.location = (0.5, -0.3, 1.0)
light.rotation_euler = (0.5, 0.3, 0.2)

# Fill light
fill_data = bpy.data.lights.new('Fill', 'SUN')
fill_data.energy = 1.0
fill = bpy.data.objects.new('FillLight', fill_data)
scene.collection.objects.link(fill)
fill.location = (-0.5, 0.3, 0.8)
fill.rotation_euler = (0.8, -0.3, 0.2)

# Slight warm world
world = scene.world
world.node_tree.nodes['Background'].inputs[0].default_value = (0.02, 0.015, 0.01, 1.0)

scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("RENDERED:", OUT)
