# Open PredictDx on your phone

Your laptop runs the server; your phone opens the app over the **same Wi-Fi**. Nothing has to be installed on the phone for Option A.

## Option A – open it in the phone's browser (works today, 2 minutes)

1. **Laptop:** double-click `start-predictdx.bat` (or run `npm run dev` in the PredictDX folder). Wait until the window says `PredictDx API ready`.
2. **Laptop:** start the mobile app server. Open PowerShell in `PredictDX\mobile` and run:
   ```powershell
   node scripts/serve-web.mjs
   ```
   (Only needed after you change the Flutter code: `$env:PUB_CACHE='D:\flutter_pub_cache'; $env:PATH="D:\flutter\bin;$env:PATH"; flutter build web` first.)
3. **Find the laptop's address:** in PowerShell run `ipconfig` and look under **Wireless LAN adapter Wi-Fi** → **IPv4 Address**. Today it is **192.168.18.39**. It can change when the router restarts, so check it again on presentation day.
4. **Phone:** connect to the **same Wi-Fi** as the laptop (currently *Muhammad talha _5 GHz*). Mobile data will not work.
5. **Phone:** open Chrome and go to
   - **Mobile app:** `http://192.168.18.39:5174`
   - **Website:** `http://192.168.18.39:5173`
6. Sign in with an account from **LOGINS.md**. The 6-digit code appears on the screen in a small "Verification code" box.
7. **Home-screen icon:** in Chrome tap **⋮ → Add to Home screen**. A PredictDx shortcut appears next to your other apps. (Over a local `http://` address Chrome keeps its address bar; the APK in Option B opens full-screen.)

**If the page does not open on the phone**
- Both devices must be on the same Wi-Fi (not a guest network, not mobile data).
- Windows may ask *"Allow Node.js to communicate on these networks?"* – tick **Private** and **Public** and click **Allow**. (On this laptop Node.js is already allowed.)
- Try the address on the laptop itself first (`http://192.168.18.39:5174`). If that works but the phone does not, the router is blocking devices from talking to each other (some university Wi-Fi does this): use a phone hotspot instead – connect the laptop to the phone's hotspot, run `ipconfig` again and use the new address.
- **Near me** uses the phone's GPS only on secure (https) pages; over this local address the browser may refuse, and the app then uses your city centre instead. The camera/gallery upload works normally.

## Option B – install the real Android app (APK)

This gives a proper installed app with GPS and camera. It needs the Android SDK once (about 8 GB – install it on **D:**):

1. Install **Android Studio** from developer.android.com/studio. During setup choose **D:\Android** as the SDK location.
2. In PowerShell:
   ```powershell
   $env:PUB_CACHE='D:\flutter_pub_cache'; $env:PATH="D:\flutter\bin;$env:PATH"
   flutter config --android-sdk D:\Android\Sdk
   flutter doctor --android-licenses
   cd C:\Users\clicks\Documents\FYP\PredictDX\mobile
   flutter build apk --release --dart-define=API_URL=http://192.168.18.39:3000
   ```
3. The app is at `mobile\build\app\outputs\flutter-apk\app-release.apk`. Send it to your phone (USB cable, WhatsApp to yourself, or Google Drive) and open it. Android asks to **allow installing from this source** – allow it once.
4. The phone must be on the same Wi-Fi as the laptop while `start-predictdx.bat` is running. If the laptop's address changes, build the APK again with the new address.

Alternative to building an APK: turn on **Developer options → USB debugging** on the phone, connect it by USB and run `flutter run --dart-define=API_URL=http://192.168.18.39:3000` inside `mobile` – the app installs and opens directly.
