# GFAMOUS Entertainment

A responsive, mobile-first entertainment discovery prototype for movies, TV series and music.

## Public discovery site
- Dark and gold responsive interface
- Home, Movies, TV Series, Music and My List sections
- Search and category filters
- English / Swahili interface toggle
- Locally saved favourites (browser localStorage)
- Demonstration catalogue entries clearly labelled as placeholders
- Free-to-browse, no-advertising business model information

## Creator and admin backend (new source code)
The `backend/` folder contains a separate Node.js + Express service:
- Creator Studio submission form for movies, series and music
- Rights declaration required for each submission
- Submissions are stored as `pending` in MongoDB
- Admin dashboard with server-side username/password authentication
- Admin-only approve/reject endpoints and MongoDB-backed sessions
- Public API returns approved listings only
- Rate limits, HTTPS media-link validation, restricted CORS, secure HTTP-only session cookie

**Important:** the backend source has been committed, but it is NOT deployed or connected to the GitHub Pages site yet. The admin and creator pages are not live until the backend is hosted and its environment variables are configured. No content is approved, streamed, downloaded, or paid for by this code at this stage.

### Backend deployment
1. Create a separate MongoDB database for GFAMOUS Entertainment. Do not reuse credentials from another project.
2. Create a separate Node web service using this repository, set its Root Directory to `backend`, and its start command to `npm start`.
3. Add the variables listed in `backend/.env.example` to the hosting provider's private environment settings. Generate a unique random `SESSION_SECRET` of at least 32 characters and a strong `ADMIN_PASSWORD` of at least 12 characters. Never commit real secrets.
4. Set `FRONTEND_ORIGIN` to `https://gfamous133-hub.github.io`.
5. Confirm `/health` returns `status: ok`, then test `/creator` and `/admin`.

The admin console is served from the backend origin, so its session cookie stays same-origin. Keep the database and admin credentials private.

## Run the public site locally
Open `index.html` in a modern browser.

## Run the backend locally
From the `backend/` folder, install dependencies with `npm install`, configure a private `.env` using `.env.example`, then run `npm start`.

## Deploy the public site with GitHub Pages
1. Open repository **Settings → Pages**.
2. Under Build and deployment, choose **Deploy from a branch**.
3. Select branch **main** and folder **/(root)**, then Save.

## Content rights and limitations
Only publish or sell content owned by GFAMOUS or supplied with documented distribution permission. A creator's declaration is not proof by itself; review rights evidence before approval. The current public catalogue remains a demonstration. No payment processing, paid downloads, licensed catalogue, or video/audio streaming is active.
