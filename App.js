import React, { useState, useRef, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, Platform, ScrollView } from 'react-native';
import { Svg, Path } from 'react-native-svg';
import { Audio } from 'expo-audio';

// Real audio engine with platform-aware synthesis
const useAudioEngine = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [frequency, setFrequency] = useState(440);
  const [waveType, setWaveType] = useState('sine');
  const [amplitude, setAmplitude] = useState(0.3);
  const [highFreqAttenuation, setHighFreqAttenuation] = useState(0.5); // 0 = no attenuation, 1 = maximum attenuation
  const [audioData, setAudioData] = useState(new Array(1024).fill(128));
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

  // Volume compensation matrix for different waveforms and frequency attenuation
  // Based on RMS (Root Mean Square), perceived loudness, and user-controlled frequency response
  const getVolumeCompensation = (waveType, frequency = 440, attenuationLevel = highFreqAttenuation) => {
    // Base compensation for waveform types
    const waveCompensation = {
      'sine': 1.0,      // Reference level (smoothest waveform)
      'triangle': 0.7,  // Triangle waves are louder due to more harmonic content
      'sawtooth': 0.5,  // Sawtooth is much louder due to rich harmonics
      'square': 0.3     // Square waves are loudest due to fundamental + odd harmonics
    };
    
    // User-controlled frequency-based attenuation
    // attenuationLevel: 0 = no attenuation, 1 = maximum attenuation
    const getFrequencyAttenuation = (freq, userAttenuation) => {
      if (freq <= 200) {
        // Very low frequencies: slight boost for audibility (not affected by attenuation control)
        return 1.2;
      } else if (freq <= 1000) {
        // Mid frequencies: neutral (most comfortable range, minimal attenuation effect)
        return 1.0 - (userAttenuation * 0.1); // Slight reduction at max attenuation
      } else if (freq <= 4000) {
        // High frequencies: user-controlled gentle attenuation
        const baseAttenuation = Math.pow(1000 / freq, 0.2); // Gentler base curve
        const userEffect = Math.pow(1000 / freq, userAttenuation * 0.6); // User control
        return baseAttenuation * userEffect;
      } else {
        // Very high frequencies: user-controlled stronger attenuation
        const baseAttenuation = Math.pow(1000 / freq, 0.3); // Moderate base curve
        const userEffect = Math.pow(1000 / freq, userAttenuation * 0.8); // Strong user control
        return baseAttenuation * userEffect;
      }
    };
    
    const waveComp = waveCompensation[waveType] || 1.0;
    const freqAtten = getFrequencyAttenuation(frequency, attenuationLevel);
    
    return waveComp * freqAtten;
  };

  // Simple mobile Safari audio using existing AudioContext
  const createMobileSafariAudio = async () => {
    try {
      // Since AudioContext is created but suspended, let's try to use it directly
      if (audioContextRef.current) {
        // Force resume more aggressively
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        
        // Try creating a simple oscillator immediately
        try {
          const testOsc = audioContextRef.current.createOscillator();
          testOsc.frequency.setValueAtTime(440, audioContextRef.current.currentTime);
          testOsc.connect(gainNodeRef.current);
          testOsc.start();
          testOsc.stop(audioContextRef.current.currentTime + 0.2); // 200ms beep
          
          setUsingFallbackAudio(false); // Use Web Audio, not fallback
          return true;
        } catch (oscError) {
          console.warn('Oscillator test failed:', oscError.message);
          return false;
        }
      }
      
      return false;
    } catch (error) {
      console.warn('Direct Web Audio failed:', error.message);
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
      
      if (isMobileSafari) {
        // For mobile Safari, try simple HTML5 Audio first
        const fallbackSuccess = await createMobileSafariAudio();
        
        if (fallbackSuccess) {
          return;
        }
        
        // If fallback fails, try Web Audio API with very simple setup
        try {
          if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            
            gainNodeRef.current = audioContextRef.current.createGain();
            gainNodeRef.current.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
            gainNodeRef.current.connect(audioContextRef.current.destination);
          }
          
          if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
          }
        } catch (error) {
          console.warn('Web Audio failed:', error.message);
        }
      } else if (Platform.OS === 'web') {
        // Desktop web - full Web Audio API
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          
          gainNodeRef.current = audioContextRef.current.createGain();
          gainNodeRef.current.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
          
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 2048;
          
          gainNodeRef.current.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
        }
        
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
      } else {
        // Native mobile - expo-audio
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      }
    } catch (error) {
      console.error('Audio initialization failed:', error.message);
    }
  };

  // Generate waveform data for visualization
  const generateWaveform = (freq, type, amp) => {
    return new Array(1024).fill(0).map((_, i) => {
      let sample;
      const cycles = 4; // Show 4 complete cycles for better visibility
      const t = (i / 1024) * cycles * 2 * Math.PI;
      
      switch (type) {
        case 'sine':
          sample = Math.sin(t);
          break;
        case 'square':
          sample = Math.sign(Math.sin(t));
          break;
        case 'sawtooth':
          // Proper sawtooth: linear ramp from -1 to 1, then instant drop
          const sawPhase = (t / (2 * Math.PI)) % 1;
          sample = 2 * sawPhase - 1;
          break;
        case 'triangle':
          // Proper triangle: up from -1 to 1, then down from 1 to -1
          const triPhase = (t / (2 * Math.PI)) % 1;
          sample = triPhase < 0.5 ? 4 * triPhase - 1 : 3 - 4 * triPhase;
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
        const compensation = getVolumeCompensation(waveTypeParam, safeFreq);
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
      const compensation = getVolumeCompensation(waveType, safeFreq);
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
        if (isPlaying) {
          // Stop audio
          if (audioElementRef.current) {
            audioElementRef.current.pause();
            audioElementRef.current = null;
          }
          if (oscillatorRef.current) {
            oscillatorRef.current.stop();
            oscillatorRef.current = null;
          }
          setIsPlaying(false);
        } else {
          // Standard mobile Safari approach - HTML5 Audio first
          try {
            // Create audio element in direct user gesture (CRITICAL)
            const audio = document.createElement('audio');
            
            // Generate a simple tone using data URL (standard approach)
            const duration = 2;
            const sampleRate = 8000; // Lower sample rate for mobile
            const frequency = 440;
            const amplitude = 0.3;
            
            // Create WAV header (minimal but valid)
            const samples = sampleRate * duration;
            const buffer = new ArrayBuffer(44 + samples * 2);
            const view = new DataView(buffer);
            
            // WAV header
            const writeString = (offset, string) => {
              for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
              }
            };
            
            writeString(0, 'RIFF');
            view.setUint32(4, 36 + samples * 2, true);
            writeString(8, 'WAVE');
            writeString(12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, 1, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * 2, true);
            view.setUint16(32, 2, true);
            view.setUint16(34, 16, true);
            writeString(36, 'data');
            view.setUint32(40, samples * 2, true);
            
            // Generate sine wave data
            for (let i = 0; i < samples; i++) {
              const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * amplitude * 32767;
              view.setInt16(44 + i * 2, sample, true);
            }
            
            // Create blob and play immediately
            const blob = new Blob([buffer], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            
            audio.src = url;
            audio.volume = 0.3;
            
            // CRITICAL: play() must be called synchronously in user gesture
            const playPromise = audio.play();
            
            if (playPromise) {
              playPromise.then(() => {
                audioElementRef.current = audio;
                setIsPlaying(true);
              }).catch(error => {
                console.warn('HTML5 Audio play failed:', error.message);
                // Fallback to Web Audio
                tryWebAudioFallback();
              });
            } else {
              audioElementRef.current = audio;
              setIsPlaying(true);
            }
            
          } catch (error) {
            console.warn('HTML5 Audio creation failed:', error.message);
            tryWebAudioFallback();
          }
        }
      } else {
        // Desktop/other platforms - original logic
        if (isPlaying) {
          if (shouldUseWebAudio()) {
            stopWebAudioOscillator();
          } else {
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
            if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
              await audioContextRef.current.resume();
              console.log('AudioContext aggressively resumed before playback');
            }
            startWebAudioOscillator();
          } else {
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
      console.error('Failed to toggle playback:', error);
    }
  };

  // Fallback function for mobile Safari
  const tryWebAudioFallback = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      
      oscillator.start();
      
      audioContextRef.current = audioContext;
      oscillatorRef.current = oscillator;
      gainNodeRef.current = gainNode;
      
      setIsPlaying(true);
    } catch (error) {
      console.warn('Web Audio fallback failed:', error.message);
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
      // Apply volume compensation based on current waveform and frequency
      const compensation = getVolumeCompensation(waveType, frequency);
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

  const updateHighFreqAttenuation = async (newAttenuation) => {
    // Validate attenuation value (0 to 1)
    if (isNaN(newAttenuation) || !isFinite(newAttenuation)) {
      console.warn('Invalid attenuation:', newAttenuation);
      return;
    }
    
    const clampedAttenuation = Math.max(0, Math.min(1, newAttenuation));
    setHighFreqAttenuation(clampedAttenuation);
    console.log('High frequency attenuation updated:', clampedAttenuation);
    
    // Update Web Audio gain immediately if oscillator is playing
    if (Platform.OS === 'web' && gainNodeRef.current && audioContextRef.current && isPlaying) {
      const compensation = getVolumeCompensation(waveType, frequency, clampedAttenuation);
      const gainValue = amplitude * 0.8 * compensation;
      try {
        gainNodeRef.current.gain.setValueAtTime(gainValue, audioContextRef.current.currentTime);
        console.log('Gain updated for new attenuation:', gainValue, 'attenuation level:', clampedAttenuation);
      } catch (error) {
        console.error('Error updating gain for attenuation:', error);
      }
    }
    
    // Update visualization
    const waveformData = generateWaveform(frequency, waveType, amplitude);
    setAudioData(waveformData);
  };

  // Update real-time audio data from analyser
  const updateAudioData = () => {
    // For desktop with Web Audio API and analyser (exclude mobile Safari)
    const isMobileSafari = Platform.OS === 'web' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (Platform.OS === 'web' && analyserRef.current && isPlaying && !isMobileSafari) {
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserRef.current.getByteTimeDomainData(dataArray);
      
      // Convert to our expected format (downsample if needed)
      const downsampledData = [];
      const step = Math.max(1, Math.floor(bufferLength / 1024));
      for (let i = 0; i < bufferLength; i += step) {
        if (downsampledData.length < 1024) {
          // Use real audio data directly
          downsampledData.push(dataArray[i]);
        }
      }
      
      // If we have enough real data, use it
      if (downsampledData.length >= 512) {
        // Pad to 1024 with the real data pattern
        while (downsampledData.length < 1024) {
          const sourceIndex = downsampledData.length % 512;
          downsampledData.push(downsampledData[sourceIndex]);
        }
        setAudioData(downsampledData);
        return;
      }
    }
    
    // For mobile Safari or when real audio data isn't available, use generated waveforms
    // Always generate fresh waveforms with current parameters
    const waveformData = generateWaveform(frequency, waveType, amplitude);
    setAudioData(waveformData);
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

  // Update visualization when parameters change (especially important for mobile Safari)
  useEffect(() => {
    if (isPlaying) {
      updateAudioData();
    }
  }, [frequency, waveType, amplitude, isPlaying]);

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
    updateHighFreqAttenuation,
    isPlaying,
    frequency,
    waveType,
    amplitude,
    highFreqAttenuation,
    audioData
  };
};

// SVG-based waveform visualization component
const WaveformVisualizer = ({ audioData, onTouch, isPlaying, theme, onDragStart, onDragEnd, onDragMove }) => {
  const [screenData, setScreenData] = useState(() => {
    const { width, height } = Dimensions.get('window');
    return { width, height };
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [animationOffset, setAnimationOffset] = useState(0);
  const animationRef = useRef();

  // Listen for orientation changes and screen size updates
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenData({ width: window.width, height: window.height });
    });

    return () => subscription?.remove();
  }, []);

  // Calculate responsive dimensions
  const getResponsiveDimensions = () => {
    const { width, height } = screenData;
    const isLandscape = width > height;
    
    // Adjust visualizer height based on orientation and screen size
    let visualizerHeight;
    if (isLandscape) {
      // In landscape, use more of the available height
      visualizerHeight = Math.max(200, height * 0.5);
    } else {
      // In portrait, standard allocation but ensure minimum height
      visualizerHeight = Math.max(250, height * 0.65);
    }
    
    // Ensure visualizer doesn't get too large on very big screens
    visualizerHeight = Math.min(visualizerHeight, 600);
    
    return {
      width,
      height,
      visualizerHeight,
      isLandscape,
      // Scale factors for different screen densities - more conservative scaling
      amplitudeScale: Math.min(1.2, Math.max(0.8, width / 375)), // Scale between 0.8x and 1.2x
      strokeWidth: Math.max(1.5, Math.min(3, width / 200))
    };
  };

  const dimensions = getResponsiveDimensions();

  // Animation loop for flowing waveform
  useEffect(() => {
    if (isPlaying) {
      let startTime = null;
      const animate = (currentTime) => {
        if (!startTime) startTime = currentTime;
        const elapsed = currentTime - startTime;
        
        // Move smoothly based on time, not frame rate
        setAnimationOffset((elapsed * 0.05) % dimensions.width); // Slower, smoother movement
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
  }, [isPlaying, dimensions.width]);

  // Generate SVG path from audio data with responsive dimensions
  const generatePath = () => {
    if (!audioData || audioData.length === 0) return '';

    const { width, visualizerHeight, amplitudeScale } = dimensions;
    const sliceWidth = width / audioData.length;
    let pathData = '';

    audioData.forEach((value, index) => {
      const x = index * sliceWidth;
      
      // Safety check for NaN values
      const safeValue = isNaN(value) || !isFinite(value) ? 128 : value;
      
      // Center the waveform and scale it properly with responsive amplitude
      const centerY = visualizerHeight / 2;
      
      // Improved amplitude calculation for better centering on all screen sizes
      const maxSafeAmplitude = visualizerHeight * 0.35; // Maximum 35% of height
      const scaledAmplitude = maxSafeAmplitude * Math.min(amplitudeScale, 1.2); // Limit scaling
      const amplitude = Math.min(scaledAmplitude, visualizerHeight * 0.4); // Ensure it never exceeds 40%
      
      // Normalize value from 0-255 range to -1 to 1 range, ensuring proper centering
      const normalizedValue = (safeValue - 128) / 127; // Use 127 instead of 128 for symmetric range
      
      // Add smooth flowing animation when playing - preserve waveform characteristics
      const phaseOffset = isPlaying ? (animationOffset * 0.01 + index * 0.05) : 0;
      const animatedValue = isPlaying 
        ? normalizedValue + Math.sin(phaseOffset) * 0.05 // Subtle flow without distorting waveform shape
        : normalizedValue;
      
      // Ensure the waveform is properly centered around centerY with safe bounds
      const rawY = centerY - (animatedValue * amplitude); // Subtract to invert Y axis (SVG coordinates)
      
      // Improved bounds checking - keep within safe margins from edges
      const margin = amplitude * 0.1; // 10% margin
      const minY = margin;
      const maxY = visualizerHeight - margin;
      const y = Math.max(minY, Math.min(maxY, rawY));
      
      // Ensure x and y are valid numbers
      const safeX = isNaN(x) || !isFinite(x) ? 0 : Math.max(0, Math.min(width, x));
      const safeY = isNaN(y) || !isFinite(y) ? centerY : y;
      
      if (index === 0) {
        pathData += `M ${safeX} ${safeY}`;
      } else {
        pathData += ` L ${safeX} ${safeY}`;
      }
    });

    return pathData;
  };

  // Helper function to calculate frequency from X position
  const calculateFrequencyFromX = (x) => {
    const clampedX = Math.max(0, Math.min(dimensions.width, x));
    const minFreq = 20;
    const maxFreq = 20000;
    const logMin = Math.log(minFreq);
    const logMax = Math.log(maxFreq);
    const logFreq = logMin + (clampedX / dimensions.width) * (logMax - logMin);
    return Math.exp(logFreq);
  };

  const handleResponderMove = (event) => {
    if (!isDragging) return;
    
    const { pageX, pageY } = event.nativeEvent;
    // Calculate relative X position within the visualizer
    const relativeX = pageX - (event.nativeEvent.target?.offsetLeft || 0);
    
    if (!isNaN(relativeX) && isFinite(relativeX)) {
      const frequency = calculateFrequencyFromX(relativeX);
      onTouch && onTouch(relativeX, 0);
      onDragMove && onDragMove(pageX, pageY, frequency);
    }
  };

  const handleResponderGrant = (event) => {
    setIsDragging(true);
    const { pageX, pageY } = event.nativeEvent;
    const relativeX = pageX - (event.nativeEvent.target?.offsetLeft || 0);
    
    if (!isNaN(relativeX) && isFinite(relativeX)) {
      const frequency = calculateFrequencyFromX(relativeX);
      onTouch && onTouch(relativeX, 0);
      onDragStart && onDragStart(pageX, pageY, frequency);
    }
  };

  const handleResponderRelease = () => {
    setIsDragging(false);
    onDragEnd && onDragEnd();
  };

  return (
    <View 
      style={[styles.visualizer, { height: dimensions.visualizerHeight }]}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={handleResponderGrant}
      onResponderMove={handleResponderMove}
      onResponderRelease={handleResponderRelease}
      onResponderTerminate={handleResponderRelease}
    >
      <Svg 
        width={dimensions.width} 
        height={dimensions.visualizerHeight}
      >
        {/* Background grid - responsive grid lines */}
        {isPlaying && (
          <>
            {/* Horizontal lines */}
            {Array.from({ length: 5 }, (_, i) => (
              <Path
                key={`grid-h-${i}`}
                d={`M 0 ${(i * dimensions.visualizerHeight) / 4} L ${dimensions.width} ${(i * dimensions.visualizerHeight) / 4}`}
                stroke="#333"
                strokeWidth="1"
                opacity="0.2"
              />
            ))}
            {/* Vertical lines - adjust count based on screen width */}
            {Array.from({ length: Math.min(9, Math.floor(dimensions.width / 50)) }, (_, i) => (
              <Path
                key={`grid-v-${i}`}
                d={`M ${(i * dimensions.width) / (Math.min(8, Math.floor(dimensions.width / 50) - 1))} 0 L ${(i * dimensions.width) / (Math.min(8, Math.floor(dimensions.width / 50) - 1))} ${dimensions.visualizerHeight}`}
                stroke="#333"
                strokeWidth="1"
                opacity="0.2"
              />
            ))}
            {/* Center line */}
            <Path
              d={`M 0 ${dimensions.visualizerHeight / 2} L ${dimensions.width} ${dimensions.visualizerHeight / 2}`}
              stroke="#555"
              strokeWidth="1"
              opacity="0.4"
            />
          </>
        )}
        
        {/* Main waveform with responsive stroke width and theme colors */}
        <Path
          d={generatePath()}
          stroke={isPlaying ? theme.primary : "#666"}
          strokeWidth={dimensions.strokeWidth}
          fill="none"
          opacity={isPlaying ? 1.0 : 0.7}
        />
        
        {/* Glow effect when playing - responsive with theme colors */}
        {isPlaying && (
          <Path
            d={generatePath()}
            stroke={theme.accent}
            strokeWidth={dimensions.strokeWidth * 2}
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
    updateHighFreqAttenuation,
    isPlaying, 
    frequency, 
    waveType,
    amplitude,
    highFreqAttenuation,
    audioData
  } = useAudioEngine();
  const [audioInitialized, setAudioInitialized] = useState(false);
  
  // First-time visitor message
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);
  
  // Audio status dismissable state
  const [showAudioStatus, setShowAudioStatus] = useState(true);
  
  // Drag tooltip state
  const [dragTooltip, setDragTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    frequency: 0
  });

  // Theme system with predefined color schemes
  const themes = [
    { name: 'Blue', primary: '#007AFF', secondary: '#0056CC', accent: '#66B2FF' },
    { name: 'Green', primary: '#34C759', secondary: '#248A3D', accent: '#5DD87E' },
    { name: 'Purple', primary: '#AF52DE', secondary: '#7C37A3', accent: '#C98AEB' },
    { name: 'Orange', primary: '#FF9500', secondary: '#CC7700', accent: '#FFB84D' },
    { name: 'Red', primary: '#FF3B30', secondary: '#CC2E25', accent: '#FF7069' },
    { name: 'Pink', primary: '#FF2D92', secondary: '#CC2475', accent: '#FF66AA' },
    { name: 'Teal', primary: '#5AC8FA', secondary: '#48A0C8', accent: '#7DD3FC' }
  ];

  const [currentTheme, setCurrentTheme] = useState(0);
  const theme = themes[currentTheme];

  // Get screen dimensions for responsive styling
  const { width: screenWidth } = Dimensions.get('window');

  const handleVisualizerTouch = (x, y) => {
    const { width } = Dimensions.get('window');
    // Map touch position to frequency (20Hz to 20kHz - full human hearing range)
    // Use logarithmic scaling for more natural frequency distribution
    const safeX = isNaN(x) || x === undefined ? width / 2 : x;
    const clampedX = Math.max(0, Math.min(width, safeX));
    
    // Logarithmic frequency mapping for better musical intervals
    const minFreq = 20;   // 20Hz - lowest human hearing
    const maxFreq = 20000; // 20kHz - highest human hearing
    const logMin = Math.log(minFreq);
    const logMax = Math.log(maxFreq);
    const logFreq = logMin + (clampedX / width) * (logMax - logMin);
    const newFreq = Math.exp(logFreq);
    
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

  // Tooltip handlers for drag interaction
  const handleDragStart = (x, y, frequency) => {
    setDragTooltip({
      visible: true,
      x,
      y,
      frequency
    });
  };

  const handleDragMove = (x, y, frequency) => {
    setDragTooltip(prev => ({
      ...prev,
      x,
      y,
      frequency
    }));
  };

  const handleDragEnd = () => {
    setDragTooltip(prev => ({
      ...prev,
      visible: false
    }));
  };

  const waveTypes = ['sine', 'square', 'sawtooth', 'triangle'];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <WaveformVisualizer 
        audioData={audioData}
        onTouch={handleVisualizerTouch}
        isPlaying={isPlaying}
        theme={theme}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      />
      
      {/* Frequency Display - positioned top right */}
      <View style={styles.frequencyOverlay}>
        <Text style={styles.frequencyOverlayText}>
          {frequency >= 1000 ? `${(frequency / 1000).toFixed(1)}kHz` : `${Math.round(frequency)}Hz`}
        </Text>
      </View>
      
      {/* Drag Tooltip */}
      {dragTooltip.visible && (
        <View style={[
          styles.tooltip,
          {
            position: 'absolute',
            left: dragTooltip.x + 10,
            top: dragTooltip.y - 40,
            backgroundColor: theme.secondary,
            borderColor: theme.primary,
          }
        ]}>
          <Text style={[styles.tooltipText, { color: theme.text }]}>
            {Math.round(dragTooltip.frequency)} Hz
          </Text>
        </View>
      )}
      
      {/* Welcome Message */}
      {showWelcomeMessage && (
        <View style={styles.welcomeOverlay}>
          <View style={[
            styles.welcomeMessage, 
            { 
              backgroundColor: theme.background, 
              borderColor: theme.primary,
              padding: screenWidth < 768 ? 20 : 24,
              margin: screenWidth < 768 ? 15 : 20,
              maxWidth: screenWidth < 768 ? screenWidth - 40 : 400,
            }
          ]}>
            <Text style={[styles.welcomeTitle, { color: theme.primary }]}>
              Welcome to Audio Art Expo!
            </Text>
            <Text style={[styles.welcomeText, { color: 'white' }]}>
              Tap or click and drag anywhere on the waveform to change the frequency and create your own interactive audio art.
            </Text>
            <TouchableOpacity 
              style={[styles.welcomeButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowWelcomeMessage(false)}
            >
              <Text style={[styles.welcomeButtonText, { color: theme.background }]}>
                Got it!
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      <View style={[
        styles.controls,
        {
          padding: 0, // Remove padding from outer container
          paddingVertical: 0,
        }
      ]}>
        <ScrollView 
          style={{ flex: 1, width: '100%' }}
          contentContainerStyle={{
            padding: screenWidth < 768 ? 10 : 15,
            paddingVertical: screenWidth < 768 ? 15 : 20,
            paddingBottom: screenWidth < 768 ? 20 : 25,
            alignItems: 'center',
          }}
          showsVerticalScrollIndicator={true}
          bounces={true}
        >
        
        {/* Audio Status - dismissable */}
        {showAudioStatus && (
          <View style={styles.audioStatusContainer}>
            <Text style={styles.statusText}>
              Audio: {audioInitialized ? 'Ready' : 'Not initialized'}
            </Text>
            <TouchableOpacity 
              style={styles.dismissButton}
              onPress={() => setShowAudioStatus(false)}
            >
              <Text style={styles.dismissButtonText}>×</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <TouchableOpacity 
          style={[
            styles.button, 
            { 
              backgroundColor: isPlaying ? theme.secondary : theme.primary,
              marginBottom: screenWidth < 768 ? 20 : 15
            }
          ]}
          onPress={handleButtonPress}
        >
          <Text style={styles.buttonText}>
            {isPlaying ? 'STOP' : (!audioInitialized ? 'TAP TO START' : 'START')}
          </Text>
        </TouchableOpacity>
        
        {/* Wave Type Selector - moved below start button */}
        <View style={[
          styles.waveTypeContainer,
          { marginVertical: screenWidth < 768 ? 8 : 6 }
        ]}>
          <View style={styles.waveTypeButtons}>
            {waveTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.waveTypeButton,
                  waveType === type && { backgroundColor: theme.primary }
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
        
        <View style={[
          styles.amplitudeContainer,
          { marginVertical: screenWidth < 768 ? 8 : 6 }
        ]}>
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
              <View style={[
                styles.amplitudeBar, 
                { 
                  width: `${amplitude * 100}%`,
                  backgroundColor: theme.primary
                }
              ]} />
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
        
        <View style={[
          styles.amplitudeContainer,
          { marginVertical: screenWidth < 768 ? 8 : 6 }
        ]}>
          <Text style={styles.labelText}>
            High Freq Attenuation: {Math.round(highFreqAttenuation * 100)}%
          </Text>
          <View 
            style={styles.amplitudeSlider}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(evt) => {
              const { locationX } = evt.nativeEvent;
              const sliderWidth = 200; // Approximate slider width
              const newAttenuation = Math.max(0, Math.min(1, locationX / sliderWidth));
              updateHighFreqAttenuation(newAttenuation);
            }}
            onResponderMove={(evt) => {
              const { locationX } = evt.nativeEvent;
              const sliderWidth = 200; // Approximate slider width
              const newAttenuation = Math.max(0, Math.min(1, locationX / sliderWidth));
              updateHighFreqAttenuation(newAttenuation);
            }}
          >
            <TouchableOpacity
              style={styles.amplitudeButton}
              onPress={() => {
                const newValue = Math.max(0.0, highFreqAttenuation - 0.1);
                updateHighFreqAttenuation(newValue);
              }}
            >
              <Text style={styles.amplitudeButtonText}>-</Text>
            </TouchableOpacity>
            <View style={styles.amplitudeTrack}>
              <View style={[styles.amplitudeBar, { 
                width: `${highFreqAttenuation * 100}%`,
                backgroundColor: theme.secondary // Use secondary theme color for distinction
              }]} />
            </View>
            <TouchableOpacity
              style={styles.amplitudeButton}
              onPress={() => {
                const newValue = Math.min(1.0, highFreqAttenuation + 0.1);
                updateHighFreqAttenuation(newValue);
              }}
            >
              <Text style={styles.amplitudeButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Theme Selector - moved to bottom */}
        <View style={[
          styles.themeContainer,
          { marginBottom: screenWidth < 768 ? 25 : 20 }
        ]}>
          <Text style={styles.labelText}>Theme:</Text>
          <View style={styles.themeSelector}>
            {themes.map((themeOption, index) => (
              <TouchableOpacity
                key={themeOption.name}
                style={[
                  styles.themeCircle,
                  { backgroundColor: themeOption.primary },
                  currentTheme === index && styles.themeCircleActive
                ]}
                onPress={() => setCurrentTheme(index)}
              />
            ))}
          </View>
        </View>
        
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  visualizer: {
    backgroundColor: '#ccc',
    width: '100%',
    flex: 1,
  },
  controls: {
    backgroundColor: '#000',
    flex: 1,
    width: '100%',
    maxHeight: '40%',
  },
  button: {
    backgroundColor: '#333',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 12,
  },
  buttonActive: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  themeContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  themeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 5,
  },
  themeCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  themeCircleActive: {
    borderColor: 'white',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 0px 4px rgba(255, 255, 255, 0.5)',
    } : {
      shadowColor: 'white',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 4,
    }),
    elevation: 5,
  },
  frequencyText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 5,
  },
  frequencyOverlay: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 100,
  },
  frequencyOverlayText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusText: {
    color: '#ccc',
    fontSize: 14,
  },
  audioStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#222',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
    width: '90%',
  },
  dismissButton: {
    backgroundColor: '#444',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  dismissButtonText: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: 'bold',
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
  tooltip: {
    backgroundColor: '#333',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
    } : {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    }),
    elevation: 5,
    zIndex: 1000,
  },
  tooltipText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  welcomeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  welcomeMessage: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 2,
    padding: 24,
    margin: 20,
    maxWidth: 400,
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  welcomeButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  welcomeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});
