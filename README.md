<p align="center">
  <img src="app logo/ic_launcher_foreground_photo.jpeg" width="150" alt="Lyrra Logo"/>
</p>

<h1 align="center">Lyrra</h1>
<h3 align="center">MuseFlow v2</h3>
<h4 align="center">[MuseFlow v2](https://github.com/Panduu3163/Muse_Flow.git)</h4>

<p align="center">
  <b>🎵 A beautiful, ad-free music streaming app for Android and ios</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Android-11%2B-green?logo=android" alt="Android 11+"/>
  <img src="https://img.shields.io/badge/Kotlin-2.4-purple?logo=kotlin" alt="Kotlin"/>
  <img src="https://img.shields.io/badge/Jetpack_Compose-Material3-blue?logo=jetpackcompose" alt="Jetpack Compose"/>
  <img src="https://img.shields.io/badge/License-GPLv3-red" alt="License GPLv3"/>
</p>

---

## ✨ Features

- 🎧 **High-Fidelity Streaming** — Prioritizes original studio-master audio tracks with the highest available bitrate (Opus, 48 kHz)
- 🔍 **YouTube Music Search** — Search and stream millions of songs via YouTube's InnerTube API
- 🎤 **Synced Lyrics** — Real-time lyrics from LRCLib and BetterLyrics, perfectly synced to the music
- 🎨 **Dynamic Theming** — Album-art-aware colors powered by Material You & `MaterialKolor`
- 💿 **Glassmorphic Mini Player** — Animated mini player with spring physics, blurred backdrop, and smooth transitions
- 📥 **Offline Downloads** — Download songs for offline playback with embedded metadata & cover art
- 📚 **Library Management** — Create playlists, mark favorites, view listening history
- 🏠 **Smart Home Feed** — Personalized quick-picks, mood mixes, and trending charts
- 🔔 **Background Playback** — Full `Media3` session support with notification controls
- 🌙 **Beautiful Dark UI** — Deep dark theme with neon violet (`#8B5CF6`) accents

## 🏗️ Architecture

| Module | Description |
|---|---|
| `app` | Main Android application (Jetpack Compose + MVVM) |
| `innertube` | YouTube InnerTube API client library |

**Key Libraries:**
- **Media3** (ExoPlayer) — Audio playback engine
- **Jetpack Compose** + **Material 3** — Declarative UI
- **Room** — Local database for library, playlists, history
- **Coil** — Image loading with palette extraction
- **Retrofit + OkHttp** — Networking
- **DataStore** — User preferences
- **WorkManager** — Background download tasks
- **Firebase AI** — Smart recommendations

## 📋 Requirements

- Android **11+** (API 30)
- Android Studio **Ladybug** or later
- JDK **17** (JDK 21 required for Robolectric tests)

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/Lyrra.git
cd Lyrra
```

### 2. Build the debug APK

```bash
./gradlew assembleDebug
```

The APK will be at:
```
app/build/outputs/apk/debug/app-debug.apk
```

### 3. Run on a device

```bash
./gradlew installDebug
```

Or open the project in Android Studio and click ▶️ **Run**.

## 🧪 Testing

```bash
# Run all unit tests
./gradlew testDebugUnitTest

# Run screenshot tests (Roborazzi)
./gradlew verifyRoborazziDebug
```

## 📁 Project Structure

```
Lyrra/
├── app/
│   └── src/main/java/com/lyrra/app/
│       ├── MainActivity.kt              # App entry point
│       ├── LyrraApplication.kt          # Application class
│       ├── PlaybackService.kt           # Media3 playback service
│       ├── HomeViewModel.kt             # Main discovery logic
│       ├── ui/                          # UI components and screens
│       │   ├── component/               # Reusable widgets
│       │   ├── screens/                 # All app screens
│       │   └── theme/                   # Material You theming
│       └── ...                          # Repositories, Providers, and DAOs
├── innertube/                           # YouTube InnerTube API module
├── gradle/                              # Gradle wrapper & version catalog
└── LICENSE                              # GPLv3
```

## 🔧 Build Variants

| Variant | Signing | Use |
|---|---|---|
| `debug` | Auto-signed with debug keystore | Development & testing |
| `release` | Requires your own keystore (see below) | Distribution |

### Signing a release build

Set the following environment variables before building:

```bash
export KEYSTORE_PATH="/path/to/your-upload-key.jks"
export STORE_PASSWORD="your_store_password"
export KEY_PASSWORD="your_key_password"

./gradlew assembleRelease
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m "Add amazing feature"`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the **GNU General Public License v3.0** — see the [LICENSE](LICENSE) file for details.

## 👤 Developer
Mynul Kabir Nayem 📧 mynulkbr@gmail.com
Tanvir Ahmed  📧 tanvirahmd565@gmail.com


## ⚠️ Disclaimer

Lyrra is an independent project for personal/educational use. It is not affiliated with, endorsed by, or connected to YouTube, Google, or any of their subsidiaries. All content streamed through the app is sourced from publicly available APIs. Please respect the terms of service of the platforms you use.

---

<p align="center">
  Made with ❤️ and Kotlin
</p>
