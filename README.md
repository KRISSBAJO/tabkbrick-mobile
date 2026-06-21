# TaskBricks Mobile

Enterprise mobile client for TaskBricks. The app uses Expo, TypeScript, Expo Router, SecureStore, and generated OpenAPI types from the backend contract.

## Setup

```powershell
npm install
npm run api:generate
npm run check
npm run start
```

Set `EXPO_PUBLIC_API_URL` when running against a non-local API:

```powershell
$env:EXPO_PUBLIC_API_URL="https://api.example.com/api/v1"
npm run start
```

For an Android emulator hitting a backend on your machine, use `http://10.0.2.2:4070/api/v1`.

## Contract

Generated API types live in `src/lib/generated/openapi.ts` and are produced from:

```text
../taskbricks-be/docs/api/openapi.json
```

Do not hand-write a large client. Add small domain API modules under `src/lib/api`.

## Structure

- `app/`: Expo Router screens and workspace tab layout.
- `src/lib/api/`: small domain API modules backed by generated OpenAPI types.
- `src/lib/auth/`: SecureStore-backed native session handling.
- `src/components/ui/`: TaskBricks mobile design primitives.
