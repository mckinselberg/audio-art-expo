## Quick orientation for AI coding agents

This is an **Interactive Audio Art Platform** built as an Expo React Native app (managed workflow). **Current state**: Already migrated from vanilla JS to React Native - we're in Phase 1+ of the roadmap (see `EXECUTIVE_PLAN.md`).

Key facts (discoverable in the repo):
- Entry point: `index.js` — calls `registerRootComponent(App)`.
- Main UI & audio placeholder: `App.js` — contains `useAudioEngine()` (placeholder implementation) and `WaveformVisualizer` (SVG-based) that drives UX.
- Project manifest: `app.json` — Expo config (icons, splash, `newArchEnabled: true`).
- Scripts: found in `package.json` — `start`, `android`, `ios`, `web` which run `expo start` with appropriate flags.
- **Roadmap**: `EXECUTIVE_PLAN.md` — 4-phase plan to build interactive audio-visual art platform.

High-level architecture / why things are organized this way
- **Goal**: Interactive artistic audio platform with multi-touch controls, generative visuals, and cross-platform deployment.
- Single-page Expo app: native/web via `react-native-web`. The visualizer is implemented in React Native + `react-native-svg` which keeps the same code path for mobile and web.
- Audio engine is currently a JS placeholder inside `App.js` (`useAudioEngine`). **Next step**: replace with `expo-av` for real audio synthesis and microphone input (Phase 2+).
- **Phase 1 focus**: Interactive controls, real-time parameter manipulation, basic pattern modes.

Project-specific patterns and conventions
- **Phase 1 Implementation**: Lightweight local hooks pattern used in `useAudioEngine()` inside `App.js`. When extending, follow the pattern of returning control functions and state: { initAudio, togglePlayback, updateFrequency, isPlaying, frequency, audioData }.
- **Touch interaction target**: `WaveformVisualizer` converts `audioData` -> SVG path and maps touch X coordinate -> frequency (200–2000Hz). **Roadmap calls for multi-touch gestures, pinch-zoom, rotation**.
- **Current audio data**: tests and UI use a generated 1024-length array centered at 128. **Next phase**: replace with real audio synthesis and microphone input.
- **Pattern engine goal**: Implement Lissajous curves, particle physics, fractal patterns, kaleidoscope effects (see EXECUTIVE_PLAN.md Phase 2).

How to run / debug (commands you can use locally)
Run the normal Expo flows (from project root):

```powershell
npm run start    # starts expo dev tools
npm run android  # open in Expo Go on connected Android device or emulator
npm run ios      # open in Expo Go on iOS (macOS only)
npm run web      # run the web build via react-native-web
```

Debugging notes
- The console logs in `useAudioEngine()` and `App.js` are helpful: `initAudio`, `togglePlayback`, `updateFrequency` print runtime info.
- For native audio (expo-av or custom native module) you may need to rebuild the native app or run a dev build; `expo start` + Expo Go won't work for some custom native modules.

Integration points / external dependencies to be aware of
- `expo` — primary runtime. Changes to native modules or adding new native-only packages will often require `expo prebuild` + native rebuild or running a dev client.
- `react-native-svg` — used for waveform drawing (keep SVG path generation performant for longer buffers).
- Future audio library (expected): `expo-av` or a native module. If adding native bridging, update `app.json` and follow Expo docs for custom dev clients.

Examples to reference while coding
- Replace placeholder audio engine: look at `useAudioEngine()` in `App.js`. Keep the same function signatures so `WaveformVisualizer` and the control UI keep working.
- Visualizer path generation: `generatePath()` in `WaveformVisualizer` expects a numeric array (length ~1024). If you change sampling or downsample, update sliceWidth calculation accordingly.

PR & testing guidance
- Small changes: keep them limited to the hook and visualizer and ensure they don't change the public hook contract.
- When introducing native deps (audio) document required manual steps in the PR (e.g., run `expo prebuild`, rebuild native, or how to run with a custom dev client).

Workflow shortcuts
- **"commit and document"**: Commit changes with a concise, comprehensive message, then read and update the EXECUTIVE_PLAN.md to reflect current progress and status.

Files to inspect for most tasks
- `App.js` — main UI, placeholder audio hook, visualizer.
- `index.js` — root registration.
- `package.json` — scripts and dependencies.
- `app.json` — Expo configuration (icons, splash, `newArchEnabled`).
- `EXECUTIVE_PLAN.md` — roadmap and technical architecture (4 phases, current state vs goals).

If anything is unclear or you want more details (example test harness, adding expo-av, or a migration plan to native audio), say which part to expand and I will update these instructions.
