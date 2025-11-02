# 🎵 Interactive Audio Art Platform

An immersive, cross-platform audio-visual art experience built with React Native and Expo. Create beautiful, real-time audio synthesis with interactive waveform visualization that responds to your touch.

![Audio Art Platform Demo](https://via.placeholder.com/800x400/1a1a1a/007AFF?text=Interactive+Audio+Art+Platform)

## ✨ Features

### 🎶 **Real-Time Audio Synthesis**
- **Web Audio API** integration for high-quality sound generation
- **Multiple waveform types**: Sine, Square, Sawtooth, Triangle
- **Interactive frequency control**: Touch the waveform to change pitch (200Hz - 2000Hz)
- **Dynamic amplitude control**: Adjust volume with intuitive slider interface

### 🎨 **Interactive Visualization**
- **Real-time waveform rendering** using SVG graphics
- **Artistic wave blending**: Beautiful sine wave harmonics mixed with base waveforms
- **Touch-responsive interface**: Click/tap anywhere on the visualization to control frequency
- **Animated flowing effects** with smooth 60fps rendering

### 📱 **Cross-Platform Compatibility**
- **Web**: Full Web Audio API support with mobile Safari compatibility
- **iOS/Android**: Ready for native deployment via Expo
- **Responsive design** that works on desktop, tablet, and mobile

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Yarn package manager
- Expo CLI (`npm install -g @expo/cli`)

### Installation

```bash
# Clone the repository
git clone https://github.com/mckinselberg/audio-art-expo.git
cd audio-art-expo

# Install dependencies
yarn install

# Start development server
yarn start
```

### Running the App

```bash
# Web browser
yarn web

# iOS Simulator (macOS only)
yarn ios

# Android Emulator
yarn android
```

## 🎛️ Controls & Interaction

### **Main Interface**
- **START/STOP Button**: Begin/end audio synthesis
- **Amplitude Slider**: Control volume (0-100%)
- **Wave Type Buttons**: Switch between waveform types
- **Frequency Display**: Shows current pitch in Hz

### **Interactive Waveform**
- **Touch/Click**: Change frequency based on horizontal position
- **Left side**: Lower frequencies (~200Hz)
- **Right side**: Higher frequencies (~2000Hz)
- **Visual feedback**: Real-time waveform updates

## 🛠️ Technical Architecture

### **Audio Engine**
```javascript
// Cross-platform audio abstraction
Platform.OS === 'web' 
  ? Web Audio API (oscillators, gain nodes, analyzers)
  : Expo AV (planned for mobile deployment)
```

### **Visualization Engine**
- **React Native SVG** for cross-platform graphics
- **Real-time audio analysis** with Web Audio API AnalyserNode
- **Mathematical waveform generation** with artistic blending
- **60fps animation loops** using requestAnimationFrame

### **Key Components**
- `useAudioEngine()` - Custom hook for audio synthesis and control
- `WaveformVisualizer` - SVG-based real-time visualization component
- `generateWaveform()` - Mathematical waveform generation with artistic effects

## 📦 Dependencies

### **Core Framework**
- `expo` ~54.0.20 - Cross-platform development platform
- `react-native` 0.81.5 - Mobile app framework
- `react-native-web` - Web compatibility layer

### **Audio & Graphics**
- `expo-av` - Audio/video library for mobile
- `react-native-svg` - Cross-platform SVG rendering
- `expo-status-bar` - Status bar management

## 🌐 Deployment

### **Web Deployment (Render.com)**
```bash
# Build for production
yarn export

# Deploy static files from dist/ folder
```

**Render.com Settings:**
- Build Command: `yarn install && yarn export`
- Publish Directory: `dist`
- Environment: Node.js

### **Mobile Deployment**
```bash
# iOS App Store
expo build:ios

# Google Play Store  
expo build:android
```

## 🎨 Artistic Features

### **Visual Blending**
The platform creates unique artistic effects by blending pure waveforms with subtle sine wave harmonics:

```javascript
// Pure audio output
oscillator.type = waveType; // Clean square/sawtooth/triangle

// Artistic visualization 
sample = baseWaveform + (sineComponent * 0.3); // 30% sine blend
```

### **Real-Time Audio Analysis**
- Live audio capture from Web Audio API
- FFT analysis for visualization data
- Amplitude-responsive visual scaling
- Smooth interpolation between frames

## 🔧 Development

### **Project Structure**
```
audio-art-expo/
├── App.js                 # Main application component
├── index.js              # Entry point
├── app.json              # Expo configuration
├── package.json          # Dependencies and scripts
├── EXECUTIVE_PLAN.md     # Development roadmap
└── .github/
    └── copilot-instructions.md # AI development guidelines
```

### **Available Scripts**
```bash
yarn start      # Start Expo development server
yarn web        # Run in web browser
yarn android    # Run on Android device/emulator  
yarn ios        # Run on iOS device/simulator
yarn export     # Build for web deployment
```

### **Development Workflow**
1. `yarn start` - Start the Expo development server
2. Press `w` to open in web browser
3. Make changes - hot reload automatically updates
4. Test on different platforms as needed

## 🐛 Known Issues & Compatibility

### **Mobile Safari**
- ✅ **Fixed**: AudioContext requires explicit user interaction
- ✅ **Fixed**: Automatic AudioContext.resume() on first interaction
- ✅ **Tested**: Works on iPhone/iPad Safari

### **Browser Support**
- ✅ Chrome/Firefox/Safari (desktop)
- ✅ Mobile Safari (iOS)
- ✅ Chrome Mobile (Android)
- ⚠️ Internet Explorer: Not supported (Web Audio API required)

## 🗺️ Roadmap

### **Phase 1: Foundation** ✅ **COMPLETED**
- [x] Interactive audio synthesis
- [x] Real-time visualization  
- [x] Cross-platform deployment
- [x] Touch controls

### **Phase 2: Advanced Patterns** 🚧 **IN PROGRESS**
- [ ] Lissajous curves with dual oscillators
- [ ] Particle physics systems
- [ ] Kaleidoscope effects
- [ ] Advanced gesture controls

### **Phase 3: Creative Tools** 📋 **PLANNED**
- [ ] Pattern recording/playback
- [ ] Preset saving system
- [ ] Social sharing features
- [ ] Advanced export options

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- **Web Audio API** for real-time audio synthesis
- **React Native & Expo** for cross-platform development
- **SVG graphics** for scalable, performance-optimized visualization
- **Mathematical waveform generation** for artistic audio-visual harmony

---

**Built with ❤️ and 🎵 by [mckinselberg](https://github.com/mckinselberg)**

*Create, explore, and share your audio-visual art!*