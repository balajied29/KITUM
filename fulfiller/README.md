# KitUm Partner — Fulfiller App (Expo)

The tanker-operator app: go online, receive live delivery offers (with a full-screen alarm),
accept/reject, navigate, and stream live location to the customer during a job.

## Stack
- Expo (React Native), Expo SDK 54
- `expo-location` + `expo-task-manager` — battery-aware foreground + background tracking
- `expo-notifications` — push offers (high-priority "offers" channel) when backgrounded
- `expo-av` + `Vibration` — incoming-offer alarm
- `socket.io-client` — realtime offers/location, `zustand` (persisted) for auth

## Structure
```
App.js               orchestrator: auth → socket → offer/alarm → job lifecycle → tracking
index.js             registerRootComponent
lib/
  constants.js       mirror of /shared/constants.js
  store.js           persisted auth (AsyncStorage)
  api.js             axios REST client
  socket.js          socket.io-client singleton
  notifications.js   Expo push registration + Android alarm channel
  location.js        foreground watcher + background task + REST fallback
  alarm.js           looping ringtone + vibration
screens/
  LoginScreen.js  HomeScreen.js  IncomingRequest.js  ActiveJob.js
```

## Run (dev)
```bash
npm install                 # or: npx expo install  (aligns native module versions)
cp .env.example .env        # point at your backend LAN IP (not localhost)
npx expo start              # scan QR with Expo Go (foreground features) or a dev build
```

`.env`:
```
EXPO_PUBLIC_API_URL=http://<your-LAN-ip>:5000
EXPO_PUBLIC_SOCKET_URL=http://<your-LAN-ip>:5000
```

> **Background location** (tracking while the screen is locked) and **custom alarm sounds**
> require a **dev/standalone build**, not Expo Go. Foreground tracking, offers, accept/reject,
> and the lifecycle all work in Expo Go for quick testing.

## Build & ship (EAS)
```bash
npm i -g eas-cli
eas login
eas build:configure
# put your EAS projectId into app.json → expo.extra.eas.projectId (enables push tokens)
eas build -p android        # and/or -p ios
```

Drop a short looping `assets/alarm.wav` into the build and it will be used for the Android
"offers" channel + the in-app alarm (otherwise it falls back to the default sound + vibration).

## Notes
- The app talks only to the persistent backend (Railway). Sockets can't go through the
  customer app's Next.js proxy.
- Location sampling: `IDLE` (250 m / 45 s, balanced) while waiting for offers; `ACTIVE`
  (30 m / 4 s, high accuracy) during a job. Tune in `lib/constants.js` / `shared/constants.js`.
