# Devlog v2 — Setup Guide

## 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (name it whatever you want)
3. Add a **Web app** (click the `</>` icon)
4. Copy the `firebaseConfig` values into `shared/firebase-config.js`

## 2. Enable Email/Password Auth

1. Firebase Console → **Authentication** → **Get started**
2. Click **Email/Password** under Sign-in providers
3. Toggle **Enable** → Save
4. That's it. No OAuth, no Client IDs, no authorized domains.

## 3. Create Firestore Database

1. Firebase Console → **Firestore Database** → **Create database**
2. Start in **test mode**
3. Pick a region → Create

## 4. Set Security Rules

Go to Firestore → **Rules** and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/entries/{entryId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Click **Publish**.

## 5. Load the Extension

1. `chrome://extensions` → Enable Developer mode
2. Click **Load unpacked** → select this folder
3. Click the extension icon → Create an account with any email/password
4. Start writing

## Usage

- **Popup**: Quick capture — write, tag, save. Click the expand icon to open the full view.
- **Full tab**: Browse all entries, pinned entries, search, stats, and export.
- **Ctrl+Enter**: Save entry from the write view.
- **Markdown**: Entries support markdown formatting (headers, bold, code blocks, lists, etc.)
- **Tags**: Comma-separated, applied after saving.
- **Pin**: Click the pin icon on any entry to keep it at the top.
- **Export**: Download all entries as JSON or Markdown.

## GitHub

To push to GitHub:

```bash
git init
git add .
git commit -m "Devlog v2 — personal journal chrome extension"
git remote add origin https://github.com/byeadro/devlog-extension.git
git push -u origin main
```

Add a `.gitignore` to exclude `firebase/` SDK files if you want to keep the repo lean,
or just commit them since they're needed for the extension to work.
