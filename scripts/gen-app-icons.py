from PIL import Image
from pathlib import Path

public = Path("public")
src = Image.open(public / "icon-512.png").convert("RGBA")
BG = (247, 245, 240, 255)  # paper cream matching theme


def flatten(img: Image.Image, size: int, pad_ratio: float = 0.0) -> Image.Image:
    """Resize onto solid square background. pad_ratio shrinks art for maskable safe zone."""
    canvas = Image.new("RGBA", (size, size), BG)
    inset = int(size * pad_ratio)
    box = size - inset * 2
    art = img.copy()
    bbox = art.getbbox()
    if bbox:
        art = art.crop(bbox)
    art.thumbnail((box, box), Image.Resampling.LANCZOS)
    x = (size - art.width) // 2
    y = (size - art.height) // 2
    canvas.paste(art, (x, y), art)
    return canvas.convert("RGBA")


for name, size in [
    ("icon-512.png", 512),
    ("icon-192.png", 192),
    ("apple-icon.png", 180),
    ("apple-touch-icon.png", 180),
    ("favicon.png", 48),
    ("favicon-32.png", 32),
    ("favicon-16.png", 16),
]:
    out = flatten(src, size, pad_ratio=0.06)
    out.save(public / name, "PNG", optimize=True)
    print("wrote", name, out.size)

mask = flatten(src, 512, pad_ratio=0.18)
mask.save(public / "icon-512-maskable.png", "PNG", optimize=True)
print("wrote icon-512-maskable.png")

ico_sizes = [(16, 16), (32, 32), (48, 48)]
ico_imgs = [flatten(src, s[0], pad_ratio=0.06) for s in ico_sizes]
ico_imgs[0].save(
    public / "favicon.ico",
    format="ICO",
    sizes=ico_sizes,
    append_images=ico_imgs[1:],
)
print("wrote favicon.ico")
