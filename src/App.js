import React, { useReducer, useCallback, useEffect, useState, useRef, useMemo } from 'react';

const initialState = {
  audioContext: null,
  oscillator: null,
  gainNode: null,
  filterNode: null,
  isPlaying: false,
  frequency: 440,
  filterFrequency: 1000,
  waveform: 'sine',
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_AUDIO_CONTEXT':
      return { ...state, audioContext: action.payload };
    case 'SET_OSCILLATOR':
      return { ...state, oscillator: action.payload };
    case 'SET_GAIN_NODE':
      return { ...state, gainNode: action.payload };
    case 'SET_FILTER_NODE':
      return { ...state, filterNode: action.payload };
    case 'SET_PLAYING':
      return { ...state, isPlaying: action.payload };
    case 'SET_FREQUENCY':
      return { ...state, frequency: action.payload };
    case 'SET_FILTER_FREQUENCY':
      return { ...state, filterFrequency: action.payload };
    case 'SET_WAVEFORM':
      return { ...state, waveform: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

const CustomKnob = ({ value, min, max, onChange, baseColor, indicatorColor, label }) => {
  const knobRef = useRef(null);
  const isDraggingRef = useRef(false);
  const startAngleRef = useRef(0);
  const startValueRef = useRef(0);

  const valueToAngle = useCallback((val) => {
    return ((val - min) / (max - min)) * 270 - 135;
  }, [min, max]);

  const angleToValue = useCallback((angle) => {
    const clampedAngle = Math.max(-135, Math.min(135, angle));
    return min + ((clampedAngle + 135) / 270) * (max - min);
  }, [min, max]);

  const rotateKnob = useCallback((angle) => {
    if (knobRef.current) {
      knobRef.current.style.transform = `rotate(${angle}deg)`;
    }
  }, []);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    const knobRect = knobRef.current.getBoundingClientRect();
    const knobCenter = {
      x: knobRect.left + knobRect.width / 2,
      y: knobRect.top + knobRect.height / 2
    };
    startAngleRef.current = Math.atan2(e.clientY - knobCenter.y, e.clientX - knobCenter.x);
    startValueRef.current = value;
    isDraggingRef.current = true;
  }, [value]);

  const handleMouseMove = useCallback((e) => {
    if (!isDraggingRef.current || !knobRef.current) return;

    const knobRect = knobRef.current.getBoundingClientRect();
    const knobCenter = {
      x: knobRect.left + knobRect.width / 2,
      y: knobRect.top + knobRect.height / 2
    };
    const currentAngle = Math.atan2(e.clientY - knobCenter.y, e.clientX - knobCenter.x);
    let angleDiff = (currentAngle - startAngleRef.current) * (180 / Math.PI);
    if (angleDiff > 180) angleDiff -= 360;
    if (angleDiff < -180) angleDiff += 360;

    const newAngle = valueToAngle(startValueRef.current) + angleDiff;
    const newValue = angleToValue(newAngle);

    rotateKnob(newAngle);
    onChange(newValue);
  }, [onChange, valueToAngle, angleToValue, rotateKnob]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      handleMouseMove(e);
    };

    const handleGlobalMouseUp = () => {
      handleMouseUp();
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  useEffect(() => {
    rotateKnob(valueToAngle(value));
  }, [value, valueToAngle, rotateKnob]);

  return (
    <div className="flex flex-col items-center">
      <svg
        width="70"
        height="70"
        viewBox="0 0 100 100"
        onMouseDown={handleMouseDown}
        className="cursor-pointer"
      >
        <circle cx="50" cy="50" r="45" fill={baseColor} fillOpacity="0.2" />
        <circle cx="50" cy="50" r="40" fill="white" />
        {[...Array(27)].map((_, i) => (
          <line
            key={i}
            x1="50"
            y1="10"
            x2="50"
            y2="15"
            stroke={indicatorColor}
            strokeWidth="1"
            transform={`rotate(${i * 10 - 135} 50 50)`}
            opacity={i % 3 === 0 ? 0.8 : 0.3}
          />
        ))}
        <g ref={knobRef} transform-origin="50 50">
          <circle cx="50" cy="50" r="3" fill={indicatorColor} />
          <rect
            x="48" y="10" width="4" height="20"
            fill={indicatorColor}
          />
        </g>
      </svg>
      <span className={`mt-2 text-xs font-semibold ${label === 'FREQUENCY' ? 'text-blue-600' : 'text-green-600'}`}>
        {label}
      </span>
    </div>
  );
};


const WebSynth = () => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const setupAudio = useCallback(() => {
    if (state.audioContext) return;

    try {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      dispatch({ type: 'SET_AUDIO_CONTEXT', payload: context });

      const osc = context.createOscillator();
      const gain = context.createGain();
      const filter = context.createBiquadFilter();

      osc.type = state.waveform;
      osc.frequency.setValueAtTime(state.frequency, context.currentTime);
      gain.gain.setValueAtTime(0, context.currentTime);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(state.filterFrequency, context.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);

      dispatch({ type: 'SET_OSCILLATOR', payload: osc });
      dispatch({ type: 'SET_GAIN_NODE', payload: gain });
      dispatch({ type: 'SET_FILTER_NODE', payload: filter });

      osc.start();
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to setup audio: ' + error.message });
    }
  }, [state.waveform, state.frequency, state.filterFrequency]);

  const handlePlayStop = useCallback(() => {
    if (!state.audioContext) {
      setupAudio();
      return;
    }

    try {
      if (state.audioContext.state === 'suspended') {
        state.audioContext.resume();
      }

      if (state.isPlaying) {
        state.gainNode.gain.setTargetAtTime(0, state.audioContext.currentTime, 0.015);
        dispatch({ type: 'SET_PLAYING', payload: false });
      } else {
        state.gainNode.gain.setTargetAtTime(0.5, state.audioContext.currentTime, 0.015);
        dispatch({ type: 'SET_PLAYING', payload: true });
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: 'Error in audio playback: ' + error.message });
    }
  }, [state.audioContext, state.isPlaying, state.gainNode, setupAudio]);

  const handleFrequencyChange = useCallback((newFrequency) => {
    dispatch({ type: 'SET_FREQUENCY', payload: newFrequency });
    if (state.oscillator && state.audioContext) {
      state.oscillator.frequency.setValueAtTime(newFrequency, state.audioContext.currentTime);
    }
  }, [state.oscillator, state.audioContext]);

  const handleFilterChange = useCallback((newFilterFrequency) => {
    dispatch({ type: 'SET_FILTER_FREQUENCY', payload: newFilterFrequency });
    if (state.filterNode && state.audioContext) {
      state.filterNode.frequency.setValueAtTime(newFilterFrequency, state.audioContext.currentTime);
    }
  }, [state.filterNode, state.audioContext]);

  const handleWaveformChange = useCallback((e) => {
    const newWaveform = e.target.value;
    dispatch({ type: 'SET_WAVEFORM', payload: newWaveform });
    if (state.oscillator) {
      state.oscillator.type = newWaveform;
    }
  }, [state.oscillator]);

  const renderKey = useCallback((freq, isSharp = false) => (
    <button
      className={`${isSharp ? 'w-6 h-24 bg-gray-800 -mx-3 z-10' : 'w-10 h-32 bg-white'} 
                  rounded-b-lg focus:outline-none transition-all duration-150 ease-in-out 
                  transform hover:scale-y-105 active:scale-y-95 active:bg-gray-300 shadow-md relative`}
      onMouseDown={() => {
        if (!state.audioContext) setupAudio();
        handleFrequencyChange(freq);
        if (!state.isPlaying) handlePlayStop();
      }}
      onMouseUp={() => {
        if (state.isPlaying) handlePlayStop();
      }}
      onTouchStart={() => {
        if (!state.audioContext) setupAudio();
        handleFrequencyChange(freq);
        if (!state.isPlaying) handlePlayStop();
      }}
      onTouchEnd={() => {
        if (state.isPlaying) handlePlayStop();
      }}
      aria-label={`Play ${freq}Hz note`}
    />
  ), [state.audioContext, setupAudio, handleFrequencyChange, state.isPlaying, handlePlayStop]);

  useEffect(() => {
    return () => {
      if (state.oscillator) {
        state.oscillator.stop();
        state.oscillator.disconnect();
      }
      if (state.gainNode) state.gainNode.disconnect();
      if (state.filterNode) state.filterNode.disconnect();
      if (state.audioContext) state.audioContext.close();
    };
  }, [state.oscillator, state.gainNode, state.filterNode, state.audioContext]);

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
    <div className="p-8 bg-white rounded-3xl shadow-2xl w-full max-w-[480px] font-sans">
        {state.error && (
          <div className="bg-red-500 text-white p-2 rounded mb-4" role="alert">
            {state.error}
          </div>
        )}
        <div className="bg-gray-200 p-6 rounded-2xl mb-6">
          <div className="bg-green-300 h-24 rounded-lg flex items-center justify-center text-3xl font-mono text-gray-800 shadow-inner">
            <div className={`transition-all duration-300 ${state.isPlaying ? 'scale-110' : 'scale-100'}`}>
              {state.waveform} - {Math.round(state.frequency)}Hz
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-6 mb-6">
          <CustomKnob
            value={state.frequency}
            min={20}
            max={2000}
            onChange={handleFrequencyChange}
            baseColor="#3B82F6"
            indicatorColor="#1D4ED8"
            label="FREQUENCY"
          />
          <CustomKnob
            value={state.filterFrequency}
            min={20}
            max={20000}
            onChange={handleFilterChange}
            baseColor="#10B981"
            indicatorColor="#047857"
            label="FILTER"
          />
          <div className="flex flex-col items-center justify-center">
            <button
              className={`w-16 h-16 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-300 transition-all duration-300 ease-in-out 
                          transform hover:scale-110 shadow-md text-lg font-bold
                          ${state.isPlaying ? 'bg-orange-500 text-white' : 'border-2 border-orange-300 text-orange-500'}`}
              onClick={handlePlayStop}
              aria-label={state.isPlaying ? 'Stop playback' : 'Start playback'}
            >
              {state.isPlaying ? 'Stop' : 'Play'}
            </button>
          </div>
          <div className="flex flex-col items-center justify-center">
            <select
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-300 shadow-md text-sm"
              value={state.waveform}
              onChange={handleWaveformChange}
              aria-label="Select waveform"
            >
              <option value="sine">Sine</option>
              <option value="square">Square</option>
              <option value="sawtooth">Sawtooth</option>
              <option value="triangle">Triangle</option>
            </select>
          </div>
        </div>
        <div className="relative h-48 flex justify-center">
          <div className="absolute flex">
            {renderKey(261.63)}
            {renderKey(277.18, true)}
            {renderKey(293.66)}
            {renderKey(311.13, true)}
            {renderKey(329.63)}
            {renderKey(349.23)}
            {renderKey(369.99, true)}
            {renderKey(392.00)}
            {renderKey(415.30, true)}
            {renderKey(440.00)}
            {renderKey(466.16, true)}
            {renderKey(493.88)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebSynth;
