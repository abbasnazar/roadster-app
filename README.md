# Roadster Mobile (Standalone)

This is a standalone React Native/Expo app. It does **not** ship a backend — it consumes the existing Node/Express API at
`/home/syed/Documents/clone-roadster13feb/road/server` (run separately, listens on `0.0.0.0:8080`).

## 1) Configure API

Copy `.env.example` to `.env` and pick the form that matches how you run the app:

| Runtime | `EXPO_PUBLIC_API_URL` |
| --- | --- |
| Physical device on LAN | `http://<host-lan-ip>:8080/api` (e.g. `http://10.101.13.8:8080/api`) |
| Android emulator | `http://10.0.2.2:8080/api` |
| iOS simulator / Expo web | `http://localhost:8080/api` |
| Production | `https://api.roadsterrelics.com/api` |

> On real Android/iOS devices, `localhost` points to the phone — use the host's LAN IP. Find it with `hostname -I`.

## 1a) Start the backend (in a separate terminal)

```bash
cd /home/syed/Documents/clone-roadster13feb/road/server
node index.js   # or: npm start
# -> Server running on 0.0.0.0:8080
```

## 2) Install and run

```bash
npm install
npm run android
# or
npm run ios
# or
npm start
```

### Linux: `ENOSPC` / file watchers

If Metro crashes with **ENOSPC** (not disk space), the kernel **inotify** limit is too low *or* Metro is using Node’s watcher because **Watchman** is missing.

1. Prefer **Watchman**: `sudo apt install watchman` (then `npm start` again).
2. Raise limits: `npm run fix:inotify` and run the printed `sudo sysctl …` lines.

Using **`npm start`** / **`npm run web`** (not bare `npx expo start`) runs a **Linux preflight**: it stops with instructions unless **Watchman** is installed or **inotify** limits are high enough, so you avoid a cryptic `ENOSPC` stack trace from Metro. To skip this check (e.g. CI): `EXPO_SKIP_METRO_LINUX_GUARD=1 npm start`.

## Included starter modules

- `src/navigation/AppNavigator.tsx` - app stack navigation
- `src/config/api.ts` - endpoint map + base URL
- `src/lib/http.ts` - axios client with auth token interceptor
- `src/lib/storage.ts` - persistent session helpers
- `src/screens/HomeScreen.tsx` - API health + entry point
- `src/screens/ProductsScreen.tsx` - fetch list from `/products`
- `src/screens/SignInScreen.tsx` - OTP flow using `/customer/send-otp` and `/customer/verify-otp`
- `src/theme/colors.ts` - premium dark palette + spacing tokens

## Move this folder anywhere

This app is fully standalone and does not import from your web frontend folder.
