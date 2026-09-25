import os
import subprocess
import sys
from pathlib import Path

ANDROID_SDK = Path(r"C:\Android\Sdk")
SDK_MANAGER = ANDROID_SDK / "cmdline-tools" / "latest" / "bin" / "sdkmanager.bat"
LICENSES_DIR = ANDROID_SDK / "licenses"

LICENSES = {
    "android-sdk-license": [
        "24333f8a63b6825ea9c5514f83c2829b004d1fee",
        "d56f5187479451eabf01fb78ba6edcb139229dce",
        "84831b9409646a247e3077a6616091f074ff4ee0",
        "89388a27779fa033481a443bc5d4111978add41d",
        "601085b94cd77f6b44b8674f10dc2bc8a0e78111"
    ],
    "android-sdk-preview-license": [
        "84831b9409646a247e3077a6616091f074ff4ee0"
    ],
    "android-googletv-license": [
        "601085b94cd77f6b44b8674f10dc2bc8a0e78111"
    ],
    "google-gdk-license": [
        "25de4fad127f88496014cd739f16355099dd5726"
    ],
    "mips-android-sysimage-license": [
        "e9acab587ff1529a496d66de42696300e9d64314"
    ]
}

def setup():
    LICENSES_DIR.mkdir(parents=True, exist_ok=True)
    for name, hashes in LICENSES.items():
        lic_file = LICENSES_DIR / name
        lic_file.write_text("\n".join(hashes) + "\n", encoding="utf-8")
    print("License files written.")

    env = os.environ.copy()
    env["ANDROID_HOME"] = str(ANDROID_SDK)
    env["ANDROID_SDK_ROOT"] = str(ANDROID_SDK)
    env["JAVA_HOME"] = r"C:\Program Files\Eclipse Adoptium\jdk-17.0.15.6-hotspot"

    packages = [
        "platform-tools",
        "build-tools;34.0.0",
        "platforms;android-34"
    ]

    cmd = [str(SDK_MANAGER), f"--sdk_root={ANDROID_SDK}"] + packages
    print("Installing packages:", packages)
    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env=env
    )
    # Feed lots of 'y' responses in case license prompts appear
    stdout, _ = proc.communicate(input="y\n" * 50)
    print(stdout)
    print(f"Exit code: {proc.returncode}")

if __name__ == "__main__":
    setup()
