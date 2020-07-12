import os

files = []

directory = os.path.dirname(os.path.realpath(__file__))
for filename in os.listdir(directory):
    if filename.endswith(".glb") and not filename.endswith(".min.glb"):
        files.append(filename[:-4])

for i in files:
    os.system('gltf-pipeline -i ' + i + '.glb -o ' + i + '.min.glb -d --draco.compressionLevel 7 --draco.quantizePositionBits 16 --draco.unifiedQuantization true --draco.quantizeTexcoordBits 14')
