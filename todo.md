# Tachyon Task Log

## Current Sprint: Backend Security & Performance

- [x] **Backend v2.0 Architecture**
  - [x] In-Memory Caching (`scanner.ts`)
  - [x] Chokidar File Watcher
  - [x] Server-Side Pagination
  - [x] Signed URLs (1 Year Expiry)

- [x] **Frontend Integration**
  - [x] Fix: Auth Race Condition (`Home.tsx`)
  - [x] feat: Use Signed URLs in `Reader.tsx`
  - [x] feat: Use Signed URLs in `Home.tsx`

- [x] **Verification**
  - [x] Check `sign=` parameter (Confirmed visually).
  - [x] Validate Image Loading (`loading="lazy"` confirmed present).
  - [ ] Check `sign=` parameter in browser requests matches backend signature.
  - [ ] Validate Warmup Script v10 against CDN.

## Backlog
- [ ] Auto-Deploy Workflow
- [ ] Mobile UI Polish
