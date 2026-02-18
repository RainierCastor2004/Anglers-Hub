TWA (Trusted Web Activity) build instructions for Angler's Hub PH

Overview

This document shows a recommended workflow to create an Android Play Store package (AAB) that wraps your hosted site using a Trusted Web Activity (TWA) via Bubblewrap.

Prerequisites (local or CI)

- Node.js (14+)
- Java JDK 11+
- Android SDK / build-tools (for local builds) or CI runner with Android setup
- A developer account on Google Play (to publish) and a Keystore for signing

1) Install Bubblewrap CLI

```bash
npm install -g @bubblewrap/cli
```

2) Initialize a TWA project (do this once locally)

Replace `https://your-site` with your hosted URL (e.g. https://aglrshub.netlify.app)

```bash
bubblewrap init --manifest=https://aglrshub.netlify.app --packageId=com.example.anglershub --name="Angler's Hub"
```

This creates a `twa-manifest.json` and supporting files in the current directory.

3) Build the unsigned AAB

```bash
bubblewrap build --manifest=twa-manifest.json --output=bundle.aab
```

4) Sign the bundle (locally)

If you already have a keystore, use the Android `apksigner` (part of build-tools) or `jarsigner`. Example using `apksigner`:

```bash
# decode base64 keystore if you have it as env var
# echo "$KEYSTORE_BASE64" | base64 --decode > release.keystore

$ANDROID_HOME/build-tools/30.0.3/apksigner sign --ks release.keystore --ks-key-alias myalias bundle.aab
```

5) Upload to Play Console

Upload the signed AAB file to Google Play Console.

CI / GitHub Actions (example)

A sample GitHub Actions workflow is provided in `.github/workflows/twa-build.yml` which demonstrates building the AAB in CI. You need to provide these repository secrets:

- `KEYSTORE_BASE64` - base64-encoded keystore file contents
- `KEYSTORE_PASSWORD` - keystore password
- `KEY_ALIAS` - key alias
- `KEY_PASSWORD` - key password

Notes & tips

- Ensure `manifest.json` on your site is valid and includes suitable `start_url`, `scope`, and `icons` (192/512).
- Bubblewrap uses your live site; make sure it's served over HTTPS and accessible by CI.
- If you prefer not to sign in CI, build the unsigned AAB and download it from CI artifacts then sign locally.

CI support in this repo

- `twa-config.json` — sample config for Bubblewrap initialization (edit before use).
- `.github/workflows/twa-build.yml` — sample GitHub Actions workflow (adjust Android API/build-tools versions if needed).

If you want, I can also scaffold the Bubblewrap `twa-manifest.json` (with your site URL and packageId) and add placeholder icons. Do you want me to generate that next?