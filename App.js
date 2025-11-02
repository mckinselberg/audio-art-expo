import React, { useState, useRef, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { Svg, Path } from 'react-native-svg';

// For now, we'll use a placeholder for audio - we'll implement expo-av next
const useAudioEngine = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [frequency, setFrequency] = useState(440);
  const [audioData, setAudioData] = useState(new Array(1024).fill(128));

  // Placeholder audio engine - will be replaced with expo-av
  const initAudio = () => {
    console.log('Audio initialized (placeholder)');
  };

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
    console.log('Playback toggled:', !isPlaying);
  };

  const updateFrequency = (newFreq) => {
    setFrequency(newFreq);
    console.log('Frequency updated:', newFreq);
    
    // Generate fake waveform data based on frequency for testing
    const fakeData = new Array(1024).fill(0).map((_, i) => {
      return 128 + Math.sin((i * newFreq) / 100) * 50;
    });
    setAudioData(fakeData);
  };

  return {
    initAudio,
    togglePlayback,
    updateFrequency,
    isPlaying,
    frequency,
    audioData
  };
};

// SVG-based waveform visualization component
const WaveformVisualizer = ({ audioData, onTouch }) => {
  const { width, height } = Dimensions.get('window');
  const visualizerHeight = height * 0.7;

  // Generate SVG path from audio data
  const generatePath = () => {
    if (!audioData || audioData.length === 0) return '';

    const sliceWidth = width / audioData.length;
    let pathData = '';

    audioData.forEach((value, index) => {
      const x = index * sliceWidth;
      const y = (value / 128.0) * (visualizerHeight / 2);
      
      if (index === 0) {
        pathData += `M ${x} ${y}`;
      } else {
        pathData += ` L ${x} ${y}`;
      }
    });

    return pathData;
  };

  const handleTouch = (event) => {
    const { locationX, locationY } = event.nativeEvent;
    onTouch && onTouch(locationX, locationY);
  };

  return (
    <View style={[styles.visualizer, { height: visualizerHeight }]}>
      <Svg 
        width={width} 
        height={visualizerHeight}
        onTouchMove={handleTouch}
        onTouchStart={handleTouch}
      >
        <Path
          d={generatePath()}
          stroke="black"
          strokeWidth="2"
          fill="none"
        />
      </Svg>
    </View>
  );
};

// Main App component
export default function App() {
  const { initAudio, togglePlayback, updateFrequency, isPlaying, frequency, audioData } = useAudioEngine();

  const handleVisualizerTouch = (x, y) => {
    const { width } = Dimensions.get('window');
    // Map touch position to frequency (200Hz to 2000Hz)
    const newFreq = 200 + (x / width) * 1800;
    updateFrequency(newFreq);
  };

  const handleButtonPress = () => {
    initAudio();
    togglePlayback();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <WaveformVisualizer 
        audioData={audioData}
        onTouch={handleVisualizerTouch}
      />
      
      <View style={styles.controls}>
        <TouchableOpacity 
          style={[styles.button, isPlaying && styles.buttonActive]}
          onPress={handleButtonPress}
        >
          <Text style={styles.buttonText}>
            {isPlaying ? 'STOP' : 'START'}
          </Text>
        </TouchableOpacity>
        
        <Text style={styles.frequencyText}>
          Frequency: {Math.round(frequency)}Hz
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
  },
});
