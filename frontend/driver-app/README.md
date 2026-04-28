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

## Brand Frontend Section

Brand flow requirement:

1. Scan product barcode/QR code.
2. Capture product image.
3. Scan packet barcode/QR code.
4. Submit all captured details in one payload to create a single blockchain block record.

Minimum UI screens:

1. Brand Login
2. Product Code Scan
3. Product Image Capture
4. Packet Code Scan
5. Review and Confirm
6. Submission Result

Suggested payload contract (API interface only):

```json
{
  "brandId": "string",
  "productCode": "string",
  "packetCode": "string",
  "productImageUri": "string",
  "capturedAt": "ISO-8601 string"
}
```

Blockchain submission contract (interface only):

- `POST /api/v1/brand/blockchain/records`
- Purpose: create one block entry containing product details, product code/QR, packet code/QR, and product image reference.

Notes:

- Keep one primary action per screen.
- Use large buttons and minimal text.
- Do not implement blockchain business logic in frontend; only call API interface.

Expo SDK: 54
