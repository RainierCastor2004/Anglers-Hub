Deployment & Testing Steps — Angler's Hub PH

This file collects the exact commands and checks to finish setup, produce PNG icons, deploy and test PWA/TWA.

1) Generate PNG placeholders from bundled base64

On Windows (PowerShell):

```powershell
mkdir images\icons -ErrorAction SilentlyContinue
Get-Content images\icons\icon-192.png.b64 | Out-File -Encoding ascii tmp.b64
[System.Convert]::FromBase64String((Get-Content tmp.b64 -Raw)) | Set-Content -Encoding Byte images\icons\icon-192.png
Get-Content images\icons\icon-512.png.b64 | Out-File -Encoding ascii tmp2.b64
[System.Convert]::FromBase64String((Get-Content tmp2.b64 -Raw)) | Set-Content -Encoding Byte images\icons\icon-512.png
Remove-Item tmp.b64,tmp2.b64
```

On macOS / Linux / WSL:

```bash
chmod +x scripts/decode_icons.sh
./scripts/decode_icons.sh
```

2) Commit & push changes

```bash
git add .
git commit -m "PWA/TWA scaffolding, mobile fixes, placeholder icons"
git push origin main
```

3) Deploy

- If your repo is connected to Netlify, pushing `main` will trigger a deploy automatically.
- Alternatively, go to Netlify, create a new site from Git, and point it to this repo's `main` branch.

4) Verify manifest and service worker (Chrome desktop)

- Open site in Chrome → DevTools (F12) → Application tab.
- Under "Manifest" confirm icons, name, and `start_url`.
- Under "Service Workers" confirm the worker is registered and activated.
- Under "Cache Storage" check the cached assets.

5) Test installation on Android (Chrome)

- Open the site URL in Chrome on Android (must be HTTPS).
- If manifest + SW are valid, Chrome may show an install prompt, or use menu → Add to Home screen.

6) Test Export / Import profile

- On PC: open `Profile` → click `Export Profile` to download `*-profile.json`.
- Transfer file to phone (email, cloud, or file transfer).
- On phone: open `Profile` → `Import Profile` → select the JSON file.
- After import refresh the page; profile picture (base64) should appear.

7) Test offline behavior

- Open site to register SW and cache assets.
- Turn off network or use DevTools Network → Offline, reload page; the app shell should load from cache.

8) Build TWA locally (optional)

Prereqs: Node.js, Java JDK 11+, Android SDK/command-line tools, `@bubblewrap/cli`.

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest=https://aglrshub.netlify.app/ --packageId=com.example.anglershub --name="Angler's Hub"
bubblewrap build --manifest=twa-manifest.json --output=app.aab
```

If you want, I can help you run these steps or modify the CI workflow to run Signing and AAB creation.
