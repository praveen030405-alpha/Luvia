# Luvia Offline Database

This folder is reserved for local-first data that can later be synchronized with a server.

- `chats/` stores exported or migrated chat sessions.
- `images/` stores generated image artifacts.
- `mcqs/` stores subject-wise question banks.
- `documents/` stores PDF and OCR outputs.

The first browser build uses local storage for instant offline behavior. A later backend can replace it with SQLite, IndexedDB sync, Firebase, Supabase, Postgres, or encrypted file storage without changing the visible interface.
