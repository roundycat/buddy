from PIL import Image
from pathlib import Path

src = Path(
    r"C:\Users\kkh00\.cursor\projects\c-Users-kkh00-OneDrive-aws-4\assets\c__Users_kkh00_AppData_Roaming_Cursor_User_workspaceStorage_ff88d8586e499ab3824c8d771045aa0a_images_ChatGPT_Image_2026__8__3_____11_12_30-c862ce4c-42c9-4e6e-9649-1c0294a0c547.png"
)
out_dir = Path(r"c:\Users\kkh00\OneDrive\바탕 화면\aws 4\public\persona")
out_dir.mkdir(parents=True, exist_ok=True)
dst = out_dir / "bedi-companion.png"

img = Image.open(src).convert("RGBA")
pixels = img.load()
w, h = img.size

for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        brightness = (r + g + b) / 3
        if r > 235 and g > 235 and b > 235:
            pixels[x, y] = (r, g, b, 0)
        elif r > 220 and g > 220 and b > 220:
            alpha = int(max(0, min(255, (245 - brightness) * 8)))
            pixels[x, y] = (r, g, b, alpha)

bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)

pad = 24
canvas = Image.new("RGBA", (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
canvas.paste(img, (pad, pad), img)
canvas.save(dst, "PNG")
print(f"saved {dst} {canvas.size}")
