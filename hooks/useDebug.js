import { useState } from 'react';

// Debug hook for development and troubleshooting
export const useDebug = (enabled = false) => {
  const [debugInfo, setDebugInfo] = useState('');

  const addDebugInfo = (message) => {
    if (enabled) {
      console.log(message);
      setDebugInfo(prev => prev + '\n' + message);
    }
  };

  const clearDebugInfo = () => {
    setDebugInfo('');
  };

  return {
    debugInfo,
    addDebugInfo,
    clearDebugInfo
  };
};