# Archana M.S — Portfolio Website + Admin Panel

Same two-part setup as before:

1. **Public website + admin dashboard (frontend)** — static HTML/CSS/JS, hosted free on **GitHub Pages**.
2. **Admin API** — checks the PIN and publishes changes to GitHub — hosted free on **Vercel** (GitHub Pages can't run server code).

## 1. Create the GitHub repository

1. GitHub → **New repository** → name it `archana-portfolio` → **Public**.
2. Push these files (either via `git push`, or GitHub's web **Add file → Upload files**, selecting everything inside this folder).

## 2. Turn on GitHub Pages

Repo → **Settings → Pages** → **Source → GitHub Actions**. Check the **Actions** tab for a green check once it runs.

Site will be live at: `https://YOUR-USERNAME.github.io/archana-portfolio/`
Admin at: `https://YOUR-USERNAME.github.io/archana-portfolio/admin/`

## 3. Generate a session secret

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 4. Create a GitHub Personal Access Token

https://github.com/settings/personal-access-tokens/new → repository access: only this repo → **Contents: Read and write**.

## 5. Deploy the API to Vercel

1. vercel.com/new → import `archana-portfolio`.
2. Add these environment variables:

   | Key | Value |
   |---|---|
   | `GITHUB_TOKEN` | the PAT from step 4 |
   | `GITHUB_OWNER` | your GitHub username |
   | `GITHUB_REPO` | `archana-portfolio` |
   | `GITHUB_BRANCH` | `main` |
   | `ADMIN_PIN` | a PIN only you/Archana should know |
   | `SESSION_SECRET` | the string from step 3 |
   | `SITE_URL` | `https://YOUR-USERNAME.github.io/archana-portfolio` (no trailing slash) |

3. Deploy. Note the exact `.vercel.app` URL it gives you — check it on the project's **Settings → Domains** page if unsure, don't guess it.

## 6. Point the site at the API

Edit `config.js` in the repo:

```js
window.SITE_CONFIG = {
  API_BASE_URL: "https://YOUR-REAL-VERCEL-URL",
  GITHUB_REPO: "YOUR-USERNAME/archana-portfolio"
};
```

Commit. Wait 1-2 minutes for the Pages rebuild.

## 7. Test

- `/admin/` loads the PIN screen directly, including on refresh.
- Wrong PIN → rejected. Correct PIN → dashboard loads.
- Edit a field, **Preview**, then **Publish Changes** — check the repo for a new commit.
- Upload a photo, confirm it appears in `media/images/` and shows up on the live site.
- Check the site on mobile and desktop.

## Everyday use

- Edit any section from `/admin/` — nothing goes live until **Publish Changes**.
- **Media Library** tab lets you delete old/unused uploaded photos.
- To add a new month's performance to **Highlights**, open that section and click **+ Add Monthly Highlight**.
