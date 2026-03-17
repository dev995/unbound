# Cult Unbound 2026 Analytics

Static HTML + vanilla JS analytics site for the Cult Unbound Championship 2026 result set.

## 1) Fetch and normalize race data

Run from project root:

`node tools/fetchResultsData.mjs`

This generates:

- `data/participants.json`
- `data/cohorts.json`
- `data/raw/*` snapshots used during extraction

## 2) Run locally (dev)

From project root:

`npm install`

`npm start`

Open:

- `http://localhost:8080/web/index.html`

## 3) Build production bundle

`npm run build`

This creates `dist/` with everything needed for public hosting:

- `dist/web/*` (UI)
- `dist/data/*` (analytics data)
- `dist/index.html` (redirect to app)

Optional local preview of production bundle:

`npm run preview`

Open:

- `http://localhost:8080`

## 4) Deploy to GitHub Pages (public URL)

This repo includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml`.

1. Create a GitHub repository and push this project.
2. Ensure your default branch is `main`.
3. In GitHub repo settings:
   - go to **Pages**
   - set **Source** to **GitHub Actions**
4. Push to `main` (or run the workflow manually from Actions tab).
5. GitHub will publish your app to a public Pages URL.

## 5) Use the site

- Search by athlete name or bib number.
- Filter by event category.
- Click an athlete row to compare their performance:
  - vs athletes in the same event/category
  - zone/split level (ZONE 1...ZONE N) against same event/category peers
