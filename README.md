# Angler's Hub PH — Static Demo

This is a small client-side demo for Angler's Hub PH. It uses only static HTML/CSS/JS and stores data in the browser's `localStorage` (accounts, posts, friends, notifications, conversations).

Important notes
- All user data (accounts, profile photos, posts, conversations) are stored locally in the browser's `localStorage` as JSON and data-URLs. This is a demo only — not secure or persistent across devices.
- Large images stored as data-URLs may make localStorage large and slow; consider a server or external storage for production.

Deploying to GitHub Pages
1. Initialize a git repo and commit the project (run from project root):

```bash
# from Windows PowerShell or cmd
cd "c:\Users\Rai_Nier\Desktop\Angler hub"
git init
git add .
git commit -m "Initial Angler's Hub PH demo"
```

2. Create a GitHub repository (either via the website or with the GH CLI):

```bash
# using GitHub CLI (optional)
gh repo create your-username/angler-hub --public --source=. --push
```

If you prefer the website: create a new repo and follow instructions to add remote and push.

3. Push to GitHub (if you didn't use `gh repo create`):

```bash
git remote add origin https://github.com/<your-username>/angler-hub.git
git branch -M main
git push -u origin main
```

4. Enable GitHub Pages:
- Go to your repo on GitHub → Settings → Pages → Source: `main` branch / `/ (root)` → Save.
- After a minute, your site will be available at `https://<your-username>.github.io/angler-hub/`.

Alternative: publish using `gh` (GitHub CLI):
```bash
gh repo create <your-username>/angler-hub --public --source=. --push
gh pages publish --branch main --path ./
```

Local testing
- Open `index.html` in a browser (double-click) to test locally.
- For a simple static server (recommended), run:

```bash
# if you have Python 3
python -m http.server 8000
# then open http://localhost:8000
```

Caveats before publishing
- All account data is client-side only — consider adding a backend if you need real accounts.
- Large base64 images increase repo size if you commit them — in this demo profile/post images are kept in localStorage, not committed.

If you want, I can also:
- Create a `.github/workflows` workflow to automatically deploy on push.
- Help create a GitHub repo and push from this machine (you must provide credentials / authorize `gh`).

Enjoy — tell me if you want me to add a deployment workflow or create the repo for you.
