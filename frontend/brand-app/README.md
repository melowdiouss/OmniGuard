# OmniGuard Brand App (Expo)

Brand-side mobile app to capture product identity data and submit one blockchain record request.

## Run

```bash
cd frontend/brand-app
npm install
npm start
```

## Flow (One Primary Action Per Screen)

1. Brand Login
2. Product Code Scan (barcode/QR)
3. Product Image Capture
4. Packet Code Scan (barcode/QR)
5. Review and Confirm
6. Submission Result

## API Interface Layer (No Business Logic)

- Axios client: `src/api/client.js`
- Contracts: `src/api/types.js`
- API calls: `src/api/brandApi.js`

Payload contract:

```json
{
  "brandId": "string",
  "productCode": "string",
  "packetCode": "string",
  "productImageUri": "string",
  "capturedAt": "ISO-8601 string"
}
```

Endpoint contract:

- `POST /api/v1/brand/blockchain/records`

## Notes

- UI-only implementation.
- Blockchain creation is handled by backend API.
- Expo SDK: 54.
