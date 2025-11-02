import React, { useState, useRef, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { Svg, Path } from 'react-native-svg';
import { Audio } from 'expo-av';

// Real audio engine with platform-aware synthesis
const useAudioEngine = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [frequency, setFrequency] = useState(440);
  const [waveType, setWaveType] = useState('sine');
  const [amplitude, setAmplitude] = useState(0.5);
  const [audioData, setAudioData] = useState(new Array(1024).fill(128));
  const soundRef = useRef(null);
  
  // Web Audio API references (for web platform)
  const audioContextRef = useRef(null);
  const oscillatorRef = useRef(null);
  const gainNodeRef = useRef(null);
  const analyserRef = useRef(null);

  // Initialize audio system with platform detection
  const initAudio = async () => {
    try {
      if (Platform.OS === 'web') {
        // Use Web Audio API for web
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          
          // Mobile Safari requires explicit resume after user interaction
          if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
            console.log('AudioContext resumed for mobile Safari');
          }
          
          // Create gain node for volume control
          gainNodeRef.current = audioContextRef.current.createGain();
          gainNodeRef.current.gain.setValueAtTime(0.5, audioContextRef.current.currentTime);
          
          // Create analyser for visualization
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 2048;
          
          // Connect: gainNode -> analyser -> destination
          // (oscillator will connect to gainNode when created)
          gainNodeRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
          
          console.log('Web Audio API initialized, state:', audioContextRef.current.state);
        }
      } else {
        // Use expo-av for mobile
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        console.log('Expo Audio initialized');
      }
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  };

  // Generate waveform data for visualization
  const generateWaveform = (freq, type, amp) => {
    return new Array(1024).fill(0).map((_, i) => {
      let sample;
      const cycles = 8; // Show 8 complete cycles across the screen
      const t = (i / 1024) * cycles * 2 * Math.PI;
      
      switch (type) {
        case 'sine':
          sample = Math.sin(t);
          break;
        case 'square':
          sample = Math.sign(Math.sin(t));
          break;
        case 'sawtooth':
          sample = 2 * ((t / (2 * Math.PI)) % 1) - 1;
          break;
        case 'triangle':
          const sawtoothValue = 2 * ((t / (2 * Math.PI)) % 1) - 1;
          sample = 2 * Math.abs(sawtoothValue) - 1;
          break;
        default:
          sample = Math.sin(t);
      }
      
      // Convert from -1 to 1 range to 0 to 255 range
      return 128 + sample * amp * 127;
    });
  };

  // Create and start oscillator (Web Audio API)
  const startWebAudioOscillator = () => {
    if (audioContextRef.current && !oscillatorRef.current) {
      oscillatorRef.current = audioContextRef.current.createOscillator();
      oscillatorRef.current.type = waveType;
      
      // Ensure frequency is valid before setting
      const safeFreq = isNaN(frequency) || !isFinite(frequency) ? 440 : frequency;
      oscillatorRef.current.frequency.setValueAtTime(safeFreq, audioContextRef.current.currentTime);
      
      // Connect to gain node (which is already connected to analyser -> destination)
      oscillatorRef.current.connect(gainNodeRef.current);
      oscillatorRef.current.start();
      
      // Set volume with safety check - use wider range
      const safeAmplitude = isNaN(amplitude) || !isFinite(amplitude) ? 0.5 : amplitude;
      gainNodeRef.current.gain.setValueAtTime(safeAmplitude * 0.8, audioContextRef.current.currentTime);
      
      console.log(`Started ${waveType} oscillator at ${safeFreq}Hz with amplitude ${safeAmplitude} (gain: ${safeAmplitude * 0.8})`);
    }
  };

  // Stop oscillator (Web Audio API)
  const stopWebAudioOscillator = () => {
    if (oscillatorRef.current) {
      // Don't reset gain to 0 - just stop the oscillator
      oscillatorRef.current.stop();
      oscillatorRef.current.disconnect();
      oscillatorRef.current = null;
      console.log('Stopped oscillator (gain preserved)');
    }
  };

  // Update oscillator parameters
  const updateWebAudioOscillator = () => {
    if (oscillatorRef.current && audioContextRef.current) {
      // Ensure values are safe before setting
      const safeFreq = isNaN(frequency) || !isFinite(frequency) ? 440 : frequency;
      const safeAmplitude = isNaN(amplitude) || !isFinite(amplitude) ? 0.5 : amplitude;
      
      oscillatorRef.current.frequency.setValueAtTime(safeFreq, audioContextRef.current.currentTime);
      oscillatorRef.current.type = waveType;
      gainNodeRef.current.gain.setValueAtTime(safeAmplitude * 0.8, audioContextRef.current.currentTime);
    }
  };

  const togglePlayback = async () => {
    try {
      if (isPlaying) {
        if (Platform.OS === 'web') {
          stopWebAudioOscillator();
        } else {
          // Stop expo-av audio
          if (soundRef.current) {
            await soundRef.current.stopAsync();
            await soundRef.current.unloadAsync();
            soundRef.current = null;
          }
        }
        setIsPlaying(false);
        console.log('Audio stopped');
      } else {
        if (Platform.OS === 'web') {
          // Ensure AudioContext is running before starting oscillator (mobile Safari fix)
          if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
            console.log('AudioContext resumed before playback');
          }
          startWebAudioOscillator();
        } else {
          // For mobile, we'd need to generate or load audio files
          // This is a placeholder for now
          console.log('Mobile audio playback would start here');
        }
        setIsPlaying(true);
        console.log('Audio started');
      }
      
      // Update visualization
      const waveformData = generateWaveform(frequency, waveType, amplitude);
      setAudioData(waveformData);
    } catch (error) {
      console.error('Failed to toggle playback:', error);
    }
  };

  const updateFrequency = async (newFreq) => {
    // Validate frequency value
    if (isNaN(newFreq) || !isFinite(newFreq) || newFreq < 20 || newFreq > 20000) {
      console.warn('Invalid frequency:', newFreq);
      return;
    }
    
    setFrequency(newFreq);
    console.log('Frequency updated:', newFreq);
    
    if (Platform.OS === 'web' && isPlaying) {
      updateWebAudioOscillator();
    }
    
    // Update visualization
    const waveformData = generateWaveform(newFreq, waveType, amplitude);
    setAudioData(waveformData);
  };

  const updateWaveType = async (newType) => {
    setWaveType(newType);
    console.log('Wave type updated:', newType);
    
    if (Platform.OS === 'web' && isPlaying) {
      updateWebAudioOscillator();
    }
    
    // Update visualization
    const waveformData = generateWaveform(frequency, newType, amplitude);
    setAudioData(waveformData);
  };

  const updateAmplitude = async (newAmplitude) => {
    console.log('=== updateAmplitude called ===');
    console.log('Input newAmplitude:', newAmplitude);
    console.log('Current amplitude state:', amplitude);
    console.log('isPlaying:', isPlaying);
    console.log('gainNodeRef.current exists:', !!gainNodeRef.current);
    console.log('audioContextRef.current exists:', !!audioContextRef.current);
    
    // Validate amplitude value
    if (isNaN(newAmplitude) || !isFinite(newAmplitude)) {
      console.warn('Invalid amplitude:', newAmplitude);
      return;
    }
    
    // Clamp amplitude between 0 and 1
    const clampedAmplitude = Math.max(0, Math.min(1, newAmplitude));
    console.log('Clamped amplitude:', clampedAmplitude);
    
    setAmplitude(clampedAmplitude);
    
    // Update Web Audio gain immediately if nodes exist
    if (Platform.OS === 'web' && gainNodeRef.current && audioContextRef.current) {
      // Use a wider gain range: 0 to 0.8 instead of 0 to 0.3
      const gainValue = clampedAmplitude * 0.8;
      try {
        gainNodeRef.current.gain.setValueAtTime(gainValue, audioContextRef.current.currentTime);
        console.log('Gain node updated to:', gainValue, 'at time:', audioContextRef.current.currentTime);
        console.log('Current gain value:', gainNodeRef.current.gain.value);
      } catch (error) {
        console.error('Error setting gain:', error);
      }
    } else {
      console.log('Skipping gain update - web:', Platform.OS === 'web', 'gainNode:', !!gainNodeRef.current, 'audioContext:', !!audioContextRef.current);
    }
    
    // Always update visualization immediately
    const waveformData = generateWaveform(frequency, waveType, clampedAmplitude);
    setAudioData(waveformData);
    console.log('=== updateAmplitude complete ===');
  };

  // Update real-time audio data from analyser
  const updateAudioData = () => {
    if (Platform.OS === 'web' && analyserRef.current && isPlaying) {
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteTimeDomainData(dataArray);
      
      // Convert to our expected format (downsample if needed)
      const downsampledData = [];
      const step = Math.max(1, Math.floor(bufferLength / 1024));
      for (let i = 0; i < bufferLength; i += step) {
        if (downsampledData.length < 1024) {
          // Scale the real-time audio data by amplitude
          const originalValue = dataArray[i];
          const centered = originalValue - 128; // Center around 0
          const scaled = centered * amplitude; // Apply amplitude scaling
          const scaledValue = 128 + scaled; // Convert back to 0-255 range
          downsampledData.push(Math.max(0, Math.min(255, scaledValue)));
        }
      }
      
      // Pad with generated data if we don't have enough real data
      // This creates the artistic blending effect with real audio analysis
      while (downsampledData.length < 1024) {
        const t = (downsampledData.length * frequency) / 100;
        let sample;
        let sineComponent = Math.sin(t) * 0.3; // Subtle sine blend for artistic effect
        
        switch (waveType) {
          case 'sine': 
            sample = Math.sin(t); 
            break;
          case 'square': 
            sample = Math.sign(Math.sin(t)) + sineComponent; 
            break;
          case 'sawtooth': 
            sample = (2 * (t / (2 * Math.PI) - Math.floor(t / (2 * Math.PI) + 0.5))) + sineComponent; 
            break;
          case 'triangle': 
            sample = (2 * Math.abs(2 * (t / (2 * Math.PI) - Math.floor(t / (2 * Math.PI) + 0.5))) - 1) + sineComponent; 
            break;
          default: 
            sample = Math.sin(t);
        }
        downsampledData.push(128 + sample * amplitude * 127);
      }
      
      setAudioData(downsampledData);
    }
  };

  // Animation loop for real-time audio data
  useEffect(() => {
    let animationId;
    if (isPlaying && Platform.OS === 'web') {
      const animate = () => {
        updateAudioData();
        animationId = requestAnimationFrame(animate);
      };
      animationId = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isPlaying, frequency, waveType, amplitude]);

  // Initialize with default waveform
  useEffect(() => {
    const waveformData = generateWaveform(frequency, waveType, amplitude);
    setAudioData(waveformData);
    
    return () => {
      if (Platform.OS === 'web') {
        stopWebAudioOscillator();
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      } else {
        if (soundRef.current) {
          soundRef.current.unloadAsync().catch(console.error);
        }
      }
    };
  }, []);

  return {
    initAudio,
    togglePlayback,
    updateFrequency,
    updateWaveType,
    updateAmplitude,
    isPlaying,
    frequency,
    waveType,
    amplitude,
    audioData
  };
};

// SVG-based waveform visualization component
const WaveformVisualizer = ({ audioData, onTouch, isPlaying }) => {
  const { width, height } = Dimensions.get('window');
  const visualizerHeight = height * 0.7;
  const [isDragging, setIsDragging] = useState(false);
  const [animationOffset, setAnimationOffset] = useState(0);
  const animationRef = useRef();

  // Animation loop for flowing waveform
  useEffect(() => {
    if (isPlaying) {
      let startTime = null;
      const animate = (currentTime) => {
        if (!startTime) startTime = currentTime;
        const elapsed = currentTime - startTime;
        
        // Move smoothly based on time, not frame rate
        setAnimationOffset((elapsed * 0.05) % width); // Slower, smoother movement
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      setAnimationOffset(0); // Reset when stopped
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, width]);

  // Generate SVG path from audio data with animation
  const generatePath = () => {
    if (!audioData || audioData.length === 0) return '';

    const sliceWidth = width / audioData.length;
    let pathData = '';

    audioData.forEach((value, index) => {
      const x = index * sliceWidth;
      
      // Safety check for NaN values
      const safeValue = isNaN(value) || !isFinite(value) ? 128 : value;
      
      // Center the waveform and scale it properly
      const centerY = visualizerHeight / 2;
      const amplitude = visualizerHeight * 0.3; // Use 30% of height for amplitude
      
      // Normalize value from 0-255 range to -1 to 1 range
      const normalizedValue = (safeValue - 128) / 128;
      
      // Add smooth flowing animation when playing
      const phaseOffset = isPlaying ? (animationOffset * 0.01 + index * 0.05) : 0;
      const animatedValue = isPlaying 
        ? normalizedValue + Math.sin(phaseOffset) * 0.15 // Smooth flowing effect
        : normalizedValue;
      
      const y = centerY + (animatedValue * amplitude);
      
      // Ensure x and y are valid numbers
      const safeX = isNaN(x) || !isFinite(x) ? 0 : Math.max(0, Math.min(width, x));
      const safeY = isNaN(y) || !isFinite(y) ? centerY : Math.max(0, Math.min(visualizerHeight, y));
      
      if (index === 0) {
        pathData += `M ${safeX} ${safeY}`;
      } else {
        pathData += ` L ${safeX} ${safeY}`;
      }
    });

    return pathData;
  };

  const handleResponderMove = (event) => {
    if (!isDragging) return;
    
    const { pageX } = event.nativeEvent;
    // Calculate relative X position within the visualizer
    const relativeX = pageX - (event.nativeEvent.target?.offsetLeft || 0);
    
    console.log('Responder move:', { pageX, relativeX, width });
    
    if (!isNaN(relativeX) && isFinite(relativeX)) {
      onTouch && onTouch(relativeX, 0);
    }
  };

  const handleResponderGrant = (event) => {
    setIsDragging(true);
    const { pageX } = event.nativeEvent;
    const relativeX = pageX - (event.nativeEvent.target?.offsetLeft || 0);
    
    console.log('Responder grant:', { pageX, relativeX });
    
    if (!isNaN(relativeX) && isFinite(relativeX)) {
      onTouch && onTouch(relativeX, 0);
    }
  };

  const handleResponderRelease = () => {
    setIsDragging(false);
  };

  return (
    <View 
      style={[styles.visualizer, { height: visualizerHeight }]}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={handleResponderGrant}
      onResponderMove={handleResponderMove}
      onResponderRelease={handleResponderRelease}
      onResponderTerminate={handleResponderRelease}
    >
      <Svg 
        width={width} 
        height={visualizerHeight}
      >
        {/* Background grid */}
        {isPlaying && (
          <>
            {/* Horizontal lines */}
            {Array.from({ length: 5 }, (_, i) => (
              <Path
                key={`grid-h-${i}`}
                d={`M 0 ${(i * visualizerHeight) / 4} L ${width} ${(i * visualizerHeight) / 4}`}
                stroke="#333"
                strokeWidth="1"
                opacity="0.2"
              />
            ))}
            {/* Vertical lines */}
            {Array.from({ length: 9 }, (_, i) => (
              <Path
                key={`grid-v-${i}`}
                d={`M ${(i * width) / 8} 0 L ${(i * width) / 8} ${visualizerHeight}`}
                stroke="#333"
                strokeWidth="1"
                opacity="0.2"
              />
            ))}
            {/* Center line */}
            <Path
              d={`M 0 ${visualizerHeight / 2} L ${width} ${visualizerHeight / 2}`}
              stroke="#555"
              strokeWidth="1"
              opacity="0.4"
            />
          </>
        )}
        
        {/* Main waveform */}
        <Path
          d={generatePath()}
          stroke={isPlaying ? "#007AFF" : "#666"}
          strokeWidth="2.5"
          fill="none"
          opacity={isPlaying ? 1.0 : 0.7}
        />
        
        {/* Glow effect when playing */}
        {isPlaying && (
          <Path
            d={generatePath()}
            stroke="#007AFF"
            strokeWidth="5"
            fill="none"
            opacity="0.3"
          />
        )}
      </Svg>
    </View>
  );
};

// Main App component
export default function App() {
  const { 
    initAudio, 
    togglePlayback, 
    updateFrequency, 
    updateWaveType, 
    updateAmplitude,
    isPlaying, 
    frequency, 
    waveType,
    amplitude,
    audioData 
  } = useAudioEngine();
  const [audioInitialized, setAudioInitialized] = useState(false);

  const handleVisualizerTouch = (x, y) => {
    const { width } = Dimensions.get('window');
    // Map touch position to frequency (200Hz to 2000Hz)
    // Add safety checks to prevent NaN
    const safeX = isNaN(x) || x === undefined ? width / 2 : x;
    const clampedX = Math.max(0, Math.min(width, safeX));
    const newFreq = 200 + (clampedX / width) * 1800;
    
    // Ensure frequency is valid
    if (!isNaN(newFreq) && isFinite(newFreq)) {
      updateFrequency(newFreq);
    }
  };

  const handleButtonPress = async () => {
    if (!audioInitialized) {
      await initAudio();
      setAudioInitialized(true);
    }
    
    // Mobile Safari specific check
    if (Platform.OS === 'web' && audioContextRef.current) {
      const isMobileSafari = /iPhone|iPad|iPod/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent);
      if (isMobileSafari && audioContextRef.current.state !== 'running') {
        console.log('Mobile Safari detected, ensuring AudioContext is running');
        try {
          await audioContextRef.current.resume();
        } catch (error) {
          console.error('Failed to resume AudioContext on mobile Safari:', error);
        }
      }
    }
    
    await togglePlayback();
  };

  const waveTypes = ['sine', 'square', 'sawtooth', 'triangle'];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <WaveformVisualizer 
        audioData={audioData}
        onTouch={handleVisualizerTouch}
        isPlaying={isPlaying}
      />
      
      <View style={styles.controls}>
        <TouchableOpacity 
          style={[styles.button, isPlaying && styles.buttonActive]}
          onPress={handleButtonPress}
        >
          <Text style={styles.buttonText}>
            {isPlaying ? 'STOP' : (!audioInitialized ? 'TAP TO START' : 'START')}
          </Text>
        </TouchableOpacity>
        
        <Text style={styles.frequencyText}>
          Frequency: {Math.round(frequency)}Hz
        </Text>
        
        <View style={styles.waveTypeContainer}>
          <Text style={styles.labelText}>Wave Type:</Text>
          <View style={styles.waveTypeButtons}>
            {waveTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.waveTypeButton,
                  waveType === type && styles.waveTypeButtonActive
                ]}
                onPress={() => updateWaveType(type)}
              >
                <Text style={[
                  styles.waveTypeButtonText,
                  waveType === type && styles.waveTypeButtonTextActive
                ]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        <View style={styles.amplitudeContainer}>
          <Text style={styles.labelText}>
            Amplitude: {Math.round(amplitude * 100)}%
          </Text>
          <View 
            style={styles.amplitudeSlider}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(evt) => {
              const { locationX } = evt.nativeEvent;
              const sliderWidth = 200; // Approximate slider width
              const newAmplitude = Math.max(0, Math.min(1, locationX / sliderWidth));
              updateAmplitude(newAmplitude);
            }}
            onResponderMove={(evt) => {
              const { locationX } = evt.nativeEvent;
              const sliderWidth = 200; // Approximate slider width
              const newAmplitude = Math.max(0, Math.min(1, locationX / sliderWidth));
              updateAmplitude(newAmplitude);
            }}
          >
            <TouchableOpacity
              style={styles.amplitudeButton}
              onPress={() => {
                const newValue = Math.max(0.0, amplitude - 0.1);
                console.log('Minus button: current =', amplitude, 'new =', newValue);
                updateAmplitude(newValue);
              }}
            >
              <Text style={styles.amplitudeButtonText}>-</Text>
            </TouchableOpacity>
            <View style={styles.amplitudeTrack}>
              <View style={[styles.amplitudeBar, { width: `${amplitude * 100}%` }]} />
            </View>
            <TouchableOpacity
              style={styles.amplitudeButton}
              onPress={() => {
                const newValue = Math.min(1.0, amplitude + 0.1);
                console.log('Plus button: current =', amplitude, 'new =', newValue);
                updateAmplitude(newValue);
              }}
            >
              <Text style={styles.amplitudeButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <Text style={styles.statusText}>
          Audio: {audioInitialized ? 'Ready' : 'Not initialized'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  visualizer: {
    backgroundColor: '#ccc',
    width: '100%',
    flex: 1,
  },
  controls: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#000',
  },
  button: {
    backgroundColor: '#333',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginBottom: 15,
  },
  buttonActive: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  frequencyText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 5,
  },
  statusText: {
    color: '#ccc',
    fontSize: 14,
  },
  labelText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 5,
  },
  waveTypeContainer: {
    marginVertical: 10,
    alignItems: 'center',
  },
  waveTypeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  waveTypeButton: {
    backgroundColor: '#444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    margin: 3,
  },
  waveTypeButtonActive: {
    backgroundColor: '#007AFF',
  },
  waveTypeButtonText: {
    color: '#ccc',
    fontSize: 12,
  },
  waveTypeButtonTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  amplitudeContainer: {
    marginVertical: 10,
    alignItems: 'center',
    width: '80%',
  },
  amplitudeSlider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 5,
  },
  amplitudeTrack: {
    flex: 1,
    height: 20,
    backgroundColor: '#333',
    marginHorizontal: 10,
    borderRadius: 10,
    position: 'relative',
  },
  amplitudeButton: {
    width: 25,
    height: 25,
    backgroundColor: '#555',
    borderRadius: 12.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amplitudeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  amplitudeBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minWidth: 2,
  },
});
