import React, { useState, useRef, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { Svg, Path } from 'react-native-svg';
import { Audio } from 'expo-audio';

// Real audio engine with platform-aware synthesis
const useAudioEngine = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [frequency, setFrequency] = useState(440);
  const [waveType, setWaveType] = useState('sine');
  const [amplitude, setAmplitude] = useState(0.3);
  const [audioData, setAudioData] = useState(new Array(1024).fill(128));
  const [debugInfo, setDebugInfo] = useState(''); // On-screen debug info
  const soundRef = useRef(null);
  
  // Web Audio API references (for web platform)
  const audioContextRef = useRef(null);
  const oscillatorRef = useRef(null);
  const gainNodeRef = useRef(null);
  const analyserRef = useRef(null);
  
  // HTML5 Audio fallback for mobile Safari
  const audioElementRef = useRef(null);
  const [usingFallbackAudio, setUsingFallbackAudio] = useState(false);
  
  // Timeout references for cleanup
  const waveformSwitchTimeoutRef = useRef(null);

  // Helper function to add debug info to screen
  const addDebugInfo = (message) => {
    console.log(message);
    setDebugInfo(prev => prev + '\n' + message);
  };

  // Helper function to clear debug info
  const clearDebugInfo = () => {
    setDebugInfo('');
  };

  // Helper function to check if we should use Web Audio API
  const shouldUseWebAudio = () => {
    return Platform.OS === 'web' && !usingFallbackAudio; // Both desktop and mobile Safari use Web Audio, unless fallback is needed
  };

  // Fallback audio using HTML5 Audio element (for mobile Safari if Web Audio fails)
  const createSimpleAudioTone = (freq, type, duration = 1) => {
    // This creates a simple beep using data URL - basic fallback
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < data.length; i++) {
      const t = i / audioContext.sampleRate;
      let sample;
      switch (type) {
        case 'sine': sample = Math.sin(2 * Math.PI * freq * t); break;
        case 'square': sample = Math.sign(Math.sin(2 * Math.PI * freq * t)); break;
        case 'sawtooth': sample = 2 * (freq * t - Math.floor(freq * t + 0.5)); break;
        case 'triangle': sample = 2 * Math.abs(2 * (freq * t - Math.floor(freq * t + 0.5))) - 1; break;
        default: sample = Math.sin(2 * Math.PI * freq * t);
      }
      data[i] = sample * amplitude * 0.3; // Apply amplitude
    }
    
    return buffer;
  };

  // Volume compensation matrix for different waveforms
  // Based on RMS (Root Mean Square) and perceived loudness
  const getVolumeCompensation = (waveType) => {
    const compensationMatrix = {
      'sine': 1.0,      // Reference level (smoothest waveform)
      'triangle': 0.7,  // Triangle waves are louder due to more harmonic content
      'sawtooth': 0.5,  // Sawtooth is much louder due to rich harmonics
      'square': 0.3     // Square waves are loudest due to fundamental + odd harmonics
    };
    return compensationMatrix[waveType] || 1.0;
  };

  // Simple mobile Safari audio using existing AudioContext
  const createMobileSafariAudio = async () => {
    try {
      addDebugInfo('Skipping HTML5 Audio, using Web Audio directly...');
      
      // Since AudioContext is created but suspended, let's try to use it directly
      if (audioContextRef.current) {
        addDebugInfo('Using existing AudioContext...');
        
        // Force resume more aggressively
        if (audioContextRef.current.state === 'suspended') {
          addDebugInfo('Attempting to resume suspended AudioContext...');
          await audioContextRef.current.resume();
          addDebugInfo('Resume attempt complete, state: ' + audioContextRef.current.state);
        }
        
        // Try creating a simple oscillator immediately
        try {
          const testOsc = audioContextRef.current.createOscillator();
          testOsc.frequency.setValueAtTime(440, audioContextRef.current.currentTime);
          testOsc.connect(gainNodeRef.current);
          testOsc.start();
          testOsc.stop(audioContextRef.current.currentTime + 0.2); // 200ms beep
          
          addDebugInfo('Test oscillator created and started!');
          setUsingFallbackAudio(false); // Use Web Audio, not fallback
          return true;
        } catch (oscError) {
          addDebugInfo('Oscillator test failed: ' + oscError.message);
          return false;
        }
      }
      
      addDebugInfo('No AudioContext available');
      return false;
    } catch (error) {
      addDebugInfo('Direct Web Audio failed: ' + error.message);
      return false;
    }
  };

  // Initialize audio system with platform detection
  const initAudio = async () => {
    try {
      // Detect mobile Safari specifically
      const isMobileSafari = Platform.OS === 'web' && 
        /iPad|iPhone|iPod/.test(navigator.userAgent) && 
        !window.MSStream;
      
      addDebugInfo('=== AUDIO INIT ===');
      addDebugInfo('Platform: ' + Platform.OS);
      addDebugInfo('Mobile Safari: ' + isMobileSafari);
      addDebugInfo('User Agent: ' + navigator.userAgent.slice(0, 50) + '...');
      
      if (isMobileSafari) {
        // For mobile Safari, try simple HTML5 Audio first
        addDebugInfo('Trying mobile Safari HTML5 audio...');
        const fallbackSuccess = await createMobileSafariAudio();
        
        if (fallbackSuccess) {
          addDebugInfo('Mobile Safari fallback audio working!');
          return;
        }
        
        // If fallback fails, try Web Audio API with very simple setup
        addDebugInfo('Fallback failed, trying Web Audio API...');
        try {
          if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            addDebugInfo('AudioContext created, state: ' + audioContextRef.current.state);
            
            gainNodeRef.current = audioContextRef.current.createGain();
            gainNodeRef.current.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
            gainNodeRef.current.connect(audioContextRef.current.destination);
            addDebugInfo('Gain node created and connected');
          }
          
          if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
            addDebugInfo('AudioContext resumed to: ' + audioContextRef.current.state);
          }
        } catch (error) {
          addDebugInfo('Web Audio failed: ' + error.message);
        }
      } else if (Platform.OS === 'web') {
        // Desktop web - full Web Audio API
        addDebugInfo('Setting up desktop Web Audio...');
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          
          gainNodeRef.current = audioContextRef.current.createGain();
          gainNodeRef.current.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
          
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 2048;
          
          gainNodeRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
          
          addDebugInfo('Desktop Web Audio ready');
        }
        
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
          addDebugInfo('Desktop AudioContext resumed');
        }
      } else {
        // Native mobile - expo-audio
        addDebugInfo('Setting up native mobile audio...');
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        addDebugInfo('Native mobile audio ready');
      }
      addDebugInfo('=== AUDIO INIT COMPLETE ===');
    } catch (error) {
      addDebugInfo('INIT FAILED: ' + error.message);
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
  const startWebAudioOscillator = (waveTypeParam = waveType) => {
    console.log('=== STARTING OSCILLATOR DEBUG ===');
    console.log('audioContextRef.current exists:', !!audioContextRef.current);
    console.log('oscillatorRef.current exists:', !!oscillatorRef.current);
    console.log('gainNodeRef.current exists:', !!gainNodeRef.current);
    
    if (audioContextRef.current && !oscillatorRef.current) {
      try {
        // Detect mobile Safari
        const isMobileSafari = Platform.OS === 'web' && 
          /iPad|iPhone|iPod/.test(navigator.userAgent) && 
          !window.MSStream;
        
        console.log('isMobileSafari:', isMobileSafari);
        console.log('AudioContext state before oscillator:', audioContextRef.current.state);
        
        oscillatorRef.current = audioContextRef.current.createOscillator();
        console.log('Oscillator created:', !!oscillatorRef.current);
        
        oscillatorRef.current.type = waveTypeParam;
        console.log('Oscillator type set to:', waveTypeParam);
        
        // Ensure frequency is valid before setting
        const safeFreq = isNaN(frequency) || !isFinite(frequency) ? 440 : frequency;
        oscillatorRef.current.frequency.setValueAtTime(safeFreq, audioContextRef.current.currentTime);
        console.log('Oscillator frequency set to:', safeFreq);
        
        // Connect to gain node
        oscillatorRef.current.connect(gainNodeRef.current);
        console.log('Oscillator connected to gain node');
        
        // For mobile Safari, ensure gain is connected to destination
        if (isMobileSafari) {
          console.log('Mobile Safari: ensuring gain -> destination connection');
          // Check if already connected by trying to connect (will error if already connected)
          try {
            gainNodeRef.current.disconnect();
            gainNodeRef.current.connect(audioContextRef.current.destination);
            console.log('Mobile Safari: gain reconnected to destination');
          } catch (e) {
            console.log('Mobile Safari: gain connection error (may already be connected):', e.message);
          }
        } else {
          // For desktop, connect to analyser if it exists
          if (analyserRef.current) {
            console.log('Desktop: ensuring gain -> analyser connection');
            try {
              gainNodeRef.current.disconnect();
              gainNodeRef.current.connect(analyserRef.current);
              console.log('Desktop: gain reconnected to analyser');
            } catch (e) {
              console.log('Desktop: gain connection error (may already be connected):', e.message);
            }
          }
        }
        
        // Start the oscillator
        console.log('Starting oscillator...');
        oscillatorRef.current.start();
        console.log('Oscillator started successfully');
        
        // Set volume with safety check and waveform compensation
        const safeAmplitude = isNaN(amplitude) || !isFinite(amplitude) ? 0.3 : amplitude;
        const compensation = getVolumeCompensation(waveTypeParam);
        const adjustedGain = safeAmplitude * 0.8 * compensation;
        gainNodeRef.current.gain.setValueAtTime(adjustedGain, audioContextRef.current.currentTime);
        
        console.log(`Started ${waveTypeParam} oscillator at ${safeFreq}Hz with amplitude ${safeAmplitude} (compensated gain: ${adjustedGain})`);
        console.log('Final AudioContext state:', audioContextRef.current.state);
        console.log('=== OSCILLATOR START COMPLETE ===');
      } catch (error) {
        console.error('Error in startWebAudioOscillator:', error);
        oscillatorRef.current = null; // Reset on error
      }
    } else {
      console.log('Skipping oscillator start - audioContext:', !!audioContextRef.current, 'oscillator already exists:', !!oscillatorRef.current);
    }
  };

  // Stop oscillator (Web Audio API) with proper cleanup
  const stopWebAudioOscillator = () => {
    if (oscillatorRef.current) {
      try {
        // Properly stop the oscillator
        oscillatorRef.current.stop();
        
        // Disconnect from all connected AudioNodes
        oscillatorRef.current.disconnect();
        
        // Clear the reference to allow garbage collection
        oscillatorRef.current = null;
        
        console.log('Oscillator stopped and cleaned up');
      } catch (error) {
        // Handle case where oscillator was already stopped
        console.warn('Error stopping oscillator (may already be stopped):', error);
        oscillatorRef.current = null; // Still clear the reference
      }
    }
  };

  // Update oscillator parameters
  // Update oscillator parameters (frequency and gain only - type changes require restart)
  const updateWebAudioOscillator = () => {
    if (oscillatorRef.current && audioContextRef.current) {
      // Ensure values are safe before setting
      const safeFreq = isNaN(frequency) || !isFinite(frequency) ? 440 : frequency;
      const safeAmplitude = isNaN(amplitude) || !isFinite(amplitude) ? 0.5 : amplitude;
      
      // Update frequency
      oscillatorRef.current.frequency.setValueAtTime(safeFreq, audioContextRef.current.currentTime);
      
      // Update gain with volume compensation
      const compensation = getVolumeCompensation(waveType);
      const adjustedGain = safeAmplitude * 0.8 * compensation;
      gainNodeRef.current.gain.setValueAtTime(adjustedGain, audioContextRef.current.currentTime);
      
      console.log(`Updated oscillator: frequency ${safeFreq}Hz, compensated gain: ${adjustedGain}`);
    }
  };

  const togglePlayback = async () => {
    try {
      // Detect mobile Safari for special handling
      const isMobileSafari = Platform.OS === 'web' && 
        /iPad|iPhone|iPod/.test(navigator.userAgent) && 
        !window.MSStream;
      
      if (isMobileSafari) {
        addDebugInfo('=== MOBILE SAFARI TOGGLE ===');
        
        if (isPlaying) {
          // Stop audio
          if (oscillatorRef.current) {
            oscillatorRef.current.stop();
            oscillatorRef.current = null;
            addDebugInfo('Mobile Safari: oscillator stopped');
          }
          setIsPlaying(false);
        } else {
          // Start audio immediately - most direct approach
          try {
            addDebugInfo('Creating AudioContext directly in toggle...');
            
            if (!audioContextRef.current) {
              audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
              addDebugInfo('AudioContext created, state: ' + audioContextRef.current.state);
            }
            
            // CRITICAL: Resume MUST happen in direct user event handler
            if (audioContextRef.current.state !== 'running') {
              addDebugInfo('Resuming AudioContext in direct user event...');
              await audioContextRef.current.resume();
              addDebugInfo('AudioContext state after resume: ' + audioContextRef.current.state);
            }
            
            // Create gain if needed
            if (!gainNodeRef.current) {
              gainNodeRef.current = audioContextRef.current.createGain();
              gainNodeRef.current.connect(audioContextRef.current.destination);
              addDebugInfo('Gain node created and connected');
            }
            
            // Create and start oscillator immediately
            const osc = audioContextRef.current.createOscillator();
            osc.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
            osc.type = waveType;
            osc.connect(gainNodeRef.current);
            
            // Set volume
            gainNodeRef.current.gain.setValueAtTime(amplitude * 0.3, audioContextRef.current.currentTime);
            
            osc.start(audioContextRef.current.currentTime);
            oscillatorRef.current = osc;
            
            addDebugInfo('Mobile Safari: oscillator started directly!');
            setIsPlaying(true);
            
          } catch (error) {
            addDebugInfo('Mobile Safari direct toggle failed: ' + error.message);
          }
        }
      } else {
        // Desktop/other platforms - original logic
        if (isPlaying) {
          if (shouldUseWebAudio()) {
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
          if (shouldUseWebAudio()) {
            // Aggressive AudioContext resumption for mobile Safari
            if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
              await audioContextRef.current.resume();
              console.log('AudioContext aggressively resumed before playback');
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
      }
      
      // Update visualization
      const waveformData = generateWaveform(frequency, waveType, amplitude);
      setAudioData(waveformData);
    } catch (error) {
      addDebugInfo('Toggle playback failed: ' + error.message);
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
    
    if (shouldUseWebAudio() && isPlaying) {
      updateWebAudioOscillator();
    }
    
    // Update visualization
    const waveformData = generateWaveform(newFreq, waveType, amplitude);
    setAudioData(waveformData);
  };

  const updateWaveType = async (newType) => {
    setWaveType(newType);
    console.log('Wave type updated:', newType);
    
    if (shouldUseWebAudio() && isPlaying) {
      // Clear any existing waveform switch timeout to prevent multiple oscillators
      if (waveformSwitchTimeoutRef.current) {
        clearTimeout(waveformSwitchTimeoutRef.current);
        waveformSwitchTimeoutRef.current = null;
      }
      
      // Stop current oscillator and ensure proper cleanup
      // Web Audio oscillators cannot change type once started
      stopWebAudioOscillator();
      
      // Wait for cleanup to complete before creating new oscillator
      waveformSwitchTimeoutRef.current = setTimeout(async () => {
        // Aggressive resume for mobile Safari on wave type changes
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
          console.log('AudioContext resumed during wave type change');
        }
        startWebAudioOscillator(newType);
        waveformSwitchTimeoutRef.current = null; // Clear reference after execution
      }, 20);
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
      // Apply volume compensation based on current waveform
      const compensation = getVolumeCompensation(waveType);
      const gainValue = clampedAmplitude * 0.8 * compensation;
      try {
        gainNodeRef.current.gain.setValueAtTime(gainValue, audioContextRef.current.currentTime);
        console.log('Gain node updated to:', gainValue, 'compensation:', compensation, 'at time:', audioContextRef.current.currentTime);
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
        
        switch (waveType) {
          case 'sine': 
            sample = Math.sin(t); 
            break;
          case 'square': 
            sample = Math.sign(Math.sin(t)); 
            break;
          case 'sawtooth': 
            sample = 2 * (t / (2 * Math.PI) - Math.floor(t / (2 * Math.PI) + 0.5)); 
            break;
          case 'triangle': 
            sample = 2 * Math.abs(2 * (t / (2 * Math.PI) - Math.floor(t / (2 * Math.PI) + 0.5))) - 1; 
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
        // Clean up any pending timeouts
        if (waveformSwitchTimeoutRef.current) {
          clearTimeout(waveformSwitchTimeoutRef.current);
          waveformSwitchTimeoutRef.current = null;
        }
        
        // Clean up oscillator first
        stopWebAudioOscillator();
        
        // Clean up audio context
        if (audioContextRef.current) {
          try {
            audioContextRef.current.close();
            audioContextRef.current = null;
          } catch (error) {
            console.warn('Error closing AudioContext:', error);
          }
        }
        
        // Clear remaining references
        gainNodeRef.current = null;
        analyserRef.current = null;
      } else {
        if (soundRef.current) {
          soundRef.current.unloadAsync().catch(console.error);
          soundRef.current = null;
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
    audioData,
    debugInfo,
    clearDebugInfo
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
      
      // Add smooth flowing animation when playing - preserve waveform characteristics
      const phaseOffset = isPlaying ? (animationOffset * 0.01 + index * 0.05) : 0;
      const animatedValue = isPlaying 
        ? normalizedValue + Math.sin(phaseOffset) * 0.05 // Subtle flow without distorting waveform shape
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
    audioData,
    debugInfo,
    clearDebugInfo
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
    try {
      if (!audioInitialized) {
        console.log('Initializing audio...');
        await initAudio();
        setAudioInitialized(true);
        
        // After initialization, start playback directly
        await togglePlayback();
        
        console.log('Audio initialized and started');
      } else {
        // Audio already initialized, just toggle playback
        await togglePlayback();
      }
    } catch (error) {
      console.error('Failed to handle button press:', error);
    }
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
        
        {/* On-screen debug info for mobile debugging */}
        {debugInfo && (
          <View style={styles.debugContainer}>
            <View style={styles.debugHeader}>
              <Text style={styles.debugTitle}>Debug Info:</Text>
              <TouchableOpacity 
                style={styles.clearDebugButton}
                onPress={clearDebugInfo}
              >
                <Text style={styles.clearDebugText}>✕ Clear</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.debugText}>{debugInfo}</Text>
          </View>
        )}
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
  debugContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#222',
    borderRadius: 5,
    maxHeight: 200,
    width: '90%',
  },
  debugHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  debugTitle: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  debugText: {
    color: '#ccc',
    fontSize: 10,
    fontFamily: 'monospace',
    lineHeight: 12,
  },
  clearDebugButton: {
    backgroundColor: '#007AFF',
    padding: 8,
    borderRadius: 5,
    minWidth: 60,
    alignItems: 'center',
  },
  clearDebugText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
