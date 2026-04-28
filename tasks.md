# OmniGuard — Task Backlog

> Generated: 2026-04-28  
> Status key: `[ ]` todo · `[/]` in-progress · `[x]` done

---

## Codebase Summary

OmniGuard is a **product authentication and supply-chain integrity platform**.  
- **Backend** — Node.js / Express, PostgreSQL, Redis, Hyperledger Fabric (stub)  
- **Web frontend** — Vanilla HTML/JS API explorer (`frontend/index.html + app.js`)  
- **Brand mobile app** — Expo React Native (`frontend/brand-app`)  
- **Driver / logistics mobile app** — Expo React Native (`frontend/driver-app`)  

The backend has a solid security layer (JWT rotation, CSRF, IP rate-limiting, audit logs, account lockout), but **there is no `app.js` / `server.js` in `Backend/`** — only `app.example.js`. Several routes, controllers, and DB schemas are stubs or missing entirely.

---

## 🔴 Critical Blockers

- [ ] **Create `Backend/app.js` from `app.example.js`** — The actual server entry point does not exist; only the annotated example exists. Wire all services, middleware, and routes exactly as documented. `P0`

- [ ] **Create `Backend/config/database.js`** — Referenced everywhere (`db.query`, `db.connect`, `db.runMigrations`, `db.end`) but the file doesn't exist. Implement pg-pool connection with migration runner. `P0`

- [ ] **Create `Backend/config/redis.js`** — Referenced by rate-limit and token-revocation services but missing. Implement ioredis or node-redis client with env config. `P0`

- [ ] **Create `Backend/config/logger.js`** — Referenced in `app.example.js` and token cleanup job. Implement pino or winston logger with JSON format and level from `LOG_LEVEL`. `P0`

- [ ] **Fix SQL syntax in migration `001_auth_security_enhancements.sql`** — Inline `INDEX ...` inside `CREATE TABLE` is MySQL-only syntax, not valid PostgreSQL. Move those to separate `CREATE INDEX` statements. `P0`

- [ ] **Add `Backend/package.json`** — No `package.json` found in `Backend/`. Add with all required dependencies: `express`, `jsonwebtoken`, `bcrypt`, `pg`, `ioredis`, `node-schedule`, `cookie-parser`, `zod`/`joi`, etc. `P0`

- [ ] **Create `.env` from `.env.example`** — Fill in `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`, `REDIS_URL`, and all required vars before any local run. `P0`

---

## 🟠 Backend — Core Feature Gaps

### Auth & Identity
- [ ] **Verify `authController.js` delegates to `AuthService`** — Confirm controller does not duplicate service logic; it should call `authService.register()`, `authService.login()`, etc. `P1`
- [ ] **Implement `GET /auth/admin/users`** — Currently returns `501 Not Implemented`. Build user-list response using `userRepository.findAll()`. `P2`
- [ ] **Implement `GET /auth/admin/audit-logs`** — Returns `501 Not Implemented`. Wire `auditLogService.getAuditLogs()` with date-range and userId filters. `P2`
- [ ] **Add SMTP email dispatch to `EmailVerificationService`** — `generateVerificationToken()` creates a token but never sends an email. Add SendGrid / Nodemailer call. `P1`
- [ ] **Add dedicated password-reset token store** — `requestPasswordReset` reuses the email-verification token flow (noted as hack in `authService.js`). Implement an isolated `password_reset_tokens` table and separate email template. `P1`

### Product & Supply Chain
- [ ] **Register `product` and `scan` routes in the app entry point** — `routes/product.js` and `routes/scan.js` are defined but never mounted. Add `/api/v1/products` and `/api/v1/scans`. `P1`
- [ ] **Create `Backend/repositories/productRepository.js`** — `ProductService` calls `findBySkuAndOrg`, `create`, `updateById` but this file doesn't exist. `P1`
- [ ] **Create `Backend/repositories/parcelRepository.js`** — `ProductService` calls `create`, `updateById` but this file doesn't exist. `P1`
- [ ] **Create full DB schema migration** — Only auth tables exist. Missing: `products`, `parcels`, `scans`, `orders`, `shipments`, `reverse_logistics_alerts`, `reverse_logistics_shipments`, `decisions`. `P1`
- [ ] **Create scan queue worker** — `ScanService.captureScan()` enqueues via `scanQueueService.enqueue()` but no background worker calls `processQueuedScan()`. Implement with BullMQ or pg-boss. `P1`
- [ ] **Create `imageStorageService`** — Called in `ScanService.processQueuedScan()` but no implementation exists. Start with local-disk storage; migrate to S3 later. `P2`
- [ ] **Wire `DecisionEngineService` to scan worker** — Fully implemented but never instantiated or called. Call it at the end of the scan queue worker once AI validation completes. `P1`
- [ ] **Integrate Hyperledger Fabric provider** — `BlockchainService` falls back to an in-memory ledger. Wire `FABRIC_*` env vars to the Fabric SDK adapter. `P3`
- [ ] **Create `Backend/repositories/decisionRepository.js`** — `DecisionEngineService` requires a `decisionStore` with `findByIdempotencyKey`, `create`, `updateById`. `P1`

### Order Tracking
- [ ] **Implement missing `orderRepository` methods** — `findByIdForCustomer`, `findTrackingTimeline`, `findByIdForLogistics`, `findByIdForUpdate` are called but likely missing from stub. `P2`
- [ ] **Add `GET /api/v1/logistics/scans/history` endpoint** — Called by driver app `driverApi.getHistory()` but no backend route exists. `P2`
- [ ] **Add `GET /api/v1/logistics/scans/:scanId/result` endpoint** — Called by driver app `driverApi.getScanResult()` but no backend route exists. `P2`
- [ ] **Add `POST /api/v1/brand/blockchain/records` endpoint** — Called by brand app `brandApi.createBlockchainRecord()` but no backend route exists. Map to product creation or add a dedicated route. `P2`

### Reverse Logistics
- [ ] **Create `Backend/repositories/reverseLogisticsRepository.js`** — `ReverseLogisticsService` calls `findAlertByDecisionKey`, `createAlert`, `updateAlert`, `createReverseShipment`, etc., but the file doesn't exist. `P1`
- [ ] **Expose Reverse Logistics via HTTP** — `ReverseLogisticsService` is complete but has no controller or route. Add admin/brand endpoints: list alerts, update alert status, list reverse shipments. `P2`

---

## 🟡 Backend — Infrastructure & Hardening

- [ ] **Add security headers middleware (Helmet.js)** — `SECURITY_HARDENING.md` recommends HSTS, X-Content-Type-Options, X-Frame-Options. Not yet applied. `P2`
- [ ] **Add Sentry integration** — `SENTRY_DSN` is in `.env.example` but no `@sentry/node` setup in code. `P2`
- [ ] **Add request correlation IDs** — No `X-Request-ID` propagated through logs or responses. Add UUID-generating middleware. `P3`
- [ ] **Enforce `requireEmailVerified()` on protected routes** — Middleware is implemented but not applied anywhere yet. `P2`
- [ ] **Deduplicate `createHttpError` utility** — Copy-pasted across 10+ service files. Extract to `Backend/utils/httpError.js`. `P3`
- [ ] **Deduplicate `isPlainObject` / `normalizeString`** — Same pattern. Extract to `Backend/utils/common.js`. `P3`
- [ ] **Add `.gitignore` for Backend** — No root-level or Backend-level `.gitignore` present. `P3`

---

## 🟢 Frontend Web (`frontend/`)

- [ ] **Verify `frontend/server.js` correctly proxies `/api/v1`** — The file exists but should be confirmed to serve the HTML explorer and forward API calls to the backend. `P1`
- [ ] **Add syntax highlighting to response panel** — Currently raw JSON text. Add Prism.js or highlight.js for better developer experience. `P3`
- [ ] **Add token auto-refresh in web explorer** — On 401 response, auto-refresh using saved `refreshToken` before displaying the error. `P3`
- [ ] **Add `GET /api/v1/scans` endpoint to explorer catalog** — List-scans endpoint missing from the endpoint catalog in `app.js`. `P3`
- [ ] **Verify `orgId` auto-population for product creation** — The `create-product` sample body omits `orgId`; the explorer should pull it from the active session. `P2`

---

## 🔵 Brand Mobile App (`frontend/brand-app`)

- [ ] **Connect `BrandLoginScreen` to auth API** — Currently calls `store.login()` with no HTTP call. Implement JWT login: `POST /api/v1/auth/login`, store tokens. `P1`
- [ ] **Add real QR/barcode decode to scan screens** — `PacketCodeScanScreen` and `ProductCodeScanScreen` set a fake timestamp string as the code. Integrate `expo-barcode-scanner` or `react-native-vision-camera`. `P1`
- [ ] **Wire `ReviewConfirmScreen` to product creation API** — Submit to `brandApi.createBlockchainRecord()` with the correct payload structure. `P1`
- [ ] **Map `brandApi.createBlockchainRecord` to correct backend endpoint** — Currently posts to `/api/v1/brand/blockchain/records`; align with the actual product route. `P1`
- [ ] **Add Bearer token to brand `apiClient`** — Confirm `frontend/brand-app/src/api/client.js` injects `Authorization: Bearer <token>` from the store. `P1`
- [ ] **Persist brand auth session in `expo-secure-store`** — Tokens are only held in Zustand (in-memory). Persist across app restarts. `P2`
- [ ] **Add error handling to all brand screens** — No `try/catch` or error state in `ReviewConfirmScreen`, `SubmissionResultScreen`. `P2`
- [ ] **Implement `SubmissionResultScreen` success/failure display** — Screen exists but result payload not verified to be rendered. `P2`
- [ ] **Add logout flow to brand app** — No logout button or screen present. `P2`

---

## 🔵 Driver Mobile App (`frontend/driver-app`)

- [ ] **Connect `LoginScreen` to auth API** — Same issue as brand: no API call on login. `P1`
- [ ] **Wire `ScanScreen` to `driverApi.submitScan()`** — Ensure actual image + scanData payload is submitted to `/api/v1/logistics/scans`. `P1`
- [ ] **Implement `CaptureValidationScreen` polling** — Should call `driverApi.getScanResult()` to poll for the async AI validation result, then navigate to `ResultScreen`. `P1`
- [ ] **Wire `HistoryScreen` to `driverApi.getHistory()`** — Likely a stub; wire to the API and render a paginated list. `P2`
- [ ] **Add Bearer token to driver `apiClient`** — Confirm `frontend/driver-app/src/api/client.js` injects auth header. `P1`
- [ ] **Persist driver session in `expo-secure-store`** — Same as brand app. `P2`
- [ ] **Add logout to driver app** — No logout flow found. `P2`
- [ ] **Audit `frontend/driver-app/src/services/`** — Directory exists but contents are unknown. Audit and wire any offline/background services. `P2`

---

## 🟣 Testing & DevOps

- [ ] **Unit tests — `AuthService`** — JWT secret validation, login flow, token rotation, account lockout, password reset (listed as required in `SECURITY_HARDENING.md`). `P1`
- [ ] **Unit tests — `AIValidationOrchestratorService`** — Analyzer registration, error handling, confidence aggregation, policy application. `P2`
- [ ] **Unit tests — `DecisionEngineService`** — PASS path (blockchain + order validated); FAIL path (reverse logistics triggered). `P2`
- [ ] **Integration test — full auth flow** — register → verify email → login → refresh → logout, covering token blacklist validation. `P1`
- [ ] **Integration test — full scan flow** — capture scan → queue job → AI validation → decision engine → blockchain write. `P2`
- [ ] **Add CI pipeline** — No `.github/workflows` exists. Add GitHub Actions: lint + unit tests + build on PR. `P2`
- [ ] **Add Docker Compose for local dev** — Services: postgres, redis, backend, web frontend. `P2`
- [ ] **Generate OpenAPI / Swagger spec** — No API docs exist. Generate from route definitions and publish via `swagger-ui-express`. `P3`
- [ ] **Load test rate-limiting** — Validate IP rate-limit middleware throttles correctly under concurrent load. `P3`

---

## Summary

| Category | Total | P0 | P1 | P2 | P3 |
|---|---|---|---|---|---|
| Critical Blockers | 7 | 7 | — | — | — |
| Backend Core | 19 | — | 12 | 7 | — |
| Backend Infra | 7 | — | 1 | 3 | 3 |
| Frontend Web | 5 | — | 1 | 1 | 3 |
| Brand App | 9 | — | 4 | 5 | — |
| Driver App | 8 | — | 4 | 4 | — |
| Testing & DevOps | 9 | — | 2 | 5 | 2 |
| **Total** | **64** | **7** | **24** | **25** | **8** |
