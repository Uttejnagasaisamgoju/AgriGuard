import os
from PIL import Image, ImageDraw, ImageFont

def create_splash_screen(width, height):
    # Create base image with deep emerald background (#022c22)
    img = Image.new("RGBA", (width, height), (2, 44, 34, 255))
    draw = ImageDraw.Draw(img)

    # Gradient glow in center
    cx = width // 2
    cy = height // 2

    min_dim = min(width, height)
    leaf_size = int(min_dim * 0.28)

    # Draw radial glow
    glow_radius = int(leaf_size * 1.5)
    for r in range(glow_radius, 0, -8):
        alpha = int(35 * (1 - r / glow_radius))
        draw.ellipse(
            [(cx - r, cy - r), (cx + r, cy + r)],
            fill=(16, 185, 129, alpha)
        )

    # Draw rounded emblem background for the leaf
    emblem_radius = int(leaf_size * 0.75)
    emblem_box = [
        (cx - emblem_radius, cy - emblem_radius),
        (cx + emblem_radius, cy + emblem_radius),
    ]
    draw.rounded_rectangle(
        emblem_box,
        radius=int(emblem_radius * 0.35),
        fill=(3, 36, 28, 240),
        outline=(16, 185, 129, 140),
        width=max(2, int(min_dim * 0.008))
    )

    # Draw leaf inside emblem
    scale = (emblem_radius * 1.1) / 100
    def pt(x, y):
        return (cx + x * scale, cy + y * scale)

    leaf_poly = [
        pt(0, -42), pt(12, -32), pt(24, -18), pt(33, 2), pt(32, 22),
        pt(20, 36), pt(0, 42), pt(-18, 38), pt(-32, 24), pt(-35, 6),
        pt(-25, -16), pt(-12, -32)
    ]
    draw.polygon(leaf_poly, fill=(16, 185, 129, 255))

    # Inner highlight
    highlight_poly = [
        pt(0, -40), pt(10, -30), pt(20, -15), pt(25, 5), pt(15, 25), pt(0, 38)
    ]
    draw.polygon(highlight_poly, fill=(52, 211, 153, 220))

    # Stem and veins
    stem_w = max(2, int(min_dim * 0.012))
    draw.line([pt(0, -40), pt(-1, -15), pt(-2, 10), pt(0, 42)], fill=(2, 44, 34, 255), width=stem_w)
    vein_w = max(1, int(min_dim * 0.008))
    draw.line([pt(-1, -20), pt(14, -12)], fill=(2, 44, 34, 220), width=vein_w)
    draw.line([pt(-1, -5), pt(18, 5)], fill=(2, 44, 34, 220), width=vein_w)
    draw.line([pt(-2, 12), pt(15, 22)], fill=(2, 44, 34, 220), width=vein_w)

    return img

def main():
    res_base = r"c:\sih3\frontend\android\app\src\main\res"

    splash_targets = {
        "drawable": (480, 800),
        "drawable-port-mdpi": (320, 480),
        "drawable-port-hdpi": (480, 800),
        "drawable-port-xhdpi": (720, 1280),
        "drawable-port-xxhdpi": (960, 1600),
        "drawable-port-xxxhdpi": (1280, 1920),
        "drawable-land-mdpi": (480, 320),
        "drawable-land-hdpi": (800, 480),
        "drawable-land-xhdpi": (1280, 720),
        "drawable-land-xxhdpi": (1600, 960),
        "drawable-land-xxxhdpi": (1920, 1280),
    }

    for folder, (w, h) in splash_targets.items():
        dir_path = os.path.join(res_base, folder)
        os.makedirs(dir_path, exist_ok=True)
        splash_file = os.path.join(dir_path, "splash.png")

        img = create_splash_screen(w, h)
        img.save(splash_file, "PNG")
        print(f"Generated Android splash for {folder} ({w}x{h})")

if __name__ == "__main__":
    main()
