# IDEX — Completed Projects CMS

Firebase-powered CMS for the "Completed Projects" section. Admin adds/edits/publishes
projects from `admin.html`; they appear automatically on `index.html` — no HTML editing
needed after setup.

## Files (keep all of these in the SAME folder)

| File | Purpose |
|---|---|
| `index.html` | Public website (Hero, About, Services, Portfolio, Completed Projects, Contact) |
| `admin.html` | Admin panel (login, dashboard, project management) |
| `admin-app.js` | Admin panel logic (auth, CRUD, image upload) |
| `public-projects.js` | Public site logic (loads + renders published projects live) |
| `firebase-config.js` | **Edit this one file** with your real Firebase project keys |
| `firestore.rules` | Firestore security rules (paste into Firebase Console) |
| `storage.rules` | Storage security rules (paste into Firebase Console) |
| `README.md` | This file |

All 5 `.html`/`.js` files must sit in the same folder — they reference each other with
relative paths like `./firebase-config.js`.

## One-time setup

### 1. Create a Firebase project
[console.firebase.google.com](https://console.firebase.google.com) → Add project → give it a name → Create.

### 2. Enable three services
- **Build → Firestore Database** → Create database → Production mode → pick a region → Enable
- **Build → Authentication** → Get started → Sign-in method tab → enable **Email/Password**
- **Build → Storage** → Get started → Production mode → same region → Enable

### 3. Register a Web App and copy the config
Project Overview page → `</>` icon → give it a nickname → Register app.
Copy the `firebaseConfig` object it shows you (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).

### 4. Paste your config into `firebase-config.js`
Open the file, replace the `YOUR_API_KEY`, `YOUR_PROJECT_ID`, etc. placeholders with
your real values. Save.

### 5. Create yourself as an admin
- Authentication tab → Add user → your email/password.
- Copy that user's **UID** from the Authentication list.
- Firestore Database → create a collection named `users` → document ID = that UID →
  add one field: `role` (string) = `admin`.

### 6. Publish the security rules
- Firestore Database → Rules tab → paste the full contents of `firestore.rules` → Publish.
- Storage → Rules tab → paste the full contents of `storage.rules` → Publish.

Without this step the app still works for you, but the data isn't actually secured.

### 7. Host the files
Any static host works (GitHub Pages, Firebase Hosting, Netlify). It must be served over
`http(s)` — opening the files directly (`file://`) will NOT work, because the scripts use
ES module imports.

**GitHub Pages:** push all 5 `.html`/`.js` files to the repo root → Settings → Pages →
select branch → Save. You'll get a URL like `username.github.io/repo-name`.

### 8. Test it
Go to `/admin.html` on your live URL → log in → **+ Add New Project** → fill in the
required fields (Name, Short Description, Category) → upload a thumbnail → turn
**Published** ON → Save. Then open `index.html` and check the project appears under
Completed Projects automatically.

## Day-to-day use (no code needed after setup)

- **Add a project:** Admin → Completed Projects → + Add New Project → fill fields →
  upload images → toggle Published → Save.
- **Edit:** click Edit on any row.
- **Publish/unpublish:** flip the Published toggle directly in the project table.
- **Feature a project:** flip the Featured toggle — it'll show in the Featured strip
  at the top of the public section.
- **Delete:** click Delete → confirm. Also removes its images from Storage.
- **Search/filter/sort:** toolbar above the project table.

## Troubleshooting

| Problem | Likely cause |
|---|---|
| Blank page / console errors | `firebase-config.js` still has placeholder values |
| "This account does not have admin access" | `/users/{uid}` doc missing, or `role` isn't exactly `admin` |
| Projects don't show on public site | Project's `published` toggle is OFF |
| Image upload fails | File isn't JPG/PNG/WebP, or is over 5MB |
| Everything works locally but not after upload | Site opened via `file://` instead of `http(s)://` — must be hosted |
