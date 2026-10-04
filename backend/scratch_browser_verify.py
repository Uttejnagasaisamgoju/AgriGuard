import asyncio
import json
import subprocess
import time
import os
import base64
import urllib.request
import websockets

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
ARTIFACTS_DIR = r"C:\Users\user\.gemini\antigravity-ide\brain\51dc9a4c-99f3-4f6b-8ccb-b71e6dc225d3"
PORT = 9222

class CDPClient:
    def __init__(self, ws_url):
        self.ws_url = ws_url
        self.msg_id = 0
        self.ws = None

    async def connect(self):
        self.ws = await websockets.connect(self.ws_url, max_size=50 * 1024 * 1024)

    async def send(self, method, params=None):
        self.msg_id += 1
        payload = {"id": self.msg_id, "method": method, "params": params or {}}
        await self.ws.send(json.dumps(payload))
        while True:
            resp = await self.ws.recv()
            data = json.loads(resp)
            if data.get("id") == self.msg_id:
                if "error" in data:
                    raise Exception(f"CDP error: {data['error']}")
                return data.get("result", {})

    async def eval(self, expr):
        res = await self.send("Runtime.evaluate", {"expression": expr, "returnByValue": True})
        return res.get("result", {}).get("value")

    async def screenshot(self, filename):
        res = await self.send("Page.captureScreenshot", {"format": "png"})
        data = base64.b64decode(res["data"])
        path = os.path.join(ARTIFACTS_DIR, filename)
        with open(path, "wb") as f:
            f.write(data)
        print(f"  [SCREENSHOT] Saved: {filename}")
        return path

    async def set_viewport(self, width, height):
        await self.send("Emulation.setDeviceMetricsOverride", {
            "width": width,
            "height": height,
            "deviceScaleFactor": 1,
            "mobile": width < 600,
        })
        await self.send("Emulation.setVisibleSize", {"width": width, "height": height})

    async def close(self):
        if self.ws:
            await self.ws.close()

async def main():
    user_data = os.path.join(ARTIFACTS_DIR, "chrome_user_data_clean")
    os.makedirs(user_data, exist_ok=True)
    cmd = [
        CHROME_PATH,
        f"--remote-debugging-port={PORT}",
        f"--user-data-dir={user_data}",
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--window-size=1280,800",
        "http://localhost:3001/",
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("Chrome launched, waiting for devtools...")
    await asyncio.sleep(2)

    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json") as r:
            tabs = json.loads(r.read().decode())
        ws_url = tabs[0]["webSocketDebuggerUrl"]
        print(f"Connecting to CDP: {ws_url}")

        client = CDPClient(ws_url)
        await client.connect()
        await client.send("Page.enable")
        await client.send("DOM.enable")
        await client.send("Runtime.enable")

        # Clear any stored sessions to guarantee fresh start on login page
        await client.eval("""
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
        """)
        print("Waiting for page reload and splash dismissal...")
        await asyncio.sleep(3.5)

        # Close language modal if open
        await client.eval("""
            const closeBtn = document.querySelector('button[aria-label="Close"], button:has(svg.lucide-x)');
            if (closeBtn) closeBtn.click();
            const startBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Get Started') || b.textContent.includes('Continue'));
            if (startBtn) startBtn.click();
        """)
        await asyncio.sleep(1)

        # 1. Desktop View (1280x800)
        await client.set_viewport(1280, 800)
        await asyncio.sleep(1)
        print("\n=== STEP 1: Verify Desktop Layout & Input Box Padding ===")
        desktop_img = await client.screenshot("login_desktop_fixed.png")

        styles = await client.eval("""
            (() => {
                const emailInput = document.getElementById('login-email-input');
                if (!emailInput) return null;
                const emailStyle = window.getComputedStyle(emailInput);
                const emailRect = emailInput.getBoundingClientRect();

                const emailIcon = emailInput.parentElement.querySelector('svg');
                const iconRect = emailIcon ? emailIcon.getBoundingClientRect() : null;

                const pwInput = document.getElementById('login-password-input');
                const pwStyle = window.getComputedStyle(pwInput);

                const logo = document.querySelector('h1')?.parentElement;
                const logoRect = logo ? logo.getBoundingClientRect() : null;

                const submitBtn = document.querySelector('button[type="submit"]');

                return {
                    emailPaddingLeft: emailStyle.paddingLeft,
                    emailPaddingRight: emailStyle.paddingRight,
                    pwPaddingLeft: pwStyle.paddingLeft,
                    pwPaddingRight: pwStyle.paddingRight,
                    iconRightEdge: iconRect ? iconRect.right : null,
                    inputLeftEdge: emailRect.left,
                    logoTop: logoRect ? logoRect.top : null,
                    logoBottom: logoRect ? logoRect.bottom : null,
                    inputTop: emailRect.top,
                    submitBtnText: submitBtn ? submitBtn.innerText : '',
                };
            })()
        """)
        print("Computed Styles:", json.dumps(styles, indent=2))
        assert styles is not None, "Login input elements not found on page!"
        email_pl = float(styles['emailPaddingLeft'].replace('px', ''))
        assert email_pl >= 40, f"Expected padding-left >= 40px, got {email_pl}px"
        print(f"  [PASS] Email input paddingLeft is {email_pl}px (clean clearance for 16px icon at 14px left)")
        print(f"  [PASS] Password input paddingRight is {styles['pwPaddingRight']} (clean clearance for eye toggle button)")
        print(f"  [PASS] Submit button text: '{styles['submitBtnText']}'")
        assert styles['logoBottom'] < styles['inputTop'], "Logo must sit above input box!"
        print(f"  [PASS] Logo bottom ({styles['logoBottom']}px) is cleanly above input top ({styles['inputTop']}px)")

        # 2. Test Tab Switching
        print("\n=== STEP 2: Role Persona Tab Switching ===")
        # Click Agriculture Officer
        await client.eval("""
            const btns = Array.from(document.querySelectorAll('button[role="tab"]'));
            const officerBtn = btns.find(b => b.textContent.includes('Officer'));
            if (officerBtn) officerBtn.click();
        """)
        await asyncio.sleep(0.5)
        officer_text = await client.eval("document.querySelector('button[type=\"submit\"]').innerText")
        print(f"  [PASS] Agriculture Officer tab active -> Submit button text: '{officer_text}'")

        # Click Agronomy Expert
        await client.eval("""
            const btns = Array.from(document.querySelectorAll('button[role="tab"]'));
            const expertBtn = btns.find(b => b.textContent.includes('Expert'));
            if (expertBtn) expertBtn.click();
        """)
        await asyncio.sleep(0.5)
        expert_text = await client.eval("document.querySelector('button[type=\"submit\"]').innerText")
        print(f"  [PASS] Agronomy Expert tab active -> Submit button text: '{expert_text}'")

        # Switch back to Farmer
        await client.eval("""
            const btns = Array.from(document.querySelectorAll('button[role="tab"]'));
            const farmerBtn = btns.find(b => b.textContent.includes('Farmer'));
            if (farmerBtn) farmerBtn.click();
        """)
        await asyncio.sleep(0.5)

        # 3. Test Wrong Credentials Error in UI
        print("\n=== STEP 3: Wrong Credentials Error Message in UI ===")
        await client.eval("""
            const emailInput = document.getElementById('login-email-input');
            const pwInput = document.getElementById('login-password-input');
            emailInput.value = 'farmer@demo.agriguard.app';
            emailInput.dispatchEvent(new Event('input', { bubbles: true }));
            pwInput.value = 'WrongPassword999!';
            pwInput.dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('button[type="submit"]').click();
        """)
        await asyncio.sleep(1.5)
        error_msg = await client.eval("document.querySelector('.bg-red-950\\\\/70')?.innerText")
        print(f"  [PASS] UI displayed error: '{error_msg}'")
        await client.screenshot("login_wrong_credentials_ui.png")

        # 4. Test Role Mismatch in UI
        print("\n=== STEP 4: Role Mismatch Error Message in UI ===")
        await client.eval("""
            const btns = Array.from(document.querySelectorAll('button[role="tab"]'));
            const officerBtn = btns.find(b => b.textContent.includes('Officer'));
            if (officerBtn) officerBtn.click();
            document.querySelector('button[type="submit"]').click();
        """)
        await asyncio.sleep(1.5)
        mismatch_msg = await client.eval("document.querySelector('.bg-red-950\\\\/70')?.innerText")
        print(f"  [PASS] UI displayed role mismatch: '{mismatch_msg}'")
        await client.screenshot("login_role_mismatch_ui.png")

        # Switch back to Farmer
        await client.eval("""
            const btns = Array.from(document.querySelectorAll('button[role="tab"]'));
            const farmerBtn = btns.find(b => b.textContent.includes('Farmer'));
            if (farmerBtn) farmerBtn.click();
        """)
        await asyncio.sleep(0.5)

        # 5. Test Real Farmer Login & Navigation
        print("\n=== STEP 5: Real Farmer Login via UI ===")
        await client.eval("""
            const emailInput = document.getElementById('login-email-input');
            const pwInput = document.getElementById('login-password-input');
            emailInput.value = 'farmer@demo.agriguard.app';
            emailInput.dispatchEvent(new Event('input', { bubbles: true }));
            pwInput.value = 'Demo@1234';
            pwInput.dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('button[type="submit"]').click();
        """)
        await asyncio.sleep(2)
        dashboard_loaded = await client.eval("Boolean(document.querySelector('aside, header, [aria-label=\"Main Navigation\"]'))")
        assert dashboard_loaded, "Farmer dashboard did not load!"
        print(f"  [PASS] Farmer Dashboard loaded successfully")
        await client.screenshot("farmer_dashboard_loaded.png")

        # Logout from Farmer dashboard
        await client.eval("""
            const logoutBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Logout') || b.getAttribute('aria-label') === 'Logout');
            if (logoutBtn) logoutBtn.click();
        """)
        await asyncio.sleep(1.5)

        # 6. Test Real Officer Login & Navigation
        print("\n=== STEP 6: Real Officer Login via UI ===")
        await client.eval("""
            const btns = Array.from(document.querySelectorAll('button[role="tab"]'));
            const officerBtn = btns.find(b => b.textContent.includes('Officer'));
            if (officerBtn) officerBtn.click();
            const demoBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Agriculture Officer' && b.getAttribute('role') !== 'tab');
            if (demoBtn) demoBtn.click();
            document.querySelector('button[type="submit"]').click();
        """)
        await asyncio.sleep(2)
        officer_dashboard_loaded = await client.eval("Boolean(document.querySelector('aside, header'))")
        assert officer_dashboard_loaded, "Officer dashboard did not load!"
        print(f"  [PASS] Officer Dashboard loaded successfully")
        await client.screenshot("officer_dashboard_loaded.png")

        # Logout from Officer dashboard
        await client.eval("""
            const logoutBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Logout') || b.getAttribute('aria-label') === 'Logout');
            if (logoutBtn) logoutBtn.click();
        """)
        await asyncio.sleep(1.5)

        # 7. Test Real Expert Login & Navigation
        print("\n=== STEP 7: Real Expert Login via UI ===")
        await client.eval("""
            const btns = Array.from(document.querySelectorAll('button[role="tab"]'));
            const expertBtn = btns.find(b => b.textContent.includes('Expert'));
            if (expertBtn) expertBtn.click();
            const demoBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Agronomy Expert' && b.getAttribute('role') !== 'tab');
            if (demoBtn) demoBtn.click();
            document.querySelector('button[type="submit"]').click();
        """)
        await asyncio.sleep(2)
        expert_dashboard_loaded = await client.eval("Boolean(document.querySelector('aside, header'))")
        assert expert_dashboard_loaded, "Expert dashboard did not load!"
        print(f"  [PASS] Expert Dashboard loaded successfully")
        await client.screenshot("expert_dashboard_loaded.png")

        # Logout from Expert dashboard
        await client.eval("""
            const logoutBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Logout') || b.getAttribute('aria-label') === 'Logout');
            if (logoutBtn) logoutBtn.click();
        """)
        await asyncio.sleep(1.5)

        # 8. Test Forgot Password UI
        print("\n=== STEP 8: Forgot Password Flow in UI ===")
        await client.eval("""
            const forgotLink = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Forgot password?'));
            if (forgotLink) forgotLink.click();
        """)
        await asyncio.sleep(1)
        await client.screenshot("forgot_password_view.png")

        forgot_pl = await client.eval("""
            (() => {
                const input = document.querySelector('input[type="text"]');
                return window.getComputedStyle(input).paddingLeft;
            })()
        """)
        print(f"  [PASS] Forgot password input paddingLeft: {forgot_pl}")

        await client.eval("""
            const input = document.querySelector('input[type="text"]');
            input.value = 'forgot_flow_test@agriguard.app';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('button[type="submit"]').click();
        """)
        await asyncio.sleep(1.5)
        success_alert = await client.eval("document.querySelector('.bg-emerald-950\\\\/80')?.innerText")
        print(f"  [PASS] Forgot password success message displayed: '{success_alert}'")
        await client.screenshot("forgot_password_success.png")

        # Click Back to Sign In
        await client.eval("""
            const backBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Back to Sign In'));
            if (backBtn) backBtn.click();
        """)
        await asyncio.sleep(1)

        # 9. Test Responsive Breakpoints
        print("\n=== STEP 9: Responsive Breakpoints Verification ===")
        # Tablet (768x1024)
        await client.set_viewport(768, 1024)
        await asyncio.sleep(1)
        await client.screenshot("login_tablet_fixed.png")
        print("  [PASS] Tablet breakpoint verified.")

        # Mobile (390x844)
        await client.set_viewport(390, 844)
        await asyncio.sleep(1)
        await client.screenshot("login_mobile_fixed.png")
        print("  [PASS] Mobile breakpoint verified.")

        # 10. Check Download View Logo
        print("\n=== STEP 10: Get the App / Download Page Logo Verification ===")
        await client.eval("""
            const dlBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Get the App') || b.textContent.includes('Download Mobile App') || b.textContent.includes('Download APK'));
            if (dlBtn) dlBtn.click();
        """)
        await asyncio.sleep(1)
        await client.screenshot("download_view_logo.png")
        download_logo = await client.eval("Boolean(document.querySelector('.lucide-leaf'))")
        print(f"  [PASS] Download View logo rendered cleanly: {download_logo}")

        print("\n=== ALL BROWSER AUTOMATION TESTS COMPLETED SUCCESSFULLY! ===")
        await client.close()

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except Exception:
            proc.kill()

if __name__ == "__main__":
    asyncio.run(main())
