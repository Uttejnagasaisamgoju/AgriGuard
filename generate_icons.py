import os
import math
from PIL import Image, ImageDraw

def create_agriguard_icon(size, is_maskable=False):
    # Base RGBA image
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Padding
    padding = size * 0.12 if is_maskable else size * 0.05
    box_size = size - (2 * padding)
    radius = box_size * 0.22 if not is_maskable else 0

    # Draw gradient background
    # Colors: dark emerald (#064e3b) to deep forest (#022c22)
    bg_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg_img)

    for y in range(size):
        ratio = y / size
        r = int(6 * (1 - ratio) + 2 * ratio)
        g = int(78 * (1 - ratio) + 44 * ratio)
        b = int(59 * (1 - ratio) + 34 * ratio)
        bg_draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # Mask for rounded rectangle if not maskable
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    if is_maskable:
        mask_draw.rectangle([(0, 0), (size, size)], fill=255)
    else:
        mask_draw.rounded_rectangle(
            [(padding, padding), (size - padding, size - padding)],
            radius=int(radius),
            fill=255
        )

    # Composite background with mask
    img.paste(bg_img, (0, 0), mask)

    # Border stroke
    if not is_maskable:
        draw.rounded_rectangle(
            [(padding, padding), (size - padding, size - padding)],
            radius=int(radius),
            outline=(16, 185, 129, 120),
            width=max(2, int(size * 0.015))
        )

    # Center coordinates for Leaf Emblem
    cx = size / 2
    cy = size / 2
    scale = (box_size * 0.65) / 100

    # Leaf body points relative to (cx, cy)
    # Scaled and translated leaf shape
    def pt(x, y):
        return (cx + x * scale, cy + y * scale)

    # Draw emerald leaf polygon with gradient approximation
    # Leaf tip: (0, -42), left bulge: (-35, 5), right bulge: (35, 10), stem: (-5, 42)
    leaf_poly = [
        pt(0, -42),
        pt(12, -32),
        pt(24, -18),
        pt(33, 2),
        pt(32, 22),
        pt(20, 36),
        pt(0, 42),
        pt(-18, 38),
        pt(-32, 24),
        pt(-35, 6),
        pt(-25, -16),
        pt(-12, -32),
    ]

    # Leaf fill (bright emerald / spring green: #10b981 / #34d399)
    draw.polygon(leaf_poly, fill=(16, 185, 129, 255))

    # Inner leaf highlight
    highlight_poly = [
        pt(0, -40),
        pt(10, -30),
        pt(20, -15),
        pt(25, 5),
        pt(15, 25),
        pt(0, 38),
    ]
    draw.polygon(highlight_poly, fill=(52, 211, 153, 220))

    # Center stem line
    stem_width = max(2, int(size * 0.025))
    draw.line([pt(0, -40), pt(-1, -15), pt(-2, 10), pt(0, 42)], fill=(2, 44, 34, 255), width=stem_width)

    # Veins
    vein_width = max(1, int(size * 0.016))
    draw.line([pt(-1, -20), pt(14, -12)], fill=(2, 44, 34, 220), width=vein_width)
    draw.line([pt(-1, -5), pt(18, 5)], fill=(2, 44, 34, 220), width=vein_width)
    draw.line([pt(-2, 12), pt(15, 22)], fill=(2, 44, 34, 220), width=vein_width)

    draw.line([pt(-1, -12), pt(-15, -4)], fill=(2, 44, 34, 220), width=vein_width)
    draw.line([pt(-2, 4), pt(-18, 14)], fill=(2, 44, 34, 220), width=vein_width)
    draw.line([pt(-1, 20), pt(-14, 28)], fill=(2, 44, 34, 220), width=vein_width)

    return img

def main():
    out_dir = r"c:\sih3\frontend\public\icons"
    os.makedirs(out_dir, exist_ok=True)

    sizes = [
        (192, "icon-192x192.png", False),
        (512, "icon-512x512.png", False),
        (512, "icon-maskable-512x512.png", True),
        (180, "apple-touch-icon.png", False),
    ]

    for size, name, maskable in sizes:
        img = create_agriguard_icon(size, is_maskable=maskable)
        dest = os.path.join(out_dir, name)
        img.save(dest, "PNG")
        print(f"Generated {dest} ({size}x{size})")

    # Also copy apple-touch-icon to public root for iOS fallback
    root_apple = r"c:\sih3\frontend\public\apple-touch-icon.png"
    img_apple = create_agriguard_icon(180, is_maskable=False)
    img_apple.save(root_apple, "PNG")
    print(f"Generated {root_apple}")

if __name__ == "__main__":
    main()
