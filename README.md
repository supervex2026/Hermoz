# Momo

Momo is an AI desktop companion for Windows: a small floating panda that
lives on your screen, remembers your projects, argues with you, and makes
solo work feel less solo.

This repo is Phases 1-2 (and a basic slice of Phase 3) from the product
spec, fully working — not a mockup. See [`docs/ROADMAP.md`](docs/ROADMAP.md)
for exactly what's implemented vs. what's architected-for-but-not-built-yet
(memory, screen awareness, proactive initiative, advanced relationship
state).

## What you get right now

- A transparent, always-on-top panda you can drag anywhere on the screen
- Click Momo to open a real chat panel
- Groq + OpenRouter behind one router with automatic failover — if one is
  rate-limited or down, Momo keeps talking through the other one
- API keys stored in Windows Credential Manager, never in a file
- Basic text-to-speech (your Windows system voice) for chat replies and
  the startup greeting
- A settings panel for personality (roast level, proactivity, seriousness,
  companion style), window behavior, and voice
- `Ctrl+Shift+M` (or `Cmd+Shift+M` on macOS) and a tray icon to bring Momo
  back or quit, since the window has no title bar

---

## Prerequisites

You'll need all of these installed on the machine you build/run on
(Windows is the target platform; the app also happens to build on macOS/
Linux for development purposes):

1. **Node.js** 18 or newer — <https://nodejs.org>
2. **Rust** (stable) — <https://www.rust-lang.org/tools/install>
3. **Tauri's platform prerequisites** — on Windows this is the
   **Microsoft C++ Build Tools** (via Visual Studio Installer, "Desktop
   development with C++" workload) and **WebView2** (already installed on
   most up-to-date Windows 10/11 machines). Full list, kept up to date by
   the Tauri team:
   <https://v2.tauri.app/start/prerequisites/>

## Install

```bash
npm install
```

## Run it (development)

```bash
npm run tauri dev
```

The first run compiles the Rust side, which takes a few minutes; after
that, `cargo`'s incremental build makes it much faster. The frontend
hot-reloads on save; Rust changes trigger a recompile + relaunch.

## Set up your AI keys

Momo will run and float on your desktop with **zero keys configured** — it
just won't be able to talk back yet (you'll see a local canned greeting
instead of an AI-generated one). To turn on real conversation:

1. Click Momo → click the ⚙ (or the small gear in the corner) → **Settings**
2. Under **AI providers**, paste a Groq key and/or an OpenRouter key
   - Groq: <https://console.groq.com/keys> (free tier, very fast, good default)
   - OpenRouter: <https://openrouter.ai/keys> (works as the failover, or
     as your only provider)
3. That's it — no restart needed. If you configure both, Momo prefers Groq
   and silently falls back to OpenRouter if Groq is rate-limited or down.

Keys are saved via the `keyring` crate into **Windows Credential Manager**
(or macOS Keychain / Linux Secret Service in dev), under the service name
`momo-desktop-companion`. They're never written into `settings.json` or
any other plaintext file, and never leave your machine except in the
direct HTTPS request to whichever provider you're using.

## Voice

Voice uses whatever default voice is installed in Windows (Settings →
Time & Language → Speech). No setup needed. Volume, speed, and which
messages get spoken out loud are all in Momo's Settings panel. Local
neural voices (Piper/Kokoro) aren't wired up yet — see the roadmap.

## Build a Windows installer

```bash
npm run tauri build
```

This produces an NSIS installer under
`src-tauri/target/release/bundle/nsis/`. The build is configured for a
per-user install (no admin prompt) in `tauri.conf.json` — change
`bundle.windows.nsis.installMode` if you'd rather it install for all
users.

## Project structure

```
momo/
├── src/                     # React/TS frontend
│   ├── components/
│   │   ├── panda/           # The character: SVG art + expression system
│   │   ├── speech-bubble/
│   │   ├── chat/
│   │   └── settings/
│   ├── store/                useMomoStore.ts - all app state (zustand)
│   └── types/                 shared TS types, mirrored in Rust
├── src-tauri/               # Rust backend
│   └── src/
│       ├── ai/               provider abstraction, router, failover, health
│       ├── audio/             TTS
│       ├── commands/          #[tauri::command] entry points the UI calls
│       ├── storage/            settings.json + OS-keyring API keys
│       └── personality.rs      builds the system prompt from personality settings
└── docs/ROADMAP.md          # phase-by-phase status against the product spec
```

The UI never talks to Groq/OpenRouter directly — every AI call goes
through `invoke("ai_generate", ...)`, which the Rust router handles
(provider choice, failover, retries). This is also why API keys can live
in Rust-only secure storage instead of the frontend.

## Permissions & privacy

- Momo does not capture your screen. Screen awareness (Phase 5) isn't
  implemented yet - see the roadmap. When it lands, it will be
  permission-gated and off by default, per the product spec.
- Memory (Phase 4) isn't implemented yet either - Momo currently only
  knows the current conversation, nothing persists between chat sessions
  except your Settings.
- The only network calls this app makes are to `api.groq.com` and/or
  `openrouter.ai`, and only when you send a chat message (or on the
  once-per-launch startup greeting, if a key is configured).

## Troubleshooting

**`cargo tauri dev` fails to compile.** The Rust code in this repo was
written carefully against current (as of writing) `tauri`, `keyring`, and
`tts` crate APIs, but it has **not** been compiled in the environment that
generated it (no Rust toolchain was available there). If you hit a compile
error, it's most likely a small API-surface drift in one of:
- `src-tauri/src/lib.rs` (tray icon / global shortcut / menu setup - the
  parts of Tauri's API that move around most between versions)
- `src-tauri/src/commands/settings.rs` (the `tauri-plugin-autostart`
  `ManagerExt`/`autolaunch()` call)

These are small, self-contained files - `cargo`'s error messages will
point at the exact line, and the fix is almost always a renamed method or
an extra trait import. Everything in `src/ai/`, `src/storage/`, and the
entire frontend has no such risk since those don't depend on
fast-moving windowing/tray APIs.

**Window appears in the wrong place / off-screen.** Delete
`%APPDATA%/com.momo.desktop/settings.json` (Windows) and relaunch - this
resets the remembered window position along with the rest of your
settings.

**No sound.** Check Settings → Voice → "Speak out loud" is on, and that
Windows has at least one voice installed (Settings → Time & Language →
Speech → Manage voices).

**A provider shows as rate-limited even though you just added the key.**
The first real call is what confirms a key actually works - "Connected"
before that just means "configured, not yet tested."
