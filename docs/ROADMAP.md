# Momo build roadmap

This tracks the phased build order from the product spec against what's
actually implemented in this codebase right now. Nothing below is
described as done unless it actually runs.

## ✅ Phase 1 — Floating Momo
- Transparent, borderless, always-on-top window (`tauri.conf.json`)
- Draggable via real OS window dragging (`Panda.tsx` → `startDragging()`)
- Idle animation, blinking, per-expression face art (`components/panda/`)
- Speech bubble with type-on effect (`components/speech-bubble/`)
- Settings panel (`components/settings/`)
- Window position remembered across restarts (`save_window_position`,
  `storage/settings.rs`)
- Global hotkey (`Ctrl+Shift+M` / `Cmd+Shift+M`) to show/hide, plus a tray
  icon with Show/Hide + Quit, since there are no window decorations

## ✅ Phase 2 — AI
- Provider abstraction (`ai/groq.rs`, `ai/openrouter.rs`) behind a single
  `ai/router.rs`
- Automatic failover with per-provider cooldowns (`ai/health.rs`) - the UI
  never talks to a provider directly, only to `ai_generate`
- Structured response contract (message/emotion/speak/animation) with a
  safe plain-text fallback if a model doesn't return valid JSON
  (`ai/types.rs::parse_model_output`)
- Provider status surfaced in Settings
- API keys stored via the OS credential store (`storage/keys.rs`, the
  `keyring` crate) - never written to disk in plaintext

## ✅ Phase 3 — Voice (partial)
- Basic OS-voice TTS (Windows SAPI via the `tts` crate) wired to chat
  replies and the startup greeting
- Volume/speed/enable toggles in Settings
- **Not done yet:** local neural voices (Piper/Kokoro), voice picker,
  pause/resume mid-utterance. The `tts` crate gives us `speak`/`stop`
  today; `pause`/`resume` would need a different backend.

## ⬜ Phase 4 — Memory
Not implemented. `personality.rs` has a `// TODO(Phase 4 - memory)` marker
exactly where retrieved memories and the active project should be spliced
into the system prompt. Suggested shape, matching the spec:
- SQLite (`rusqlite`) in the app data dir, tables per section 21 of the spec
- `memory-extractor`: after a chat turn, ask the model (a cheap/fast call)
  whether anything worth remembering was said
- A Memory tab in Settings to view/edit/delete/disable, per section 6 -
  the current Settings panel already has a placeholder section for this

## ⬜ Phase 5 — Screen awareness
Not implemented. `personality.rs` has a matching TODO marker. When built,
this should live in `src-tauri/src/screen/` (screenshot capture + active
window detection) and a new `ai::vision` module for the multimodal call,
producing the structured `visible_context` shape from section 13 - never
persisting raw screenshots.

## ⬜ Phase 6 — Initiative
Not implemented — right now Momo only speaks when spoken to (plus one
greeting on launch). This is the biggest remaining piece of the product's
actual identity. Build it as a standalone `initiative` module that:
1. Watches for triggers (app change, inactivity, task completion signals)
2. Applies the cooldown from `proactiveCooldownSeconds`
3. Decides SAY_NOTHING vs. one of the reaction types in section 4
4. Calls the same `ai_generate` path with a note that this is a proactive
   turn (see the Phase 6 TODO in `personality.rs`)

## ⬜ Phase 7 — Advanced personality / relationship state
Depends on Phase 4 (memory) existing first. `RelationshipState` (section
37) should be a small struct persisted alongside memory, not a new
subsystem.

---

None of the "not implemented" phases have placeholder UI that pretends to
work - the Settings panel's Memory section is the one exception, and it's
explicit that it isn't live yet, per the product principle of never faking
a feature.
