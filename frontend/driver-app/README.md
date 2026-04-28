# OmniGuard Driver App (Expo)

Mobile-first logistics driver app with one action per screen and offline scan queueing.

## Run

```bash
cd frontend/driver-app
npm install
npm start
```

## Navigation Flow

1. Login
2. Home (Scan CTA)
3. Scan (camera capture)
4. Capture Validation (confirm + queue)
5. Result (success/failure)
6. History (queued scans)

## Offline-First

- Captured scans are queued locally in AsyncStorage key `omniguard.driver.scanQueue`.
- Queue status is shown on Home and listed in History.
- No backend business rules are implemented in UI.

## API Integration Layer

- Axios client: `src/api/client.js`
- Driver API contracts: `src/api/types.js`
- Driver API methods: `src/api/driverApi.js`

These files define only interfaces and HTTP method wrappers.
