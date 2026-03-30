# /devlog

Personal journal and dev log as a Chrome extension. Write everything, tag it, search it, export it.

## Features

- **Quick capture popup** — click the icon, write, save
- **Full tab view** — sidebar nav with write, feed, pinned, search, stats, export
- **Email/password auth** — simple Firebase auth, no OAuth hassle
- **Markdown rendering** — headers, bold, italic, code blocks, lists, blockquotes
- **Tagging** — comma-separated tags, filter by tag in feed
- **Pin entries** — keep important entries at the top
- **Search** — real-time search across all entries
- **Stats** — total entries, words, avg words/entry, top tags
- **Export** — download everything as JSON or Markdown
- **Word count** — live word count while writing
- **Timestamps** — full date and time on every entry
- **Ctrl+Enter** — keyboard shortcut to save

## Stack

- Chrome Extension (Manifest V3)
- HTML, CSS, Vanilla JavaScript
- Firebase Auth (email/password)
- Cloud Firestore

## Setup

See [SETUP.md](SETUP.md) for Firebase configuration instructions.

## Built by

Adrian Bond — [@iambond](https://substack.com/@iambond) — Made Without Instructions
