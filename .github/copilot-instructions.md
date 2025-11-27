## Quick orientation for AI coding agents

This is an **Interactive Audio Art Platform** built as an Expo React Native app (managed workflow). **Current state**: Phase 1 complete - production-ready web deployment with professional UI/UX, real Web Audio API synthesis, and cross-platform foundation (see `EXECUTIVE_PLAN.md`).

Key facts (discoverable in the repo):
- Entry point: `index.js` — calls `registerRootComponent(App)`.
- Main UI & audio engine: `App.js` — contains `useAudioEngine()` (real Web Audio API implementation) and `WaveformVisualizer` (SVG-based) with professional responsive design.
- Project manifest: `app.json` — Expo config (icons, splash, `newArchEnabled: true`).
- Scripts: found in `package.json` — `start`, `android`, `ios`, `web` which run `expo start` with appropriate flags (use `yarn` not npm).
- Dependencies: expo-audio 1.0.14 (modern package), react-native-svg for cross-platform graphics.
- **Roadmap**: `EXECUTIVE_PLAN.md` — 4-phase plan, Phase 1 ✅ complete, Phase 2 (generative patterns) is next.

High-level architecture / why things are organized this way
- **Goal**: Interactive artistic audio platform with multi-touch controls, generative visuals, and cross-platform deployment.
- Single-page Expo app: native/web via `react-native-web`. The visualizer is implemented in React Native + `react-native-svg` which keeps the same code path for mobile and web.
- **Audio engine**: Real Web Audio API implementation in `useAudioEngine` hook (Platform.OS === 'web'). Uses AudioContext, OscillatorNode, GainNode, AnalyserNode for synthesis and visualization. Native mobile audio (expo-audio) foundation ready for Phase 3.
- **Production ready**: Professional UI/UX with 7 theme system, responsive design, mobile Safari compatibility, touch interaction, multiple waveforms (sine, square, sawtooth, triangle).
- **Phase 1 complete** ✅: All interactive controls, real-time synthesis, professional design. **Phase 2 next**: Generative visual patterns (Lissajous, particles, fractals).

Project-specific patterns and conventions
- **Audio Hook Contract** (CRITICAL - DO NOT BREAK): `useAudioEngine()` in `App.js` returns: { initAudio, togglePlayback, updateFrequency, updateWaveType, updateAmplitude, updateMasterVolume, isPlaying, frequency, waveType, amplitude, masterVolume, audioData, audioStatus }. Keep these signatures stable.
- **Touch interaction**: `WaveformVisualizer` converts `audioData` (1024-length number array from AnalyserNode) -> SVG path and maps touch X coordinate -> frequency (200–2000Hz). **Phase 2**: multi-touch gestures, pinch-zoom, rotation.
- **Real audio data**: Live from Web Audio API AnalyserNode.getByteTimeDomainData() - authentic waveform shapes. Sine wave blending with base waveforms for artistic effect.
- **Volume safety**: Default 30% amplitude on startup, perceptual volume compensation matrix prevents ear damage when switching waveforms.
- **Mobile Safari compatibility**: Direct AudioContext approach, Safari-specific initialization overlay, aggressive resume() logic, on-screen debugging via `useDebug.js` hook.
- **UI/UX**: 60% waveform / 40% scrollable controls, status → start → wave type → parameters → themes flow, 7 color schemes, drag tooltips, responsive design (320px+ width).
- **Pattern engine goal (Phase 2)**: Implement Lissajous curves, particle physics, fractal patterns, kaleidoscope effects (see EXECUTIVE_PLAN.md Phase 2).
- **Deterministic programming**: Prefer deterministic programming over timers. Use direct state management, async/await patterns, and immediate execution instead of setTimeout/setInterval when possible. Only use timers when absolutely necessary for timing-dependent operations like animations or audio transitions.

How to run / debug (commands you can use locally)
Run the normal Expo flows (from project root, using **yarn**):

```bash
yarn start          # starts expo dev server (choose web/ios/android)
yarn web            # run web build directly via react-native-web
yarn android        # open in Expo Go on connected Android device or emulator
yarn ios            # open in Expo Go on iOS (macOS only)
yarn export         # build static web bundle for deployment
yarn build:web      # alias for export
```

Debugging notes
- **Web Audio**: Console logs in `useAudioEngine()` show: `initAudio`, `togglePlayback`, `updateFrequency`, oscillator switching, gain node connections.
- **Mobile Safari**: Use `useDebug.js` hook for on-screen debugging (no Mac dev tools needed). Add logs with `addDebugLog('category', 'message')`, render `<DebugDisplay />`.
- **Audio Status**: Watch `audioStatus` state - shows AudioContext state, initialization progress, errors.
- **Volume Compensation**: Check console for "Volume compensation applied" messages when switching waveforms.
- For native audio (expo-audio native features) you may need `expo prebuild` + native rebuild; `expo start` + Expo Go works for current web-based audio.

Integration points / external dependencies to be aware of
- `expo ~54.0` — primary runtime. React 19.1.0, React Native 0.81.5. Changes to native modules or adding new native-only packages will require `expo prebuild` + native rebuild.
- `react-native-svg 15.12.1` — used for waveform drawing. Keep SVG path generation performant (1024 samples typical). All graphics must use SVG (Canvas API not cross-platform compatible).
- `expo-audio 1.0.14` — modern package (replaces deprecated expo-av). Currently using Web Audio API on web; expo-audio foundation ready for Phase 3 native deployment.
- **Web Audio API** — Primary synthesis engine on web. AudioContext, OscillatorNode, GainNode (amplitude + master volume), AnalyserNode (waveform data). Safari requires user gesture to initialize.
- `react-native-web` — Enables web deployment from React Native code. Use Platform.select() for web vs native differences.

Examples to reference while coding
- **Audio synthesis**: `useAudioEngine()` in `App.js` (lines 8-500+). Shows Web Audio API setup, oscillator management, gain node connections, waveform switching logic, volume compensation matrix.
- **Visualizer rendering**: `WaveformVisualizer` component in `App.js` (lines 500-800+). Shows SVG Path generation from audioData, touch coordinate mapping to frequency, sine wave blending algorithm.
- **UI/UX patterns**: Control panel layout with ScrollView, theme system with color schemes, drag tooltips, frequency overlay display, dismissable status indicator.
- **Mobile Safari workarounds**: Direct AudioContext initialization, safari-specific overlay UI, aggressive resume() calls, error handling.
- **On-screen debugging**: `useDebug.js` hook usage for mobile troubleshooting without Mac dev tools.
- Visualizer path generation: `generatePath()` expects numeric array (1024 length from AnalyserNode). If downsampling, update `sliceWidth = width / audioData.length` calculation.

PR & testing guidance
- **Test platforms**: Web (Chrome, Firefox, Safari desktop + mobile Safari), verify responsive design at 320px, 768px, 1024px+ widths.
- **Audio testing**: Check all 4 waveform types, volume controls (amplitude + master), frequency range 200-2000Hz, volume compensation on waveform switch.
- **Hook contract**: DO NOT change existing function signatures in `useAudioEngine()` without updating all call sites.
- **Safari mobile**: Test with on-screen debug display, verify AudioContext initialization overlay works, check touch interaction accuracy.
- When introducing native deps (expo-audio native features) document required manual steps: `expo prebuild`, native rebuild, dev client setup.

Workflow shortcuts
- **"commit and document"**: Commit changes with a concise, comprehensive message, then read and update EXECUTIVE_PLAN.md to reflect current progress and status (mark tasks ✅ or update phase descriptions).
- **Testing flow**: Make change → test web (Safari important) → check mobile viewport → verify audio/visual sync → commit.

Files to inspect for most tasks
- `App.js` (2000+ lines) — main UI, real Web Audio API engine hook, SVG visualizer, control panels, theme system, Safari compatibility logic.
- `EXECUTIVE_PLAN.md` — roadmap and technical architecture (4 phases, Phase 1 ✅ complete, Phase 2+ goals, current features checklist).
- `README.md` — user documentation, installation, features, deployment guide, troubleshooting.
- `package.json` — scripts (yarn start/web/export), dependencies (expo 54, react 19, expo-audio, react-native-svg).
- `app.json` — Expo configuration (icons, splash, `newArchEnabled: true`, bundle identifier).
- `hooks/useDebug.js` — on-screen mobile debugging system for Safari troubleshooting.
- `index.js` — root registration (rarely needs changes).

## Key Design Decisions (Why Things Work This Way)

1. **Web Audio API on web, expo-audio foundation for native**: Web has best audio API support; native deployment deferred to Phase 3 to focus on UX/patterns first.
2. **SVG not Canvas**: SVG is cross-platform in React Native (Canvas is web-only). All graphics use react-native-svg primitives.
3. **Dual volume controls**: Amplitude (waveform-level) + master volume (output-level) gives precise control and safety. Volume compensation matrix prevents loudness jumps.
4. **30% default amplitude**: User safety - loud square/sawtooth waves can damage hearing. Start quiet, let users increase.
5. **Safari-specific workarounds**: Safari is strictest browser for audio (user gesture required, suspend/resume issues). Direct AudioContext approach bypasses complex initialization.
6. **On-screen debugging for mobile**: Can't use Mac dev tools with iPhone Safari easily. `useDebug.js` puts logs directly on screen.
7. **60/40 layout split**: Gives waveform visual prominence while keeping controls accessible without scrolling on tablets/desktop.
8. **Deterministic programming over timers**: Timers cause race conditions and cleanup issues. Direct state management and async/await are more reliable.

If anything is unclear or you need details on specific features (generative patterns implementation plan, native audio migration, multi-touch gestures, recording system), say which part to expand and I will update these instructions.
