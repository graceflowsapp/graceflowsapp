# GraceFlow — Church Ministry Scheduling

Multi-church PWA for scheduling servants: no clashing schedules, no buried group chats, and servant care that helps prevent burnout.
Any number of **independent churches** can use the same app. Each church has its own admins, roles, members, ministries and schedules, and none of it is visible to other churches.

📖 **User guide** (servants, coordinators, admins): [docs/USER_GUIDE.md](docs/USER_GUIDE.md)

**Stack:** Next.js 15 (App Router) · Tailwind CSS 4 · Firebase Auth + Firestore · Cloudinary (profile photos)

## How multi-church works
- **One login per person** (`users/{uid}`), which can belong to one or more churches (church switcher in the menu).
- **Each church** lives under `churches/{churchId}/…` → `members` (role per church), `ministries`, `services`, `assignments`, `notifications`.
- **New users** either *register a new church* (they become its Admin) or *join with an invite code* (they join as Servant).
- Admins share the code or link (`/mulai?kode=ABC123`) from **Admin → Gereja**, where they can also regenerate the code and set the church's name and default colour.
- `firestore.rules` enforces isolation: only active members of a church can read or write its data.

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000
```

With no `.env.local`, the app runs in **Demo Mode**: two unrelated sample churches are seeded into the browser's localStorage. The login screen lets you pick a role in either church, or try the full flow as a new user (register a church, or join with code `GIA123` / `KASIH1`). Use "Reset data demo" to start over.

### Test the PWA (install, offline)
The service worker is registered only in production builds:
```bash
npm run build && npm start   # http://localhost:3000 → "Install app" icon in Chrome/Edge's address bar
```
To try it on a phone on the same Wi-Fi: `npm start -- -H 0.0.0.0`, then open `http://<PC-IP>:3000`.
Installing as a PWA on a phone needs HTTPS, so deploy to Vercel or use a tunnel (e.g. `npx localtunnel --port 3000`).

## Connect Firebase (production)
1. Create a project at console.firebase.google.com → add a **Web app** → copy the config into `.env.local` (see `.env.example`).
2. **Authentication** → enable *Email/Password* and *Google*.
3. **Firestore Database** → create it (e.g. `asia-southeast2`) → paste `firestore.rules` into the Rules tab → Publish.
4. Restart the app, sign up, and choose **Daftarkan gereja**. You become that church's Admin automatically; no console editing needed.
5. Invite members from **Admin → Gereja** (code or WhatsApp link). Other churches register their own church the same way.

## Cloudinary
Settings → Upload → Upload presets → **Add unsigned preset** → put the cloud name and preset name in `.env.local`. Without them, photos are stored as small data URLs (demo only).

## Deploy (Firebase Hosting)
The app is a static export (`output: "export"`), so it runs on the free Spark plan.
```bash
npm install -g firebase-tools && firebase login   # once
npm run deploy                                    # build to out/ + deploy hosting and firestore.rules
```
Live at `https://<project-id>.web.app`. `npm start` serves the built `out/` folder locally on :3001.
Don't add server-only Next.js features (server actions, dynamic API routes, middleware), because they break the static export.

## Structure
```
src/lib/        types, store (path-based raw + church-scoped store), tenancy (create/join/switch church),
                scheduling (Smart Fill, clash detection, stats), whatsapp, upload, theme, seed
src/components/ providers (auth + live data), AppShell (navigation), duty cards, Poster, UI kit
src/app/(app)/  /  (Home) · /jadwal · /profil · /koordinator · /admin
src/app/login   login (demo role picker or Firebase)
src/app/mulai   onboarding: join with invite code / register a church
public/sw.js    service worker (offline app shell + push handler ready for FCM)
```
