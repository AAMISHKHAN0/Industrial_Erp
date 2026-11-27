import os
from PIL import Image

src_path = os.path.join(os.path.dirname(__file__), "icon_1024.png")
im = Image.open(src_path).convert("RGBA")

sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (24, 24), (16, 16)]

frames = {}
for s in sorted(sizes, reverse=True):
    frames[s] = im.resize(s, Image.Resampling.LANCZOS)

im256 = frames[(256, 256)]
other_frames = [frames[s] for s in sorted(sizes, reverse=True) if s != (256, 256)]

ico_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "desktop", "icon.ico"))
im256.save(ico_path, format="ICO", sizes=sizes, append_images=other_frames)
print(f"Generated {ico_path} successfully")

# Also update desktop/extracted_icon_256.png
extracted_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "desktop", "extracted_icon_256.png"))
im256.save(extracted_path, format="PNG")
print(f"Updated {extracted_path} successfully")

# Verify ICO sizes and format
ico = Image.open(ico_path)
print("ICO info sizes:", ico.info.get("sizes"))
for s in sorted(sizes):
    ico.size = s
    print(f"Verified size {s}: mode={ico.mode}, size={ico.size}")
ico.close()
