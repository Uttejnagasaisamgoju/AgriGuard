import os
from PIL import Image
from generate_icons import create_agriguard_icon

def main():
    res_base = r"c:\sih3\frontend\android\app\src\main\res"

    sizes = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }

    for folder, dim in sizes.items():
        dir_path = os.path.join(res_base, folder)
        if not os.path.exists(dir_path):
            continue

        # Standard icon
        icon = create_agriguard_icon(dim, is_maskable=False)
        icon.save(os.path.join(dir_path, "ic_launcher.png"), "PNG")

        # Round icon
        icon_round = create_agriguard_icon(dim, is_maskable=True)
        icon_round.save(os.path.join(dir_path, "ic_launcher_round.png"), "PNG")

        # Foreground for adaptive icons
        fg = create_agriguard_icon(dim, is_maskable=True)
        fg.save(os.path.join(dir_path, "ic_launcher_foreground.png"), "PNG")

        print(f"Updated Android {folder} ({dim}x{dim})")

    # Update app name string in strings.xml
    strings_xml = os.path.join(res_base, "values", "strings.xml")
    if os.path.exists(strings_xml):
        with open(strings_xml, "r", encoding="utf-8") as f:
            content = f.read()
        content = content.replace('<string name="app_name">frontend</string>', '<string name="app_name">AgriGuard</string>')
        content = content.replace('<string name="title_activity_main">frontend</string>', '<string name="title_activity_main">AgriGuard</string>')
        with open(strings_xml, "w", encoding="utf-8") as f:
            f.write(content)
        print("Updated Android strings.xml with AgriGuard title")

if __name__ == "__main__":
    main()
