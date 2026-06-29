# Luvia AI

Luvia is a local-first prototype for a next generation AI workspace with:

- Animated splash and liquid glass login experience
- Local account creation, passwordless-style magic link flow, and Google sign-in placeholder
- Gemini-style chat interface with saved chat history and search
- Aurora thinking animation inside text
- Image generation workspace with offline generated concept images
- CA Intermediate MCQ workspace in a separate interface
- Gems for persistent specialized assistants
- Local storage persistence with database folders reserved for future file-backed storage
- Chat export flow through the browser print/PDF dialog
- Voice input support where the browser exposes speech recognition

## Run

Open `index.html` directly in a browser, or serve this folder with any static server.

For the current local preview, use:

```text
http://127.0.0.1:4173/
```

## Current Integration Status

This first build is intentionally local and dependency-free. These items are scaffolded as working interface flows and can be connected to production services next:

- Google OAuth: replace the local Google button handler in `src/app.js` with Google Identity Services.
- GPT-5 and Gemini routing: replace `generateAiReply()` with a backend API call that securely uses model credentials.
- Advanced PDF generation: replace print export with server-side PDF templates.
- OCR and camera intelligence: connect file and camera inputs to a vision/OCR backend.
- Offline database folders: migrate local storage records into SQLite, IndexedDB sync, or encrypted file storage.
- Productivity suite integration: add authorized connectors for Docs, Drive, Gmail, and Calendar.

## Project Files

- `index.html` is the app shell.
- `styles.css` contains the liquid glass UI, aurora motion, responsive layout, and animations.
- `src/app.js` contains authentication, chat, image, MCQ, Gems, account, and export behavior.
- `data/ca-intermediate-mcqs.js` contains the starter CA Intermediate question bank.
- `database/` reserves the offline folder structure for future persisted artifacts.
