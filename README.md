# Hermoz

Hermoz is an AI desktop companion for Windows: a small floating panda that
lives on your screen, remembers your projects, argues with you, and makes
solo work feel less solo.

This repo is Phases 1-2 (and a basic slice of Phase 3) from the product
spec, fully working — not a mockup. See [`docs/ROADMAP.md`](docs/ROADMAP.md)
for exactly what's implemented vs. what's architected-for-but-not-built-yet
(memory, screen awareness, proactive initiative, advanced relationship
state).

## What you get right now

- A transparent, always-on-top panda you can drag anywhere on the screen
- Click Hermoz to open a real chat panel
- Groq + OpenRouter + Gemini behind one router with automatic failover — if
  one is rate-limited or down mid-task, Hermoz keeps going on the next one,
  seamlessly, since the full conversation/task state is always resent
- API keys stored in Windows Credential Manager, never in a file
- Basic text-to-speech (your Windows system voice) for chat replies and
  the startup greeting
- A settings panel for personality (roast level, proactivity, seriousness,
  companion style), window behavior, and voice
- `Ctrl+Shift+M` (or `Cmd+Shift+M` on macOS) and a tray icon to bring Hermoz
  back or quit, since the window has no title bar
- **The Canvas.** An infinite pan/zoom build view — Start → Planner →
  sub-agents → End — for "build me a real working X" requests. Turn on
  **Agent Mode** in chat (the lightning-bolt toggle) and a build/create-app
  request opens the Canvas and runs it for real: plans an architecture,
  spins up one sub-agent per piece, and executes each through the same
  approve-then-run pipeline as everything else. A "Where's Hermoz?" button
  jumps the view to whatever node is currently working.
- **UI generation via Stitch.** Ask Hermoz to build or edit an app, website,
  full-stack app, or desktop app UI and it routes the visual work through
  [Google Stitch](https://stitch.withgoogle.com) (via the official
  `@google/stitch-sdk`) and writes exactly what Stitch returns — no
  hand-editing. Requires a `STITCH_API_KEY` in your environment (see below).
- **Install & use named skills.** Say "install the X skill" (Claude Code,
  Antigravity, or Codex-style skills all work the same way — a folder with a
  `SKILL.md`) and Hermoz runs the install for real via the terminal (the
  [`npx skills`](https://skills.sh) installer), then automatically loads that
  skill's instructions into future turns that mention it by name.

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

Hermoz will run and float on your desktop with **zero keys configured** — it
just won't be able to talk back yet (you'll see a local canned greeting
instead of an AI-generated one). To turn on real conversation:

1. Click Hermoz → click the ⚙ (or the small gear in the corner) → **Settings**
2. Under **AI providers**, paste a Groq key and/or an OpenRouter key
   - Groq: <https://console.groq.com/keys> (free tier, very fast, good default)
   - OpenRouter: <https://openrouter.ai/keys> (works as the failover, or
     as your only provider)
3. That's it — no restart needed. If you configure both, Hermoz prefers Groq
   and silently falls back to OpenRouter if Groq is rate-limited or down.

Keys are saved via the `keyring` crate into **Windows Credential Manager**
(or macOS Keychain / Linux Secret Service in dev), under the service name
`hermoz-desktop-companion`. They're never written into `settings.json` or
any other plaintext file, and never leave your machine except in the
direct HTTPS request to whichever provider you're using.

## Set up Stitch (for UI generation)

Ask Hermoz to build or edit an app/website/UI and it routes that through
[Stitch](https://stitch.withgoogle.com) (Google's AI UI-design tool) rather
than hand-writing HTML itself. This needs one extra thing the AI provider
keys above don't cover:

1. Get a Stitch API key (Google Cloud project — see
   <https://github.com/google-labs-code/stitch-sdk> for setup)
2. Set it as an environment variable before launching Hermoz:
   `STITCH_API_KEY=your-key-here` (this is the `@google/stitch-sdk`'s own
   convention, not a Hermoz setting — it isn't stored anywhere by Hermoz)
3. Pick a workspace folder in Settings → General — this is where generated
   UI files, the Stitch bridge, and installed skills get written

Without a key, `generate_ui` actions fail with a clear message telling you
what's missing rather than silently doing nothing.

## Install & use skills

Say "install the &lt;name&gt; skill" for any Claude Code, Antigravity, or
Codex-style skill and Hermoz runs the real install (via
[`npx skills`](https://skills.sh)) and loads its `SKILL.md` automatically
into any future message that mentions that skill by name. Needs a workspace
folder set, same as above.

## Voice

Voice uses whatever default voice is installed in Windows (Settings →
Time & Language → Speech). No setup needed. Volume, speed, and which
messages get spoken out loud are all in Hermoz's Settings panel. Local
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
hermoz/
├── src/                     # React/TS frontend
│   ├── components/
│   │   ├── panda/           # The character: SVG art + expression system
│   │   ├── speech-bubble/
│   │   ├── chat/
│   │   └── settings/
│   ├── store/                useHermozStore.ts - all app state (zustand)
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

- Hermoz does not capture your screen. Screen awareness (Phase 5) isn't
  implemented yet - see the roadmap. When it lands, it will be
  permission-gated and off by default, per the product spec.
- Memory (Phase 4) isn't implemented yet either - Hermoz currently only
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
`%APPDATA%/com.hermoz.desktop/settings.json` (Windows) and relaunch - this
resets the remembered window position along with the rest of your
settings.

**No sound.** Check Settings → Voice → "Speak out loud" is on, and that
Windows has at least one voice installed (Settings → Time & Language →
Speech → Manage voices).

**A provider shows as rate-limited even though you just added the key.**
The first real call is what confirms a key actually works - "Connected"
before that just means "configured, not yet tested."
