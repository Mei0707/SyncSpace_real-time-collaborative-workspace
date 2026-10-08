# SyncSpace

SyncSpace is a real-time collaborative workspace prototype based on the project proposal in `proposal.txt`.

This implementation now includes the Phase 1 foundation and the first collaboration backend:

- React, TypeScript, Vite, Tailwind CSS, React Router
- Zustand for persisted UI state
- TanStack Query for server-state access and mutations
- Node/Express REST API for workspaces and documents
- SQLite-backed metadata persistence in `data/syncspace.sqlite`
- TipTap rich-text editor with Yjs shared document state
- WebSocket collaboration transport with reconnect status
- Persisted Yjs snapshots in SQLite
- Responsive workspace shell with collapsible navigation
- Drag-and-drop document board with status updates
- Card actions for rename, duplicate, delete, and status changes
- Searchable document list and lazy-loaded editable document page
- Theme switching, live sync status, and active collaborator presence
- Vitest, React Testing Library, and Playwright collaboration tests

## Scripts

Use Node `22.12.0` or newer. The local API uses Node's built-in SQLite module.

```bash
npm install --legacy-peer-deps
npm run dev
npm run build
npm test
npm run test:e2e
npm run lint
```

`npm run dev` starts both the API server on port `8787` and the Vite app on port `5173`.

The browser app proxies `/api` and `/collaboration` requests through Vite during development.

## Remaining Implementation Phases

1. Move from local SQLite to PostgreSQL for deployed multi-user environments.
2. Add authentication and workspace authorization.
3. Add collaborator cursor rendering.
4. Add optimistic board mutations with rollback on API failure.
5. Add CI browser installation/cache strategy for Playwright.
