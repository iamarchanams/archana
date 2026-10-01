# Archana M.S — Portfolio + Admin Panel

Two parts, both free:

1. **Website + admin panel** — static files on **GitHub Pages**.
2. **Admin API** (`/api` folder) — runs on **Vercel**. It checks the PIN and saves changes to GitHub.

## What you can manage from `/admin/`

| Section | You can |
|---|---|
| Home | Name, headline, tagline, profile photo, **resume PDF**, SEO |
| About / Skills | Edit text, add or remove languages and skills |
| Experience | **Add, edit, duplicate, reorder, delete** jobs, with bullet points |
| Education | Add, edit, reorder, delete |
| Certifications | Add with a **certificate image**, issuer, year, description and credential link |
| Highlights | Add each month's results with **your own numbers** (Leads, Revenue, Closings…) and an optional photo |
| Career Gallery | Add **achievement photos with a short description** and date |
| Contact | Phone, email, location, social links |
| Page layout | Show/hide and reorder whole sections |
| Media library | See and delete uploaded images and PDFs |

New items are added at the **top**, so the most recent always shows first.
Nothing goes live until you press **Publish changes**. Unpublished edits are also saved in your browser,
so a closed tab or crash won't lose them.

## Updating an existing setup

1. Replace your repo files with the files in this folder (upload everything, keeping the folder structure) and commit.
2. Vercel redeploys on its own. Check **Deployments** shows a new green build.
3. Vercel → project → Settings → Environment Variables. You need all of these:

   | Key | Value |
   |---|---|
   | `GITHUB_TOKEN` | fine-grained token, **Contents: Read and write** on this repo |
   | `GITHUB_OWNER` | `iamarchanams` |
   | `GITHUB_REPO` | `archana` |
   | `GITHUB_BRANCH` | `main` |
   | `ADMIN_PIN` | your PIN |
   | `SESSION_SECRET` | a long random string |
   | `SITE_URL` | `https://iamarchanams.github.io` |

   If you change a variable, redeploy afterwards.
4. `config.js` should point to your Vercel address and repo:

   ```js
   window.SITE_CONFIG = {
     API_BASE_URL: "https://archana-drab.vercel.app",
     GITHUB_REPO: "iamarchanams/archana"
   };
   ```
5. Open `https://iamarchanams.github.io/archana/admin/` and sign in.

### Login troubleshooting
- **"Incorrect PIN"**: the API is reachable and the PIN differs from `ADMIN_PIN`. Spaces before or after are ignored.
- **"Could not reach the admin API"**: `API_BASE_URL` is wrong, or `SITE_URL` doesn't match the site's address.
- **"…did not return a session"**: Vercel is still running the old `api/` code. Redeploy.
- Login now uses a token instead of a cookie, so it no longer breaks when the browser blocks third-party cookies.

## Photo and file limits
- Photos are shrunk automatically in the browser before upload (large phone photos are fine).
- Resume PDF: up to **3 MB**.
- After publishing, GitHub Pages takes about 1–2 minutes to show the changes.

## Site features
- Light / dark theme button (remembers the choice, follows the device setting at first visit).
- Subtle animations that switch off automatically for visitors who prefer reduced motion.
- Click any certificate, highlight or gallery photo to view it full size.
