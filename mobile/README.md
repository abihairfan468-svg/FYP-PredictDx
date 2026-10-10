# PredictDx mobile app (Flutter)

The phone version of PredictDx. It has the same screens and design as the website and uses the same NestJS API and Socket.IO channel.

```
lib/
├── main.dart              app start, shows the cover or the signed-in shell
├── core/
│   ├── config.dart        API address (--dart-define=API_URL=...)
│   ├── api.dart           Dio client: X-Client: mobile, bearer token, silent refresh
│   ├── auth.dart          sign-in, codes, sign-out (refresh token in secure storage)
│   └── realtime.dart      Socket.IO: chat, typing, receipts, notifications, analysis progress
├── ui/                    colours, fonts and shared widgets (Band, Panel, Pill, OtpBoxes ...)
└── screens/               welcome, auth, shell (tabs per role), portal, records,
                           careconnect (chat), workspace (doctor), diagnosis, admin, account
```

Run it (PowerShell, in this folder; the caches stay on D:):

```powershell
$env:PUB_CACHE='D:\flutter_pub_cache'; $env:PATH="D:\flutter\bin;$env:PATH"
flutter pub get
flutter analyze
flutter test
flutter build web
node scripts/serve-web.mjs
```

Then open http://localhost:5174 while `npm run dev` (in the PredictDX folder) is running.

Android: install Android Studio (Android SDK), then run `flutter build apk --dart-define=API_URL=http://<laptop-IP>:3000`.
