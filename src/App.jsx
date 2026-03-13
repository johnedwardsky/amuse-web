import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import LZString from 'lz-string';

const PEN_STYLES = {
  RAINBOW: 0,
  BW: 1,
  KALEIDOSCOPE: 2,
  BLUE: 3,
  GOLDEN: 4,
  FRAGMENTED: 5,
  HOLOGRAPHIC: 6,
  SILK: 7,
  SILK_INVERSE: 8
};

const BRIGHTNESS_MODES = {
  DIV10: 4,
  DIV5: 5,
  X1: 1,
  X2: 2,
  X3: 3
};

const MODES = {
  ORIGINAL: 'Linkage (Original Math)',
  CYMATICS: 'Cymatics (Chladni Plate)',
};

const INITIAL_PARAMS = {
  mode: MODES.ORIGINAL,
  acceleration: 73,
  rotorRPM: 4,
  baseoffsx: 0,
  baseoffsy: -385,
  handdist: 351,
  soundEnabled: false,

  // Left Hand
  lrpm: 2,
  larma: 0,
  larm1: 105,
  larm2: 316,

  // Right Hand
  rrpm: -3,
  rarm1: 95,
  rarm2: 371,
  rarmext: 53,

  // Visuals
  penStyle: PEN_STYLES.RAINBOW,
  brightnessMode: BRIGHTNESS_MODES.X1,
  lineWidth: 1.0,
  glow: false,
  symmetry: 1, // 1 = none, 2, 4, 6, 8, 12
  autoEvolve: false,
  particlesEnabled: false,
  showArms: false,
  mouseInteraction: false,
  showFinishPoint: false,
  zoom: 1.0,
  lensEnabled: false,
  strobeEnabled: false,
  theme: 'space',

  // Synth Params
  synthWaveform: 'sine', // sine, square, sawtooth, triangle
  synthScale: 'chromatic', // chromatic, major, minor, pentatonic
  synthDelay: 0.3, // seconds
  synthFeedback: 0.4, // 0-1
  synthReverb: 0.5, // 0-1
  synthCutoff: 800, // 200 - 5000 Hz
  synthResonance: 1, // 1 - 20
  synthTranspose: 0, // -12 to +12 semitones
  synthComplexity: 1.0, // 0.5 to 2.0 (affects chord spread)
  synthDrive: 0, // 0 to 100 (saturation)
  synthLFOFreq: 2.0, // 0-10 Hz
  synthLFOAmount: 0, // 0-1 (pulse intensity)
  synthArpSpeed: 0, // 0-20 (0 = off)
  synthArpRange: 1, // 1-3 octaves
  synthMelodyVol: 0.3, // 0-1 (continuous synth volume)
  synthChordVol: 0.5, // 0-1 (pad chord volume)

  // Other features
  livedraw: true,
  cutpixels: true,
  autoStop: true, // NEW: Stop when pattern is complete

  // Cymatics Params
  cymaticsN: 3,
  cymaticsM: 2,
  cymaticsSensitivity: 1.5,
  cymaticsParticleCount: 15000,
  cymaticsFriction: 0.95,
  cymaticsSpeed: 0.5,
  cymaticsFieldMode: false, // Grid/Field view
  cymaticsRainbowMode: true, // Multi-band spectral coloring
  cymaticsGhostMode: false,   // Trailing/Shadow effect
  cymaticsOilMode: false,      // Art/Oil painting effect
  cymaticsSpin: 0,            // Rotation speed
  cymaticsZoom: 0,            // Flight/Zoom speed
  cymaticsCircular: false,     // Circular canvas/plate
  cymaticsRippleMode: true    // Rhythmic ripple waves
};

function App() {
  const canvasRef = useRef(null);
  const [params, setParams] = useState(INITIAL_PARAMS);

  const [isRunning, setIsRunning] = useState(false);
  const [cycleProgress, setCycleProgress] = useState(0); // NEW: Track % of completion

  const [canvasSize] = useState({ width: 2400, height: 1800 });
  const [baseScale, setBaseScale] = useState(1);
  const [currentNote, setCurrentNote] = useState({ name: '-', octave: 0, freq: 0 });
  const [currentKey, setCurrentKey] = useState({ name: 'C', scale: [0, 2, 4, 5, 7, 9, 11], mode: 'major' });
  const [viewMode, setViewMode] = useState(false); // NEW: View-only mode for shared links
  const [sharingItem, setSharingItem] = useState(null); // NEW: Track item currently being shared
  const [collapsedSections, setCollapsedSections] = useState({
    quickRandom: false, // Expanded by default
    viewExport: true,
    coreEngine: false, // Expanded by default
    armBase: true,
    genArtEngine: true,
    viewControls: true,
    leftMechanism: true,
    rightMechanism: true,
    penStyle: false, // Expanded by default
    spiroSynth: true,
    sonicEQ: true,
    genPerf: true,
    gallery: false, // Expanded by default
    cymaticsLab: false // Expanded by default
  });

  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const containerRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const requestRef = useRef();
  const debugCanvasRef = useRef();

  const particlesRef = useRef([]);

  const evolutionOffset = useRef(0);
  const isRunningRef = useRef(isRunning);
  const frameCount = useRef(0);
  const lastMouseMoveTime = useRef(0);

  // Performance limits
  const MAX_SVG_LINES = 50000; // Prevent memory overflow
  const MOUSE_THROTTLE_MS = 16; // ~60fps max for mouse tracking
  const MAX_FRAMES_PER_SESSION = 1000000; // Safety limit

  // Auto-chord progression system
  const lastAutoChordTime = useRef(0);
  const autoChordInterval = useRef(6 + Math.random() * 2); // 6-8 seconds

  // Cymatics Refs
  const cymaticsParticles = useRef([]);
  const analyserRef = useRef(null);
  const audioSourceRef = useRef(null);
  const cymaticsAudioBufferRef = useRef(null);
  const cymaticsStartTimeRef = useRef(0);
  const cymaticsOffsetRef = useRef(0);
  const cymaticsRipplesRef = useRef([]); // NEW: Beat-driven ripples
  const cymaticsBeatThresholdsRef = useRef([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]); // Adaptive thresholds for rhythm
  const waveformCanvasRef = useRef(null);
  const waveformPeaksRef = useRef([]); // Pre-computed amplitude peaks for full waveform
  const waveformDraggingRef = useRef(false);
  const cymaticsEnvelopesRef = useRef(new Array(7).fill(0)); // Energy tracking for 7 bands
  const cymaticsRotationRef = useRef(0); // For Spin effect

  const [cymaticsTrackName, setCymaticsTrackName] = useState(null);
  const [cymaticsDuration, setCymaticsDuration] = useState(0);
  const [cymaticsCurrentTime, setCymaticsCurrentTime] = useState(0);
  const [cymaticsPlaying, setCymaticsPlaying] = useState(false);
  const cymaticsPlayingRef = useRef(false);

  // Poll current playback position every 250ms
  useEffect(() => {
    if (!cymaticsPlaying) return;
    const id = setInterval(() => {
      if (audioCtx.current && cymaticsPlayingRef.current) {
        const elapsed = audioCtx.current.currentTime - cymaticsStartTimeRef.current;
        const pos = Math.max(0, elapsed % (cymaticsDuration || 1));
        setCymaticsCurrentTime(pos);
      }
    }, 250);
    return () => clearInterval(id);
  }, [cymaticsPlaying, cymaticsDuration]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  const [gallery, setGallery] = useState([]);
  const [isGalleryLoaded, setIsGalleryLoaded] = useState(false); // NEW: Migration guard
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // NEW: Mobile UI control
  const cycleTargetRef = useRef(null);
  const rotationCounterRef = useRef(0);

  // Helper: Mathematics for cycle detection
  const calculateCycle = (p) => {
    const getGCD = (a, b) => {
      a = Math.abs(a); b = Math.abs(b);
      while (b) { a %= b;[a, b] = [b, a]; }
      return a;
    };
    const getLCM = (a, b) => (a * b) / getGCD(a, b);

    // Filter active RPMs and normalize to 3 decimal scale
    const activeRPMs = [p.rotorRPM, p.lrpm, p.rrpm]
      .filter(r => Math.abs(r) > 0.0001)
      .map(r => Math.round(Math.abs(r) * 1000));

    if (activeRPMs.length < 1) return Infinity;

    try {
      // For each RPM, we need to know how many full 2*PI logical cycles it takes to be "integer"
      // T_i = 1000 / GCD(I_i, 1000)
      const periods = activeRPMs.map(I => 1000 / getGCD(I, 1000));

      let fullCycle = periods[0];
      for (let i = 1; i < periods.length; i++) {
        fullCycle = getLCM(fullCycle, periods[i]);
        if (fullCycle > 5000) return Infinity; // Too complex -> Endless
      }
      return fullCycle * Math.PI * 2; // Return in total radians for a "logical 1RPM clock"
    } catch {
      return Infinity;
    }
  };

  // Load Gallery and Scan for Lost Presets
  useEffect(() => {
    const initGallery = async () => {
      if (window.api) {
        // 1. Try to load from new file-based storage
        let saved = await window.api.getPresets();

        // 2. If empty, try to migrate from old LocalStorage
        if (!saved || saved.length === 0) {
          const lsData = localStorage.getItem('spiro_gallery');
          if (lsData) {
            saved = JSON.parse(lsData);
            console.log('Migrating from LocalStorage');
          } else {
            // 3. Last resort: Scan all possible data folders for hidden logs
            const scanned = await window.api.scanOldPresets();
            if (scanned && scanned.length > 0) {
              // Deduplicate scanned presets
              const seen = new Set();
              saved = scanned.filter(p => {
                const key = JSON.stringify(p.params);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              });
              alert(`🎉 We found and restored ${saved.length} lost presets!`);
            }
          }
        }

        if (saved && saved.length > 0) {
          setGallery(saved);
        }
        setIsGalleryLoaded(true); // MARK AS LOADED
      } else {
        // Fallback for browser testing
        const saved = localStorage.getItem('spiro_gallery');
        if (saved) setGallery(JSON.parse(saved));
        setIsGalleryLoaded(true);
      }
    };
    initGallery();
  }, []);

  // Sync Gallery to File
  useEffect(() => {
    if (isGalleryLoaded) { // ONLY SAVE IF LOADED
      if (window.api) {
        window.api.savePresets(gallery);
      } else {
        localStorage.setItem('spiro_gallery', JSON.stringify(gallery));
      }
    }
  }, [gallery, isGalleryLoaded]);

  const refreshGallery = async () => {
    if (window.api) {
      const saved = await window.api.getPresets();
      if (saved) setGallery(saved);
    }
  };

  // Initial loading simulation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const audioCtx = useRef(null);
  const oscillator = useRef(null);
  const gainNode = useRef(null);
  const panner = useRef(null);
  const delayNode = useRef(null);
  const feedbackNode = useRef(null);
  const reverbNode = useRef(null);
  const reverbGain = useRef(null);
  const lfoOsc = useRef(null);
  const lfoGain = useRef(null);
  const masterFilter = useRef(null);
  const masterDrive = useRef(null);
  const chordGain = useRef(null); // Master gain for all chord/pad notes
  const arpState = useRef({ index: 0, tick: 0 });
  // modulationRef removed (unused)

  const SCALES = {
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    pentatonic: [0, 3, 5, 7, 10],
    blues: [0, 3, 5, 6, 7, 10]
  };

  const initAudio = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx.current = new AudioContext();

    oscillator.current = audioCtx.current.createOscillator();
    oscillator.current.type = params.synthWaveform;

    gainNode.current = audioCtx.current.createGain();
    gainNode.current.gain.value = params.synthMelodyVol;

    panner.current = audioCtx.current.createStereoPanner();

    // FX Chain: Delay
    delayNode.current = audioCtx.current.createDelay();
    delayNode.current.delayTime.value = params.synthDelay;

    feedbackNode.current = audioCtx.current.createGain();
    feedbackNode.current.gain.value = params.synthFeedback;

    // --- MASTER PROCESSING CHAIN ---
    masterFilter.current = audioCtx.current.createBiquadFilter();
    masterFilter.current.type = 'lowpass';
    masterFilter.current.frequency.value = params.synthCutoff;
    masterFilter.current.Q.value = params.synthResonance;

    masterDrive.current = audioCtx.current.createWaveShaper();
    const updateDrive = (k) => {
      const n_samples = 44100;
      const curve = new Float32Array(n_samples);
      const deg = Math.PI / 180;
      for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1;
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
      masterDrive.current.curve = curve;
    };
    updateDrive(params.synthDrive);
    masterDrive.current.oversampling = '4x';

    // Internal Master Vol for safety
    const masterVol = audioCtx.current.createGain();
    masterVol.gain.value = 0.8;

    // Chord Master Gain (for real-time volume control)
    chordGain.current = audioCtx.current.createGain();
    chordGain.current.gain.value = params.synthChordVol;

    // Routing: [Sound Sources] -> masterFilter -> masterDrive -> masterVol -> Destination
    // Chords route: -> chordGain -> masterFilter -> ...
    masterFilter.current.connect(masterDrive.current);
    masterDrive.current.connect(masterVol);
    masterVol.connect(audioCtx.current.destination);

    // FX Chain: Ambient Reverb (Generated Impulse)
    reverbNode.current = audioCtx.current.createConvolver();
    reverbGain.current = audioCtx.current.createGain();
    reverbGain.current.gain.value = params.synthReverb;

    // Generate procedural impulse response for reverb
    const length = audioCtx.current.sampleRate * 3; // 3 seconds
    const impulse = audioCtx.current.createBuffer(2, length, audioCtx.current.sampleRate);
    for (let c = 0; c < 2; c++) {
      const channelData = impulse.getChannelData(c);
      for (let i = 0; i < length; i++) {
        channelData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (audioCtx.current.sampleRate * 1.5));
      }
    }
    reverbNode.current.buffer = impulse;

    // Routing: Osc -> Gain -> Panner -> (Split)
    panner.current.connect(audioCtx.current.destination);

    // Delay Path
    panner.current.connect(delayNode.current);
    delayNode.current.connect(feedbackNode.current);
    feedbackNode.current.connect(delayNode.current);
    delayNode.current.connect(audioCtx.current.destination);

    // FX Chain: LFO (Pulse)
    lfoOsc.current = audioCtx.current.createOscillator();
    lfoGain.current = audioCtx.current.createGain();

    lfoOsc.current.frequency.value = params.synthLFOFreq;
    lfoGain.current.gain.value = params.synthLFOAmount;
    lfoOsc.current.type = 'sine';

    // Modulate main gain with LFO
    lfoOsc.current.connect(lfoGain.current);
    lfoGain.current.connect(gainNode.current.gain);

    // Reverb Path (Routes from Master Filter for unified sound)
    masterFilter.current.connect(reverbNode.current);
    reverbNode.current.connect(reverbGain.current);
    reverbGain.current.connect(audioCtx.current.destination);

    // Delay Path
    masterFilter.current.connect(delayNode.current);
    delayNode.current.connect(feedbackNode.current);
    feedbackNode.current.connect(delayNode.current);
    delayNode.current.connect(audioCtx.current.destination);

    lfoOsc.current.start();
    oscillator.current.start();
  };

  const resetAudio = async () => {
    if (audioCtx.current) {
      try {
        // AGGRESSIVE CLEANUP: Disconnect everything first
        if (gainNode.current) {
          gainNode.current.gain.cancelScheduledValues(audioCtx.current.currentTime);
          gainNode.current.gain.setValueAtTime(0, audioCtx.current.currentTime);
          gainNode.current.disconnect();
        }

        // Kill feedback loop by zeroing feedback gain
        if (feedbackNode.current) {
          feedbackNode.current.gain.setValueAtTime(0, audioCtx.current.currentTime);
          feedbackNode.current.disconnect();
        }

        // Disconnect all nodes
        if (delayNode.current) delayNode.current.disconnect();
        if (reverbNode.current) reverbNode.current.disconnect();
        if (reverbGain.current) reverbGain.current.disconnect();
        if (masterFilter.current) masterFilter.current.disconnect();
        if (masterDrive.current) masterDrive.current.disconnect();
        if (panner.current) panner.current.disconnect();
        if (lfoOsc.current) lfoOsc.current.disconnect();
        if (lfoGain.current) lfoGain.current.disconnect();
        if (chordGain.current) chordGain.current.disconnect();

        // Stop oscillators
        if (oscillator.current) oscillator.current.stop();
        if (lfoOsc.current) lfoOsc.current.stop();

        // Close context
        await audioCtx.current.close();
      } catch (e) {
        console.warn("Audio Context Close error:", e);
      }
    }

    // Nullify all references
    audioCtx.current = null;
    oscillator.current = null;
    gainNode.current = null;
    panner.current = null;
    delayNode.current = null;
    feedbackNode.current = null;
    reverbNode.current = null;
    reverbGain.current = null;
    lfoOsc.current = null;
    lfoGain.current = null;
    masterFilter.current = null;
    masterDrive.current = null;
    chordGain.current = null;

    // Small delay to ensure cleanup, then reinit
    setTimeout(() => {
      initAudio();
    }, 100);
  };

  const cymaticsPlay = (offset = 0) => {
    if (!cymaticsAudioBufferRef.current || !audioCtx.current) return;
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch(e) {}
    }
    const source = audioCtx.current.createBufferSource();
    source.buffer = cymaticsAudioBufferRef.current;
    source.loop = true;

    const analyser = audioCtx.current.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;

    // Route: Source -> Analyser -> Destination (AUDIBLE DRY)
    source.connect(analyser);
    analyser.connect(audioCtx.current.destination);

    source.start(0, offset % cymaticsAudioBufferRef.current.duration);
    audioSourceRef.current = source;
    cymaticsStartTimeRef.current = audioCtx.current.currentTime - offset;
    setCymaticsPlaying(true);
    cymaticsPlayingRef.current = true;
  };

  const cymaticsPause = () => {
    if (!audioSourceRef.current || !cymaticsPlayingRef.current) return;
    cymaticsOffsetRef.current = audioCtx.current.currentTime - cymaticsStartTimeRef.current;
    try { audioSourceRef.current.stop(); } catch(e) {}
    audioSourceRef.current = null;
    setCymaticsPlaying(false);
    cymaticsPlayingRef.current = false;
  };

  const cymaticsStop = () => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch(e) {}
      audioSourceRef.current = null;
    }
    cymaticsOffsetRef.current = 0;
    setCymaticsPlaying(false);
    cymaticsPlayingRef.current = false;
    setIsRunning(false);
  };

  const handleCymaticsSeek = (newTime) => {
    cymaticsOffsetRef.current = newTime;
    setCymaticsCurrentTime(newTime);
    if (cymaticsPlayingRef.current) {
      cymaticsPlay(newTime);
    }
  };

  const handleCymaticsShuffle = () => {
    // 1. Randomize Geometry Parameters
    const newN = Math.floor(2 + Math.random() * 14);
    const newM = Math.floor(2 + Math.random() * 14);
    setParams(prev => ({
      ...prev,
      cymaticsN: newN,
      cymaticsM: newM
    }));

    // 2. Randomize Particles
    if (cymaticsParticles.current && canvasSizeRef.current) {
      const { width, height } = canvasSizeRef.current;
      cymaticsParticles.current.forEach(p => {
        p.x = Math.random() * width;
        p.y = Math.random() * height;
        p.vx = 0;
        p.vy = 0;
        // Also shuffle bands for new color clusters
        p.band = Math.floor(Math.random() * 7);
      });
    }
  };

  const handleCymaticsExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Create a temporary link
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `amuse-cymatics-art-${timestamp}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!audioCtx.current) initAudio();
    if (audioCtx.current.state === 'suspended') audioCtx.current.resume();

    // Stop previous source
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch(e) {}
      audioSourceRef.current = null;
    }

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioCtx.current.decodeAudioData(arrayBuffer);
    cymaticsAudioBufferRef.current = audioBuffer;
    cymaticsOffsetRef.current = 0;
    setCymaticsTrackName(file.name.replace(/\.[^.]+$/, ''));
    setCymaticsDuration(audioBuffer.duration);

    // Pre-compute waveform peaks (200 bars) for the seek visualizer
    const channelData = audioBuffer.getChannelData(0);
    const numPeaks = 200;
    const blockSize = Math.floor(channelData.length / numPeaks);
    const peaks = [];
    for (let i = 0; i < numPeaks; i++) {
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        const val = Math.abs(channelData[i * blockSize + j]);
        if (val > max) max = val;
      }
      peaks.push(max);
    }
    waveformPeaksRef.current = peaks;

    // Auto-switch & play
    updateParam('mode', MODES.CYMATICS);
    setIsRunning(true);
    cymaticsPlay(0);
  };

  // Update synth params live
  useEffect(() => {
    if (audioCtx.current) {
      if (oscillator.current) oscillator.current.type = params.synthWaveform;
      if (delayNode.current) delayNode.current.delayTime.setTargetAtTime(params.synthDelay, audioCtx.current.currentTime, 0.1);
      if (feedbackNode.current) feedbackNode.current.gain.setTargetAtTime(params.synthFeedback, audioCtx.current.currentTime, 0.1);
      if (reverbGain.current) reverbGain.current.gain.setTargetAtTime(params.synthReverb, audioCtx.current.currentTime, 0.1);
      if (lfoOsc.current) lfoOsc.current.frequency.setTargetAtTime(params.synthLFOFreq, audioCtx.current.currentTime, 0.1);
      if (lfoGain.current) lfoGain.current.gain.setTargetAtTime(params.synthLFOAmount, audioCtx.current.currentTime, 0.1);

      // LIVE MELODY VOLUME SYNC
      if (gainNode.current) {
        const targetVol = params.mode === MODES.CYMATICS ? 0 : params.synthMelodyVol;
        gainNode.current.gain.setTargetAtTime(targetVol, audioCtx.current.currentTime, 0.1);
      }

      // LIVE CHORD VOLUME SYNC
      if (chordGain.current) {
        const targetVol = params.mode === MODES.CYMATICS ? 0 : params.synthChordVol;
        chordGain.current.gain.setTargetAtTime(targetVol, audioCtx.current.currentTime, 0.1);
      }

      // LIVE EQ & DRIVE SYNC
      if (masterFilter.current) {
        masterFilter.current.frequency.setTargetAtTime(params.synthCutoff, audioCtx.current.currentTime, 0.05);
        masterFilter.current.Q.setTargetAtTime(params.synthResonance, audioCtx.current.currentTime, 0.05);
      }
      if (masterDrive.current) {
        const k = params.synthDrive;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
          const x = (i * 2) / n_samples - 1;
          curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
        }
        masterDrive.current.curve = curve;
      }
    }
  }, [params.synthWaveform, params.synthDelay, params.synthFeedback, params.synthReverb, params.synthLFOFreq, params.synthLFOAmount, params.synthCutoff, params.synthResonance, params.synthDrive, params.synthMelodyVol, params.synthChordVol]);

  // Internal animation state (rotation counters)
  const state = useRef({
    crot: 0,
    lrot: 0,
    rrot: 0,
    lx: null,
    ly: null,
    totalLength: 0,
    startPoint: null, // NEW: For geometric auto-stop
    startFrame: 0,
    debugArms: null
  });

  const svgLines = useRef([]);

  // Refs for stable loop access
  const paramsRef = useRef(params);
  const mousePosRef = useRef(mousePos);
  const canvasSizeRef = useRef(canvasSize);

  useEffect(() => { paramsRef.current = params; }, [params]);
  useEffect(() => { mousePosRef.current = mousePos; }, [mousePos]);
  useEffect(() => { canvasSizeRef.current = canvasSize; }, [canvasSize]);

  // Share Link Parsing
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const encodedParams = searchParams.get('p');
    if (encodedParams) {
      try {
        const decompressed = LZString.decompressFromEncodedURIComponent(encodedParams);
        if (decompressed) {
          const sharedParams = JSON.parse(decompressed);
          // Hydrate: Merge defaults with shared differences
          const hydrated = { ...INITIAL_PARAMS, ...sharedParams };
          setParams(hydrated);
          setViewMode(true);
          // Start the run with full hydrated state
          setTimeout(() => startNewRun(hydrated), 500);
        }
      } catch (e) {
        console.error("Failed to parse shared link", e);
      }
    }
  }, []);

  // Hash parsing logic (Legacy)
  useEffect(() => {
    const parseHash = () => {
      const h = window.location.hash;
      if (!h) return;
      const t = h.substring(1).split(',');
      if (t.length < 18) return;

      let i = 0;
      const g = () => Number(t[i++]);

      // livedisplay was unused
      g();
      const acceleration = g();
      const colormode = g();
      const cutpixels = g() === 1;
      const brightness = g();

      const crota = g();
      const hbx = g();
      const hby = g();
      const hdist = g();
      const lrota = g();
      const larm1 = g();
      const larm2 = g();
      const rrota = g();
      const rarm1 = g();
      const rarm2 = g();
      const rext = g();
      const larma = g(); // handlrot in original

      setParams(prev => ({
        ...prev,
        acceleration,
        penStyle: colormode,
        cutpixels,
        brightnessMode: brightness,
        rotorRPM: crota,
        baseoffsx: hbx,
        baseoffsy: hby,
        handdist: hdist,
        lrpm: lrota,
        larm1,
        larm2,
        rrpm: rrota,
        rarm1,
        rarm2,
        rarmext: rext,
        larma
      }));
    };

    parseHash();
    window.addEventListener('hashchange', parseHash);
    return () => window.removeEventListener('hashchange', parseHash);
  }, []);


  const draw = () => {
    if (!isRunningRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Safety: increment frame counter and check limits
    frameCount.current++;
    if (frameCount.current > MAX_FRAMES_PER_SESSION) {
      console.warn('Max frames reached, stopping animation');
      setIsRunning(false);
      return;
    }

    // Memory protection: trim old SVG lines if too many
    if (svgLines.current.length > MAX_SVG_LINES) {
      svgLines.current = svgLines.current.slice(-MAX_SVG_LINES / 2);
    }

    const ctx = canvas.getContext('2d');

    const curParams = paramsRef.current;
    const curMouse = mousePosRef.current;
    const curSize = canvasSizeRef.current;

    const centerX = curSize.width / 2;
    const centerY = curSize.height / 2;
    const AM = Math.PI / 180;

    const steps = Math.min(curParams.acceleration || 1, 500); // Cap acceleration for safety

    if (curParams.mode === MODES.CYMATICS) {
      // --- CYMATICS RENDERING (Chladni Particles) ---
      const partCount = curParams.cymaticsParticleCount || 10000;
      if (cymaticsParticles.current.length !== partCount) {
        const rad = Math.min(curSize.width, curSize.height) / 2;
        cymaticsParticles.current = Array.from({ length: partCount }, (_, i) => {
          let px, py;
          if (curParams.cymaticsCircular) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * rad;
            px = centerX + Math.cos(a) * r;
            py = centerY + Math.sin(a) * r;
          } else {
            px = Math.random() * curSize.width;
            py = Math.random() * curSize.height;
          }
          return {
            x: px,
            y: py,
            vx: 0,
            vy: 0,
            band: i % 7
          };
        });
      }

      let bandParams = []; // Parameters for each of the 7 bands
      const sensitivity = curParams.cymaticsSensitivity || 1.5;
      const friction = curParams.cymaticsFriction || 0.95;
      const baseSpeed = curParams.cymaticsSpeed || 0.5;

      if (analyserRef.current && isRunningRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Split spectrum into 7 logical bands: Bass -> Mids -> Highs
        const ranges = [
          { s: 1, e: 4, color: '#8b0000', weight: 1.2 },  // Deep Maroon (Sub)
          { s: 4, e: 10, color: '#ff0000', weight: 1.1 }, // Red (Bass)
          { s: 10, e: 25, color: '#ff8c00', weight: 1.0 }, // Orange (Rhythm)
          { s: 25, e: 50, color: '#00ff00', weight: 0.9 }, // Green (Vocals/Lead)
          { s: 50, e: 100, color: '#00ffff', weight: 0.8 }, // Cyan (Pad/Atmosphere)
          { s: 100, e: 180, color: '#0000ff', weight: 0.7 }, // Blue (High keys)
          { s: 180, e: 250, color: '#8b00ff', weight: 0.6 } // Violet (Air/Cymbals)
        ];

        bandParams = ranges.map((r, idx) => {
          let maxVal = 0;
          let maxIdx = 0;
          for (let i = r.s; i < r.e; i++) {
            if (dataArray[i] > maxVal) {
              maxVal = dataArray[i];
              maxIdx = i;
            }
          }
          
          const rawAmp = maxVal / 255;
          // Smoothing (Envelope Follower)
          const prevEnv = cymaticsEnvelopesRef.current[idx];
          const attack = 0.4;
          const release = 0.15;
          const env = rawAmp > prevEnv 
            ? prevEnv + (rawAmp - prevEnv) * attack 
            : prevEnv - (prevEnv - rawAmp) * release;
          
          cymaticsEnvelopesRef.current[idx] = env;
          
          // RHYTHTM/ONSET DETECTION LOGIC
          const transient = Math.max(0, rawAmp - prevEnv);
          const amp = env * r.weight * sensitivity;
          
          // Adaptive Onset Thresholding (Captures Rhythm, ignores static volume)
          const currentThreshold = cymaticsBeatThresholdsRef.current[idx];
          const isBeat = transient > currentThreshold && transient > 0.05;
          
          if (isBeat) {
            // Found a rhythmic hit! Fire ripple and raise threshold
            cymaticsBeatThresholdsRef.current[idx] = transient; 
            
            if (curParams.cymaticsRippleMode) {
              const rippleCount = 1 + Math.floor(transient * 5); // More waves for harder hits
              for(let i=0; i < rippleCount; i++) {
                cymaticsRipplesRef.current.push({
                   radius: 0,
                   speed: (4 + transient * 30) * (1 - i * 0.2),
                   alpha: 0.9 * transient * 4,
                   color: r.color,
                   thickness: 2 + transient * 10
                });
              }
            }
          } else {
            // Decay threshold to look for the next beat
            cymaticsBeatThresholdsRef.current[idx] *= 0.92;
            if (cymaticsBeatThresholdsRef.current[idx] < 0.08) {
               cymaticsBeatThresholdsRef.current[idx] = 0.08;
            }
          }

          return {
            n: (1 + (maxIdx % (5 + idx * 2))) + (env * 2), // Pattern morphs with volume
            m: (1 + (Math.floor(maxIdx / 4) % (4 + idx * 2))) + (env * 2),
            amp: amp,
            transient: transient, // For kick/beat response
            env: env,
            color: r.color
          };
        });
      }

      if (curParams.cymaticsOilMode ? 0 : (curParams.cymaticsGhostMode ? 0.04 : 0.15)) {
        const clearAlpha = curParams.cymaticsOilMode ? 0 : (curParams.cymaticsGhostMode ? 0.04 : 0.15);
        ctx.fillStyle = curParams.theme === 'noir' ? `rgba(0,0,0,${clearAlpha})` : `rgba(5,5,8,${clearAlpha})`;
        ctx.fillRect(0, 0, curSize.width, curSize.height);
      }

      // --- CIRCULAR CLIP ---
      if (curParams.cymaticsCircular) {
        ctx.save();
        ctx.beginPath();
        const r = Math.min(curSize.width, curSize.height) * 0.48;
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.clip();
      }

      // --- SPIN LOGIC ---
      if (curParams.cymaticsSpin !== 0) {
        cymaticsRotationRef.current += curParams.cymaticsSpin * 0.01;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(cymaticsRotationRef.current);
        ctx.translate(-centerX, -centerY);
      }

      const getChladniValForBand = (nx, ny, bandIdx) => {
        const h = bandParams[bandIdx] || { n: curParams.cymaticsN, m: curParams.cymaticsM, amp: 1.0 };
        return h.amp * (Math.cos(h.n * Math.PI * nx) * Math.cos(h.m * Math.PI * ny) - 
                        Math.cos(h.m * Math.PI * nx) * Math.cos(h.n * Math.PI * ny));
      };

      const getChladniValSum = (nx, ny) => {
        let t = 0;
        if (bandParams.length > 0) {
          bandParams.forEach((_, idx) => t += getChladniValForBand(nx, ny, idx));
        } else {
          t = Math.cos(curParams.cymaticsN * Math.PI * nx) * Math.cos(curParams.cymaticsM * Math.PI * ny) - 
              Math.cos(curParams.cymaticsM * Math.PI * nx) * Math.cos(curParams.cymaticsN * Math.PI * ny);
        }
        return t;
      };

      const getParticleColor = (p, overrideVal) => {
        const h = bandParams[p.band] || { env: 1.0 };
        const baseVal = overrideVal !== undefined ? overrideVal : (0.4 + h.env * 0.6);
        
        if (curParams.cymaticsRainbowMode && bandParams[p.band]) {
          return `${bandParams[p.band].color}${Math.floor(Math.min(1.0, baseVal) * 255).toString(16).padStart(2, '0')}`;
        }

        const nx = p.x / curSize.width;
        const ny = p.y / curSize.height;

        switch (curParams.penStyle) {
          case PEN_STYLES.RAINBOW: return `hsla(${(nx + ny) * 360 + frameCount.current}, 70%, 60%, ${baseVal})`;
          case PEN_STYLES.BLUE: return `rgba(0, ${150 + nx * 105}, 255, ${0.4 + baseVal * 0.6})`;
          case PEN_STYLES.GOLDEN: return `rgba(255, ${150 + ny * 105}, 0, ${0.4 + baseVal * 0.6})`;
          case PEN_STYLES.BW: return `rgba(255, 255, 255, ${0.1 + baseVal * 0.9})`;
          case PEN_STYLES.HOLOGRAPHIC: return `hsla(${(nx - ny) * 360}, 100%, 75%, ${0.5 * baseVal})`;
          default: return `rgba(255, 255, 255, ${baseVal})`;
        }
      };

      ctx.shadowBlur = 0;

      // --- DRAW RIPPLES (BEAT WAVES) ---
      if (curParams.cymaticsRippleMode && cymaticsRipplesRef.current.length > 0) {
        ctx.save();
        if (cymaticsRipplesRef.current.length > 40) {
          cymaticsRipplesRef.current = cymaticsRipplesRef.current.slice(-40);
        }
        cymaticsRipplesRef.current = cymaticsRipplesRef.current.filter(r => r.alpha > 0.01);
        cymaticsRipplesRef.current.forEach(r => {
          r.radius += r.speed;
          r.alpha *= 0.94;
          ctx.beginPath();
          ctx.strokeStyle = r.color;
          ctx.globalAlpha = Math.min(1, r.alpha);
          ctx.lineWidth = r.thickness * r.alpha;
          ctx.arc(centerX, centerY, r.radius, 0, Math.PI * 2);
          ctx.stroke();
        });
        ctx.restore();
      }

      if (curParams.cymaticsFieldMode) {
        // --- FIELD MODE: Geometric Grid ---
        const spacing = 18;
        const rows = Math.ceil(curSize.height / spacing);
        const cols = Math.ceil(curSize.width / spacing);
        const rLimitSq = (Math.min(curSize.width, curSize.height) * 0.48) ** 2;
        
        for (let r = 0; r <= rows; r++) {
          for (let c = 0; c <= cols; c++) {
            const x = c * spacing, y = r * spacing;
            if (curParams.cymaticsCircular) {
              const dx = x - centerX, dy = y - centerY;
              if (dx*dx + dy*dy > rLimitSq) continue;
            }
            const nx = (x / curSize.width) - 0.5, ny = (y / curSize.height) - 0.5;
            const val = getChladniValSum(nx, ny);
            const intensity = Math.abs(val);
            if (intensity > 0.05) {
              ctx.fillStyle = getParticleColor({ band: 0 }, Math.min(1.0, intensity * 2));
              ctx.beginPath(); ctx.arc(x, y, intensity * 4, 0, 6.28); ctx.fill();
            }
          }
        }
      } else {
        // --- PARTICLE MODE: Optimized Sand Simulation ---
        const rLimit = Math.min(curSize.width, curSize.height) * 0.48;
        const rLimitSq = rLimit * rLimit;
        const zoomV = curParams.cymaticsZoom * 0.01;
        const friction = curParams.cymaticsOilMode ? 0.98 : (curParams.cymaticsFriction || 0.95);
        const baseSpeed = curParams.cymaticsSpeed || 0.5;

        for (let b = 0; b < 7; b++) {
          const h = bandParams[b] || { env: 0, transient: 0 };
          const curSpeed = curParams.cymaticsOilMode ? (0.1 + h.transient * 2.0) : (baseSpeed + h.transient * 15.0);
          const curJitter = curParams.cymaticsOilMode ? 0.1 : (0.3 + h.transient * 5.0);
          const pS = curParams.cymaticsOilMode ? (3 + h.env * 6) : (1.5 + h.env * 1.5);
          
          const isSpectral = curParams.cymaticsRainbowMode && bandParams[b];
          if (isSpectral) {
            ctx.fillStyle = getParticleColor({ band: b }, undefined);
          }
          if (curParams.cymaticsOilMode) ctx.globalAlpha = 0.3;

          const pGroup = cymaticsParticles.current.filter(p => b === p.band);
          pGroup.forEach(p => {
            const nx = (p.x / curSize.width) - 0.5, ny = (p.y / curSize.height) - 0.5;
            const val = curParams.cymaticsRainbowMode ? getChladniValForBand(nx, ny, b) : getChladniValSum(nx, ny);
            const eps = 0.01;
            const vDX = (curParams.cymaticsRainbowMode ? getChladniValForBand(nx+eps, ny, b) : getChladniValSum(nx+eps, ny)) - val;
            const vDY = (curParams.cymaticsRainbowMode ? getChladniValForBand(nx, ny+eps, b) : getChladniValSum(nx, ny+eps)) - val;
            
            p.vx = p.vx * friction + (vDX > 0 ? -1 : 1) * Math.abs(val) * curSpeed + (Math.random() - 0.5) * curJitter;
            p.vy = p.vy * friction + (vDY > 0 ? -1 : 1) * Math.abs(val) * curSpeed + (Math.random() - 0.5) * curJitter;
            p.x += p.vx; p.y += p.vy;

            if (zoomV !== 0) {
              const dx = p.x - centerX, dy = p.y - centerY;
              p.x += dx * zoomV; p.y += dy * zoomV;
              const dSq = dx*dx + dy*dy;
              if (zoomV > 0 && dSq > rLimitSq * 2.5) {
                p.x = centerX + (Math.random()-0.5)*40; p.y = centerY + (Math.random()-0.5)*40;
                p.vx = 0; p.vy = 0;
              } else if (zoomV < 0 && dSq < 100) {
                const a = Math.random()*6.28;
                p.x = centerX + Math.cos(a)*rLimit; p.y = centerY + Math.sin(a)*rLimit;
                p.vx = 0; p.vy = 0;
              }
            }

            if (curParams.cymaticsCircular) {
               const dx = p.x - centerX, dy = p.y - centerY;
               const dSq = dx*dx + dy*dy;
               if (dSq > rLimitSq) {
                  const dist = Math.sqrt(dSq);
                  const ux = dx / dist; 
                  const uy = dy / dist;
                  p.x = centerX + ux * rLimit * 0.99;
                  p.y = centerY + uy * rLimit * 0.99;
                  p.vx *= -0.3; p.vy *= -0.3;
               }
            } else {
              if (p.x < 0) p.x = curSize.width; else if (p.x > curSize.width) p.x = 0;
              if (p.y < 0) p.y = curSize.height; else if (p.y > curSize.height) p.y = 0;
            }
            
            if (!isSpectral) {
              ctx.fillStyle = getParticleColor(p);
            }

            if (curParams.cymaticsOilMode) {
               ctx.beginPath(); ctx.arc(p.x, p.y, pS, 0, 6.28); ctx.fill();
            } else {
               ctx.fillRect(p.x, p.y, pS, pS);
            }
          });
          ctx.globalAlpha = 1.0;
        }
      }

      if (curParams.cymaticsSpin !== 0 || curParams.cymaticsCircular) {
        ctx.restore();
      }
      
      // Draw STATIC waveform peaks over the full track + playhead
      if (waveformCanvasRef.current && waveformPeaksRef.current.length > 0) {
        const wfCanvas = waveformCanvasRef.current;
        const wfCtx = wfCanvas.getContext('2d');
        const W = wfCanvas.width;
        const H = wfCanvas.height;
        const peaks = waveformPeaksRef.current;
        const progress = cymaticsDuration > 0
          ? (audioCtx.current ? Math.max(0, (audioCtx.current.currentTime - cymaticsStartTimeRef.current)) % cymaticsDuration / cymaticsDuration : 0)
          : 0;

        wfCtx.clearRect(0, 0, W, H);
        wfCtx.fillStyle = 'rgba(0,0,0,0.5)';
        wfCtx.fillRect(0, 0, W, H);

        const barW = W / peaks.length;
        const playheadX = progress * W;

        for (let i = 0; i < peaks.length; i++) {
          const x = i * barW;
          const barH = peaks[i] * H * 0.9;
          const barY = (H - barH) / 2;
          // Played portion: bright cyan; unplayed: dim
          if (x < playheadX) {
            wfCtx.fillStyle = `rgba(0,240,255,0.85)`;
          } else {
            wfCtx.fillStyle = `rgba(255,255,255,0.18)`;
          }
          wfCtx.fillRect(x + 0.5, barY, Math.max(1, barW - 1), barH);
        }

        // Playhead line
        wfCtx.strokeStyle = '#ff00ff';
        wfCtx.lineWidth = 2;
        wfCtx.shadowColor = '#ff00ff';
        wfCtx.shadowBlur = 6;
        wfCtx.beginPath();
        wfCtx.moveTo(playheadX, 0);
        wfCtx.lineTo(playheadX, H);
        wfCtx.stroke();
        wfCtx.shadowBlur = 0;
      }

      if (isRunningRef.current) {
        requestRef.current = requestAnimationFrame(draw);
      }
      return;
    }

    for (let i = 0; i < steps; i++) {
      let effectiveParams = { ...curParams };
      if (curParams.autoEvolve) {
        evolutionOffset.current += 0.0001;
        const ev = evolutionOffset.current;
        effectiveParams.larm2 += Math.sin(ev * 3) * 50;
        effectiveParams.rarm2 += Math.cos(ev * 2) * 50;
        effectiveParams.handdist += Math.sin(ev * 1.5) * 30;
      }

      const handsX = centerX + effectiveParams.baseoffsx;
      const handsY = centerY + effectiveParams.baseoffsy;

      const h1x = handsX - effectiveParams.handdist / 2;
      const h1y = handsY;
      const h2x = handsX + effectiveParams.handdist / 2;
      const h2y = handsY;

      const h1arm1x = Math.cos((state.current.lrot + effectiveParams.larma) * AM) * effectiveParams.larm1 + h1x;
      const h1arm1y = Math.sin((state.current.lrot + effectiveParams.larma) * AM) * effectiveParams.larm1 + h1y;

      const h2arm1x = Math.cos(state.current.rrot * AM) * effectiveParams.rarm1 + h2x;
      const h2arm1y = Math.sin(state.current.rrot * AM) * effectiveParams.rarm1 + h2y;

      const dx = h2arm1x - h1arm1x;
      const dy = h2arm1y - h1arm1y;
      const D = Math.max(0.1, Math.sqrt(dx * dx + dy * dy));

      const r2 = Math.max(1, effectiveParams.rarm2);
      const l2 = Math.max(1, effectiveParams.larm2);

      // Law of cosines for arm intersection
      const gammaDenom = 2 * r2 * l2;
      const gammaArg = (r2 * r2 + l2 * l2 - D * D) / gammaDenom;
      const gamma = Math.acos(Math.max(-1, Math.min(1, gammaArg)));

      const alphaArg = r2 / (D / Math.sin(gamma || 0.001));
      const alpha = Math.asin(Math.max(-1, Math.min(1, alphaArg)));

      const betaArg = l2 / (D / Math.sin(gamma || 0.001));
      const beta = Math.asin(Math.max(-1, Math.min(1, betaArg)));

      const delta = Math.asin(Math.max(-1, Math.min(1, dy / D)));

      let h2a;
      if (l2 > r2) {
        h2a = Math.PI - ((Math.PI - alpha - gamma) - delta);
      } else {
        h2a = Math.PI - (beta - delta);
      }

      const ext_x = h2arm1x + Math.cos(h2a) * (r2 + effectiveParams.rarmext);
      const ext_y = h2arm1y + Math.sin(h2a) * (r2 + effectiveParams.rarmext);

      const nx = ext_x - centerX;
      const ny = ext_y - centerY;
      const nd = Math.sqrt(nx * nx + ny * ny);
      let na = nd === 0 ? 0 : Math.asin(ny / nd);
      if (nx < 0) na = Math.PI - na;

      na += state.current.crot * AM;

      let fx = centerX + Math.cos(na) * nd;
      let fy = centerY + Math.sin(na) * nd;

      if (curParams.mouseInteraction) {
        const mdx = curMouse.x - fx;
        const mdy = curMouse.y - fy;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 300) {
          const force = (1 - mdist / 300) * 0.5;
          fx += mdx * force;
          fy += mdy * force;
        }
      }

      if (i === steps - 1 && curParams.showArms) {
        state.current.debugArms = { h1x, h1y, h2x, h2y, h1arm1x, h1arm1y, h2arm1x, h2arm1y, ext_x, ext_y, fx, fy, na, nd };
      }

      let d_raw = 0;
      if (state.current.lx !== null) {
        const ddx = fx - state.current.lx;
        const ddy = fy - state.current.ly;
        d_raw = 2 * Math.sqrt(ddx * ddx + ddy * ddy);
      }

      let lw = 1;
      const b_val = curParams.brightnessMode < 4 ? curParams.brightnessMode : 1;
      const dd_val = Math.sqrt(d_raw / b_val) * 1.8;

      let R, G, B_val, A;
      A = 1; // Default
      switch (curParams.penStyle) {
        case PEN_STYLES.RAINBOW: {
          const c1 = Math.sin(AM * state.current.lrot + Math.PI * 0.666) * 127 + 127;
          const c2 = Math.sin(AM * state.current.lrot + Math.PI * 0.333) * 127 + 127;
          const c3 = Math.sin(AM * state.current.lrot) * 127 + 127;
          const c4 = Math.sin(AM * state.current.rrot + Math.PI * 0.666) * 127 + 127;
          const c5 = Math.sin(AM * state.current.rrot + Math.PI * 0.333) * 127 + 127;
          const c6 = Math.sin(AM * state.current.rrot) * 127 + 127;
          R = Math.floor((c1 + c4) / 2); G = Math.floor((c2 + c5) / 2); B_val = Math.floor((c3 + c6) / 2);
          A = 1; break;
        }
        case PEN_STYLES.BW: {
          R = G = B_val = 255;
          A = 0.3 + Math.abs(Math.sin(AM * state.current.lrot * 2)) * 0.7; break;
        }
        case PEN_STYLES.KALEIDOSCOPE: {
          // Maps symmetry and rotation to a shifting spectrum
          const kh = (Math.abs(state.current.lrot + state.current.rrot) % 360) / 360;
          const kr = Math.sin(kh * Math.PI * 2) * 127 + 127;
          const kg = Math.sin((kh + 0.33) * Math.PI * 2) * 127 + 127;
          const kb = Math.sin((kh + 0.66) * Math.PI * 2) * 127 + 127;
          R = Math.floor(kr); G = Math.floor(kg); B_val = Math.floor(kb);
          A = 0.8; break;
        }
        case PEN_STYLES.BLUE: {
          // Deep space blues
          const b1 = Math.sin(AM * state.current.lrot) * 50 + 50; // 0-100 (subtle red)
          R = Math.floor(b1 * 0.2);
          G = Math.floor(Math.sin(AM * state.current.rrot) * 100 + 155); // 55-255 (cyan/green)
          B_val = 255;
          A = 0.7; break;
        }
        case PEN_STYLES.GOLDEN: {
          // Golden gradient: Yellow (255,215,0) to Orange (255,165,0)
          const gold_mix = Math.sin(AM * (state.current.lrot + state.current.rrot)) * 0.5 + 0.5;
          R = 255;
          G = Math.floor(180 + gold_mix * 75); // 180 (Orange-ish) to 255 (Yellow)
          B_val = Math.floor(gold_mix * 50); // 0 to 50
          A = 0.8; break;
        }
        case PEN_STYLES.FRAGMENTED: {
          // Glitch / Rainbow Fragmented
          const f1 = Math.sin(AM * state.current.lrot + Math.PI * 0.666) * 127 + 127;
          const f2 = Math.sin(AM * state.current.lrot + Math.PI * 0.333) * 127 + 127;
          const f3 = Math.sin(AM * state.current.lrot) * 127 + 127;
          R = Math.floor(f1); G = Math.floor(f2); B_val = Math.floor(f3);
          A = 1; break;
        }
        case PEN_STYLES.HOLOGRAPHIC: {
          // Holographic 3D Omni: Shifting cyan, magenta, and white with depth feel
          const holo_shift = (state.current.lrot + state.current.rrot) * 0.5;
          const h_r = Math.sin(AM * holo_shift) * 100 + 155;
          const h_g = Math.sin(AM * holo_shift + Math.PI * 0.5) * 100 + 155;
          const h_b = Math.sin(AM * holo_shift + Math.PI) * 100 + 200;
          R = Math.floor(h_r);
          G = Math.floor(h_g);
          B_val = Math.floor(Math.min(255, h_b));
          // Use alpha to simulate "depth" based on line distance
          A = 0.4 + Math.abs(Math.sin(AM * state.current.lrot)) * 0.6;
          break;
        }
        case PEN_STYLES.SILK: {
          // Fine Silk Holographic: Ultra-thin holographic lines for silk ribbon effect
          const silk_shift = (state.current.lrot + state.current.rrot) * 0.5;
          const s_r = Math.sin(AM * silk_shift) * 100 + 155;
          const s_g = Math.sin(AM * silk_shift + Math.PI * 0.5) * 100 + 155;
          const s_b = Math.sin(AM * silk_shift + Math.PI) * 100 + 200;
          R = Math.floor(s_r);
          G = Math.floor(s_g);
          B_val = Math.floor(Math.min(255, s_b));
          A = 0.25; // Increased base opacity (was 0.12)
          lw = 0.4; // Base width for Silk
          break;
        }
        case PEN_STYLES.SILK_INVERSE: {
          // Ethereal Silk: Inverted holographic palette (Warm/Gold/Fire)
          const inv_shift = (state.current.lrot + state.current.rrot) * 0.5;
          // Phase shifted colors for inversion (180 degrees)
          const i_r = 255 - (Math.sin(AM * inv_shift) * 100 + 155);
          const i_g = 255 - (Math.sin(AM * inv_shift + Math.PI * 0.5) * 100 + 155);
          const i_b = 255 - (Math.sin(AM * inv_shift + Math.PI) * 100 + 200);

          // Boost brightness for the inverse to make it feel "fire/gold"
          R = Math.floor(i_r + 200);
          G = Math.floor(i_g + 100);
          B_val = Math.floor(i_b + 50);

          R = Math.min(255, R);
          G = Math.min(255, G);
          B_val = Math.min(255, B_val);

          A = 0.25;
          lw = 0.4;
          break;
        }
        default: { R = 255; G = 255; B_val = 255; A = 1; }
      }

      // Final line width calculation with multiplier
      if (curParams.penStyle === PEN_STYLES.RAINBOW) {
        let temp_lw = Math.max(1, Math.min(5, 15 / (dd_val || 1)));
        lw = temp_lw / 2;
      }
      lw *= curParams.lineWidth;

      // --- FRAGMENTATION / AUDIO GATING ---
      let isVisible = true;
      if (curParams.penStyle === PEN_STYLES.FRAGMENTED) {
        // Create high-frequency "breaks" based on rotation
        const noise = Math.sin(state.current.lrot * 10) * Math.sin(state.current.rrot * 10);
        isVisible = noise > -0.2; // ~60% visibility

        // SYNC AUDIO GATE: Silence the audio during fragments
        if (gainNode.current && audioCtx.current) {
          gainNode.current.gain.setTargetAtTime(isVisible ? 0.3 : 0, audioCtx.current.currentTime, 0.01);
        }
      } else {
        // In other modes, ensure audio is ungated if active
        if (gainNode.current && audioCtx.current && curParams.soundEnabled) {
          // Normalize to default gain if not gated
          // (Note: gainNode.current.gain is also modulated by LFO)
        }
      }
      if (curParams.brightnessMode > 3) A /= (5 * (curParams.brightnessMode - 2));
      A = Math.max(0, Math.min(1, A));

      // Sonic Synesthesia: Map Color to Piano Note + Distance to Octave
      if (curParams.soundEnabled && audioCtx.current) {
        // Resume audio context if suspended
        if (audioCtx.current.state === 'suspended') {
          audioCtx.current.resume();
        }

        // RGB to Hue calculation
        const r = R / 255, g = G / 255, b = B_val / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0;
        if (max !== min) {
          const d = max - min;
          switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
          }
          h /= 6;
        }

        // --- INTELLIGENT HARMONIC SYSTEM ---
        // Using stable currentKey from state (set during randomization)

        // 2. MAP HUE TO CHROMATIC NOTE
        const chromaticNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const noteFrequencies = {
          'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13,
          'E': 329.63, 'F': 349.23, 'F#': 369.99, 'G': 392.00,
          'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
        };

        // Hue to chromatic note
        const rawNoteIndex = Math.floor(h * 12) % 12;

        // 3. QUANTIZE TO KEY (Harmonic Correction)
        const quantizeToKey = (noteIdx, key) => {
          // Get root note index
          const rootIdx = chromaticNotes.indexOf(key.name);

          // Calculate semitone distance from root
          const semitoneFromRoot = (noteIdx - rootIdx + 12) % 12;

          // Find closest note in scale
          const closestScaleNote = key.scale.reduce((prev, curr) => {
            return Math.abs(curr - semitoneFromRoot) < Math.abs(prev - semitoneFromRoot) ? curr : prev;
          });

          // Return quantized note index
          return (rootIdx + closestScaleNote) % 12;
        };

        const quantizedNoteIndex = quantizeToKey(rawNoteIndex, currentKey);
        const noteName = chromaticNotes[quantizedNoteIndex];

        // 4. DISTANCE TO OCTAVE & VOICE ASSIGNMENT
        const maxDist = 1200;
        const ndFactor = Math.max(0, Math.min(1, 1 - nd / maxDist));

        // Determine voice based on distance from center
        const isSoloVoice = ndFactor > 0.6; // Center = solo melody
        const isHarmonyVoice = ndFactor <= 0.6; // Edges = harmony

        // Map to octave range
        let octave = 3 + Math.floor(ndFactor * 2);

        // 5. ORCHESTRAL VOICING
        let finalNoteName = noteName;

        // --- MICRO-ARPEGGIATOR LOGIC ---
        let arpOffset = 0;
        if (curParams.synthArpSpeed > 0) {
          arpState.current.tick++;
          if (arpState.current.tick >= (21 - curParams.synthArpSpeed)) {
            arpState.current.tick = 0;
            // Arpeggio notes within the scale: Root, 3rd, 5th, 7th (0, 2, 4, 6 degrees)
            const arpDegrees = [0, 2, 4, 2, 4, 6, 4, 2];
            arpState.current.index = (arpState.current.index + 1) % arpDegrees.length;
          }

          const currentArpDegree = [0, 2, 4, 2, 4, 6, 4, 2][arpState.current.index];
          // Get semitone offset from current scale degree
          const scaleNote = currentKey.scale[currentArpDegree % currentKey.scale.length];
          // Simple octave jumps for range
          const octaveArp = Math.floor(currentArpDegree / currentKey.scale.length) * 12;
          arpOffset = scaleNote + octaveArp;

          const arpNoteIdx = (chromaticNotes.indexOf(currentKey.name) + arpOffset) % 12;
          finalNoteName = chromaticNotes[arpNoteIdx];
        }

        if (isHarmonyVoice) {
          // Harmony voices play chord tones (thirds/fifths)
          const harmonyOffset = Math.floor((fx / curSize.width) * 3); // 0, 1, 2
          const harmonyIntervals = [0, 4, 7]; // Root, third, fifth
          const harmonyInterval = harmonyIntervals[harmonyOffset];

          const harmonyNoteIndex = (quantizedNoteIndex + harmonyInterval) % 12;
          finalNoteName = chromaticNotes[harmonyNoteIndex];

          // Harmony is quieter and lower
          octave = Math.max(3, octave - 1);
        }

        // Calculate final frequency
        const baseFreq = noteFrequencies[finalNoteName];
        // Combine octave with manual transposition
        const transposeOffset = curParams.synthTranspose || 0;
        const freq = baseFreq * Math.pow(2, octave - 4 + (transposeOffset / 12));

        // --- SPECTRAL FADING ---
        // Favor middle octave (octave 4)
        const distanceToTarget = Math.abs(octave - 4);
        const spectralGain = Math.exp(-Math.pow(distanceToTarget, 2) / 2.5);

        // Check if oscillator is still running, restart if needed
        try {
          if (!oscillator.current || oscillator.current.context.state !== 'running') {
            console.log('Restarting audio...');
            initAudio();
          }

          // Use exponentialRamp for faster, more responsive pitch changes
          const now = audioCtx.current.currentTime;
          oscillator.current.frequency.cancelScheduledValues(now);
          oscillator.current.frequency.setValueAtTime(oscillator.current.frequency.value, now);
          oscillator.current.frequency.exponentialRampToValueAtTime(Math.max(20, freq), now + 0.01);

          const pan = (fx - centerX) / centerX;
          panner.current.pan.cancelScheduledValues(now);
          panner.current.pan.setValueAtTime(panner.current.pan.value, now);
          panner.current.pan.linearRampToValueAtTime(Math.max(-1, Math.min(1, pan)), now + 0.01);

          let volume = 0.03;
          if (state.current.lx !== null) {
            const speed = Math.sqrt(Math.pow(fx - state.current.lx, 2) + Math.pow(fy - state.current.ly, 2));
            volume = Math.min(0.25, speed / 50);
          }

          // Voice-based volume adjustment (orchestral balance)
          const voiceMultiplier = isSoloVoice ? 1.0 : 0.4; // Solo louder, harmony quieter

          // Combine speed volume, transparency (A), spectral fading, and voice role
          const finalVolume = volume * A * (0.2 + spectralGain * 0.8) * voiceMultiplier;
          gainNode.current.gain.cancelScheduledValues(now);
          gainNode.current.gain.setValueAtTime(gainNode.current.gain.value, now);
          gainNode.current.gain.linearRampToValueAtTime(Math.max(0, finalVolume), now + 0.01);

          // --- UPDATE UI NOTE & KEY ---
          if (i === steps - 1) {
            setCurrentNote({ name: finalNoteName, octave: octave, freq: Math.round(freq) });
            setCurrentKey(currentKey); // Update current tonality
          }
        } catch (err) {
          console.error('Audio error:', err);
          // Reinitialize on error
          initAudio();
        }
      }

      if (state.current.lx !== null && isVisible) {
        const sym = curParams.symmetry;
        const symAngle = (Math.PI * 2) / sym;
        for (let s = 0; s < sym; s++) {
          const currentAngle = s * symAngle;
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(currentAngle);
          ctx.strokeStyle = `rgba(${R},${G},${B_val},${A})`;
          ctx.lineWidth = lw;
          ctx.beginPath();
          ctx.moveTo(state.current.lx - centerX, state.current.ly - centerY);
          ctx.lineTo(fx - centerX, fy - centerY);
          ctx.stroke();
          if (curParams.particlesEnabled && Math.random() > 0.9) {
            particlesRef.current.push({ x: fx - centerX, y: fy - centerY, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, age: 0, maxAge: 50 + Math.random() * 50, color: `rgba(${R},${G},${B_val},0.5)`, angle: currentAngle });
          }
          ctx.restore();
          if (s === 0 && svgLines.current.length < 50000) {
            svgLines.current.push({ x1: state.current.lx, y1: state.current.ly, x2: fx, y2: fy, color: `rgba(${R},${G},${B_val},${A})`, alpha: A, lw: lw, sym: sym });
          }
        }
      }
      state.current.lx = fx; state.current.ly = fy;
      const rotStep = 0.01666666 * 6;
      state.current.crot += effectiveParams.rotorRPM * rotStep;
      state.current.lrot += effectiveParams.lrpm * rotStep;
      state.current.rrot += effectiveParams.rrpm * rotStep;

      // --- AUTO-STOP DETECTION ---
      // 1. Geometric Stop
      if (effectiveParams.autoStop) {
        if (state.current.startPoint === null) {
          // Record start point (raw coordinates)
          state.current.startPoint = { x: fx, y: fy };
          state.current.startFrame = frameCount.current;
        } else if (frameCount.current > state.current.startFrame + 300) { // Safety buffer
          // Calculate distance to start point
          const dx = fx - state.current.startPoint.x;
          const dy = fy - state.current.startPoint.y;
          const distSq = dx * dx + dy * dy;

          // Tolerance: 4 pixels radius (16 squared)
          if (distSq < 16) {
            console.log('Geometric cycle complete!');
            setIsRunning(false);
            state.current.startPoint = null;
          }
        }
      }

      // 2. Mathematical Cycle Stop (Old method - fallback or explicitly selected?)
      // Keeping it simple: We replace the old logic with this new robust geometric one requested by user.
      state.current.frameCount = (state.current.frameCount || 0) + 1;
    }

    // Auto-chord progression system
    if (curParams.soundEnabled && audioCtx.current) {
      const currentTime = Date.now() / 1000; // Convert to seconds

      if (currentTime - lastAutoChordTime.current >= autoChordInterval.current) {
        // Get harmonically related notes based on current key
        const getHarmonicChord = (key) => {
          // Use only diatonic scale degrees (I, II, III, IV, V, VI, VII)
          // Pick a random degree from the scale
          const randomDegreeIdx = Math.floor(Math.random() * key.scale.length);
          const scaleDegree = key.scale[randomDegreeIdx];

          const chromaticNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
          const rootIdx = chromaticNotes.indexOf(key.name);
          const chordNoteIdx = (rootIdx + scaleDegree) % 12;

          return chromaticNotes[chordNoteIdx];
        };

        // Play a harmonically appropriate chord in current key
        const chordNote = getHarmonicChord(currentKey);
        const chordOctave = Math.random() > 0.5 ? 3 : 4; // Random octave

        playNote(chordNote, chordOctave);

        // Update timing
        lastAutoChordTime.current = currentTime;
        autoChordInterval.current = 6 + Math.random() * 2; // New random interval (6-8s)
      }
    }

    // Particles draw
    if (particlesRef.current.length > 0) {
      particlesRef.current.forEach((p, i) => {
        p.age++; p.x += p.vx; p.y += p.vy; p.vy += 0.01;
        const alpha = 1 - (p.age / p.maxAge);
        if (alpha <= 0) { particlesRef.current.splice(i, 1); return; }
        ctx.save(); ctx.translate(centerX, centerY); ctx.rotate(p.angle);
        ctx.fillStyle = p.color.replace('0.5', (alpha * 0.5).toString());
        ctx.beginPath(); ctx.arc(p.x, p.y, 1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });
    }

    // --- UPDATE & DRAW GHOST MECHANISM & FINISH POINT ---
    if (debugCanvasRef.current) {
      const dctx = debugCanvasRef.current.getContext('2d');
      dctx.clearRect(0, 0, curSize.width, curSize.height);

      if (curParams.showArms && state.current.debugArms) {
        const a = state.current.debugArms;
        dctx.lineWidth = 1; dctx.setLineDash([5, 5]);
        dctx.strokeStyle = 'rgba(0, 240, 255, 0.4)'; dctx.beginPath(); dctx.arc(a.h1x, a.h1y, 4, 0, Math.PI * 2); dctx.arc(a.h2x, a.h2y, 4, 0, Math.PI * 2); dctx.stroke();
        dctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; dctx.beginPath(); dctx.moveTo(a.h1x, a.h1y); dctx.lineTo(a.h1arm1x, a.h1arm1y); dctx.moveTo(a.h2x, a.h2y); dctx.lineTo(a.h2arm1x, a.h2arm1y); dctx.stroke();
        dctx.strokeStyle = 'rgba(0, 240, 255, 0.3)'; dctx.beginPath(); dctx.moveTo(a.h1arm1x, a.h1arm1y); dctx.lineTo(a.ext_x, a.ext_y); dctx.moveTo(a.h2arm1x, a.h2arm1y); dctx.lineTo(a.ext_x, a.ext_y); dctx.stroke();
        dctx.strokeStyle = 'rgba(255, 0, 255, 0.2)'; dctx.beginPath(); dctx.moveTo(centerX, centerY); dctx.lineTo(a.fx, a.fy); dctx.stroke();
        dctx.setLineDash([]);
      }

      if (curParams.showFinishPoint && state.current.lx !== null) {
        const fx = state.current.lx;
        const fy = state.current.ly;

        dctx.save();
        dctx.translate(centerX, centerY);

        // Draw stylized Finish Point for each symmetry
        const sym = curParams.symmetry;
        const symAngle = (Math.PI * 2) / sym;

        for (let s = 0; s < sym; s++) {
          dctx.save();
          dctx.rotate(s * symAngle);

          const px = fx - centerX;
          const py = fy - centerY;

          dctx.strokeStyle = '#fff';
          dctx.lineWidth = 2;
          dctx.setLineDash([]);

          // Draw a crosshair/plus
          dctx.beginPath();
          dctx.moveTo(px - 10, py); dctx.lineTo(px + 10, py);
          dctx.moveTo(px, py - 10); dctx.lineTo(px, py + 10);
          dctx.stroke();

          // Outer circle
          dctx.beginPath();
          dctx.arc(px, py, 15, 0, Math.PI * 2);
          dctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          dctx.stroke();

          dctx.restore();
        }
        dctx.restore();
      }

      // --- MAGNIFYING LENS RENDERING ---
      if (curParams.lensEnabled) {
        const lensSize = 150;
        const mag = 2;
        const mx = curMouse.x;
        const my = curMouse.y;

        dctx.save();
        // Circular Clip
        dctx.beginPath();
        dctx.arc(mx, my, lensSize / 2, 0, Math.PI * 2);
        dctx.clip();

        // Draw main canvas into debug canvas at 2x
        dctx.drawImage(
          canvasRef.current,
          mx - (lensSize / mag) / 2, my - (lensSize / mag) / 2, // source rect
          lensSize / mag, lensSize / mag,
          mx - lensSize / 2, my - lensSize / 2, // dest rect
          lensSize, lensSize
        );

        // Lens Border
        dctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        dctx.lineWidth = 3;
        dctx.beginPath();
        dctx.arc(mx, my, lensSize / 2, 0, Math.PI * 2);
        dctx.stroke();

        // Subtle glass effect
        dctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        dctx.fill();

        dctx.restore();
      }
    }

    if (isRunningRef.current) {
      requestRef.current = requestAnimationFrame(draw);
    }
  };

  // Main loop control
  useEffect(() => {
    if (isRunning) {
      requestRef.current = requestAnimationFrame(draw);
    } else {
      cancelAnimationFrame(requestRef.current);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isRunning]);

  // Adaptive UI Observer (Layout only, no internal resize)
  useEffect(() => {
    if (!containerRef.current) return;

    const updateBaseScale = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      // Calculate scale to fit 2400x1800 into current container
      const s = Math.min(width / 2400, height / 1800) * 0.98; // 98% (almost full screen)
      setBaseScale(s);
    };

    updateBaseScale();
    window.addEventListener('resize', updateBaseScale);
    return () => window.removeEventListener('resize', updateBaseScale);
  }, []);

  // Canvas initialization / clearing (Triggered only by theme or explicit clear)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Internal resolution is now stable at 2400x1800 for high-fidelity export
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    if (debugCanvasRef.current) {
      debugCanvasRef.current.width = canvasSize.width;
      debugCanvasRef.current.height = canvasSize.height;
    }
    const ctx = canvas.getContext('2d');

    // Restore solid background
    ctx.fillStyle = params.theme === 'noir' ? '#000000' : '#050508';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Initial state reset for theme change
    state.current.lx = null;
    state.current.ly = null;
  }, [params.theme, canvasSize]); // Redo background on theme change or resize

  // Mouse move tracker with throttling for performance
  const handleMouseMove = (e) => {
    const now = performance.now();
    if (now - lastMouseMoveTime.current < MOUSE_THROTTLE_MS) return;
    lastMouseMoveTime.current = now;

    const rect = e.target.getBoundingClientRect();
    // Map mouse to 2400x1800 internal coordinates correctly regardless of CSS scale
    const x = (e.clientX - rect.left) * (2400 / rect.width);
    const y = (e.clientY - rect.top) * (1800 / rect.height);
    setMousePos({ x, y });
  };

  // Audio state management
  useEffect(() => {
    if (!params.soundEnabled || !isRunning) {
      if (gainNode.current && audioCtx.current) {
        gainNode.current.gain.setTargetAtTime(0, audioCtx.current.currentTime, 0.1);
      }
    }
  }, [params.soundEnabled, isRunning]);

  // Sync Note to UI State periodically to avoid over-rendering
  useEffect(() => {
    const timer = setInterval(() => {
      if (state.current.lastNote) setCurrentNote(state.current.lastNote);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = params.theme === 'noir' ? '#000000' : '#050508';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    state.current = { crot: 0, lrot: 0, rrot: 0, lx: null, ly: null, totalLength: 0, startPoint: null, startFrame: 0, debugArms: null };
    svgLines.current = [];
    frameCount.current = 0;
    setIsRunning(false);
  };

  // Full reset function - resets everything including audio and parameters
  const handleReset = () => {
    // Stop running
    setIsRunning(false);

    // Cancel any pending animation frames
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }

    // Reset audio
    if (audioCtx.current) {
      try {
        // Stop all oscillators
        if (oscillator.current) {
          oscillator.current.stop();
          oscillator.current = null;
        }
        if (lfoOsc.current) {
          lfoOsc.current.stop();
          lfoOsc.current = null;
        }
        // Close audio context
        audioCtx.current.close();
        audioCtx.current = null;
      } catch (e) {
        console.log('Audio cleanup error:', e);
      }
    }

    // Reset all refs
    gainNode.current = null;
    panner.current = null;
    delayNode.current = null;
    feedbackNode.current = null;
    reverbNode.current = null;
    reverbGain.current = null;
    lfoGain.current = null;
    masterFilter.current = null;
    masterDrive.current = null;
    chordGain.current = null;

    // Reset canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#050508';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Reset state
    state.current = { crot: 0, lrot: 0, rrot: 0, lx: null, ly: null, totalLength: 0, startPoint: null, startFrame: 0, debugArms: null };
    svgLines.current = [];
    frameCount.current = 0;
    evolutionOffset.current = 0;
    particlesRef.current = [];
    arpState.current = { index: 0, tick: 0 };

    // Reset parameters to defaults
    setParams({
      mode: MODES.ORIGINAL,
      acceleration: 73,
      rotorRPM: 4,
      baseoffsx: 0,
      baseoffsy: -385,
      handdist: 351,
      soundEnabled: false,
      lrpm: 2,
      larma: 0,
      larm1: 105,
      larm2: 316,
      rrpm: -3,
      rarm1: 95,
      rarm2: 371,
      rarmext: 53,
      penStyle: PEN_STYLES.RAINBOW,
      brightnessMode: BRIGHTNESS_MODES.X1,
      lineWidth: 1.0,
      glow: false,
      symmetry: 1,
      autoEvolve: false,
      particlesEnabled: false,
      showArms: false,
      mouseInteraction: false,
      showFinishPoint: false,
      zoom: 1.0,
      lensEnabled: false,
      strobeEnabled: false,
      theme: 'space',
      synthWaveform: 'sine',
      synthScale: 'chromatic',
      synthDelay: 0.3,
      synthFeedback: 0.4,
      synthReverb: 0.5,
      synthCutoff: 800,
      synthResonance: 1,
      synthTranspose: 0,
      synthComplexity: 1.0,
      synthDrive: 0,
      synthLFOFreq: 2.0,
      synthLFOAmount: 0,
      synthArpSpeed: 0,
      synthArpRange: 1,
      synthMelodyVol: 0.3,
      synthChordVol: 0.5,
      livedraw: true,
      cutpixels: true,
    });

    setCurrentNote({ name: '-', octave: 0, freq: 0 });
    setCurrentKey({ name: 'C', scale: [0, 2, 4, 5, 7, 9, 11], mode: 'major' });

    console.log('App fully reset');
  };

  const startNewRun = (newParams = null) => {
    if (params.soundEnabled && !audioCtx.current) initAudio();

    // Explicitly reset all execution state
    rotationCounterRef.current = 0;
    state.current.startPoint = null;
    state.current.startFrame = 0;

    // Recalculate cycle target based on current or new params
    cycleTargetRef.current = calculateCycle(newParams || params);
    setCycleProgress(0);

    setIsRunning(true);
  };

  const togglePlay = () => {
    if (!isRunning) {
      // Resume if paused, Restart if finished
      const isFinished = params.autoStop &&
        cycleTargetRef.current !== Infinity &&
        cycleTargetRef.current > 0 &&
        (Math.abs(rotationCounterRef.current) >= cycleTargetRef.current - 0.1); // Tolerance

      if (isFinished) {
        startNewRun();
      } else {
        setIsRunning(true);
      }
    } else {
      setIsRunning(false);
    }
  };

  const handleRedraw = () => {
    handleClear();
    startNewRun();
  };


  const updateParam = (key, val) => {
    setParams(prev => ({ ...prev, [key]: val }));
  };

  const randomizer = (type) => {
    handleClear();
    const rand = (min, max) => Math.random() * (max - min) + min;
    const randRPM = () => (Math.random() > 0.5 ? 1 : -1) * rand(0.01, 50);

    let newParams = { ...params };
    // Base resets
    if (type === 'A') { // Symmetric
      newParams.symmetry = 6;
    } else if (type === 'B') { // Chaos
      newParams.symmetry = 1;
    }

    newParams.rotorRPM = randRPM() / 4;
    newParams.lrpm = randRPM();
    newParams.rrpm = randRPM();
    newParams.baseoffsx = rand(-200, 200);
    newParams.baseoffsy = rand(-500, -100);
    newParams.handdist = rand(50, 500);
    newParams.larm1 = rand(20, 200);
    newParams.rarm1 = rand(20, 200);
    newParams.larm2 = rand(100, 400);
    newParams.rarm2 = rand(100, 400);
    newParams.rarmext = rand(0, 150);
    newParams.larma = rand(0, 360);

    // Occasional generative features
    // newParams.autoEvolve = Math.random() > 0.8;
    // newParams.glow = Math.random() > 0.5;

    setParams(newParams);
  };

  const toggleSection = (sectionName) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  const minifyParams = (p) => {
    const min = {};
    Object.keys(p).forEach(key => {
      // Comparison for numbers and strings
      const v1 = p[key];
      const v2 = INITIAL_PARAMS[key];
      if (typeof v1 === 'number' && typeof v2 === 'number') {
        // Skip default numbers (allowing small float diff)
        if (Math.abs(v1 - v2) > 0.0001) min[key] = v1;
      } else if (v1 !== v2) {
        min[key] = v1;
      }
    });
    return min;
  };

  const generateShareLink = (paramsToShare) => {
    // 1. Minify params (preserve only differences from INITIAL_PARAMS)
    const minified = minifyParams(paramsToShare);
    const jsonString = JSON.stringify(minified);
    // 2. Compress/Encode
    const compressed = LZString.compressToEncodedURIComponent(jsonString);
    // 3. Construct URL
    const url = `${window.location.origin}${window.location.pathname}?p=${compressed}`;
    return url;
  };

  // Sharing State
  const [shortLink, setShortLink] = useState('');
  const [isShortening, setIsShortening] = useState(false);
  const shorteningRef = useRef(false);

  useEffect(() => {
    if (sharingItem) {
      const longUrl = generateShareLink(sharingItem.params);

      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        setShortLink(longUrl);
        setIsShortening(false);
        shorteningRef.current = false;
        return;
      }

      setIsShortening(true);
      shorteningRef.current = true;
      setShortLink('');

      const cleanup = (script, callbackName) => {
        if (script && script.parentNode) document.body.removeChild(script);
        if (window[callbackName]) delete window[callbackName];
      };

      const tryTinyUrl = () => {
        const callbackName = 'tinyurl_callback_' + Math.round(100000 * Math.random());
        const script = document.createElement('script');

        window[callbackName] = (data) => {
          if (shorteningRef.current) {
            if (data && data.tinyurl) {
              setShortLink(data.tinyurl);
              setIsShortening(false);
              shorteningRef.current = false;
            } else {
              setShortLink(longUrl);
              setIsShortening(false);
              shorteningRef.current = false;
            }
          }
          cleanup(script, callbackName);
        };

        script.src = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}&callback=${callbackName}`;
        script.onerror = () => {
          if (shorteningRef.current) {
            setShortLink(longUrl);
            setIsShortening(false);
            shorteningRef.current = false;
          }
          cleanup(script, callbackName);
        };
        document.body.appendChild(script);
      };

      const tryIsGd = () => {
        const callbackName = 'isgd_callback_' + Math.round(100000 * Math.random());
        const script = document.createElement('script');

        window[callbackName] = (data) => {
          if (shorteningRef.current) {
            if (data && data.shorturl) {
              setShortLink(data.shorturl);
              setIsShortening(false);
              shorteningRef.current = false;
            } else {
              console.warn('is.gd failed, trying TinyURL...');
              tryTinyUrl();
            }
          }
          cleanup(script, callbackName);
        };

        script.src = `https://is.gd/create.php?callback=${callbackName}&format=json&url=${encodeURIComponent(longUrl)}`;
        script.onerror = () => {
          console.warn('is.gd error, trying TinyURL...');
          tryTinyUrl();
          cleanup(script, callbackName);
        };
        document.body.appendChild(script);
      };

      tryIsGd();

      const timeoutId = setTimeout(() => {
        if (shorteningRef.current) {
          console.warn('Shortening timeout, using long URL');
          setShortLink(longUrl);
          setIsShortening(false);
          shorteningRef.current = false;
        }
      }, 10000); // 10s total patience

      return () => {
        clearTimeout(timeoutId);
        shorteningRef.current = false;
      };
    } else {
      setShortLink('');
      setIsShortening(false);
      shorteningRef.current = false;
    }
  }, [sharingItem]);

  const generateMathFormula = (p) => {
    return (
      <>
        <div className="formula-container">
          <span className="math-symbol">Ψ</span>
          <span className="math-op">=</span>
          <span className="math-val">Sym</span>
          <span className="math-symbol">(</span>
          <span className="math-val">S</span>
          <span className="math-symbol">)</span>
          <span className="math-op">·</span>
          <span className="math-symbol">∫</span>
          <span className="math-symbol">(</span>
          <span className="math-val">ℒ</span>
          <span className="math-symbol">(</span>
          <span className="math-val">ω₁</span>
          <span className="math-symbol">)</span>
          <span className="math-op">+</span>
          <span className="math-val">ℛ</span>
          <span className="math-symbol">(</span>
          <span className="math-val">ω₂</span>
          <span className="math-symbol">)</span>
          <span className="math-symbol">)</span>
          <span className="math-symbol">dt</span>
        </div>
        <div className="formula-data">
          <div className="data-item">
            <span className="data-label">SYMMETRY (S)</span>
            <span className="data-value">{p.symmetry}x</span>
          </div>
          <div className="data-item">
            <span className="data-label">LEFT RPM (ω₁)</span>
            <span className="data-value">{p.lrpm.toFixed(3)}</span>
          </div>
          <div className="data-item">
            <span className="data-label">RIGHT RPM (ω₂)</span>
            <span className="data-value">{p.rrpm.toFixed(3)}</span>
          </div>
          <div className="data-item">
            <span className="data-label">ZOOM</span>
            <span className="data-value">{p.zoom.toFixed(1)}x</span>
          </div>
        </div>
      </>
    );
  };

  const handleCreateNew = () => {
    setViewMode(false);
    handleReset();
    // Clear URL params without reload
    window.history.pushState({}, document.title, window.location.pathname);
  };

  const saveToGallery = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create a small thumbnail
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 160;
    thumbCanvas.height = 120;
    const tctx = thumbCanvas.getContext('2d');
    tctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
    const thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.7);

    const newItem = {
      id: Date.now(),
      params: { ...params }, // Save current params state
      thumbnail,
      date: new Date().toLocaleString()
    };

    setGallery([newItem, ...gallery]);
  };

  const loadFromGallery = (item) => {
    handleClear();

    // Robust merge: ensure we don't lose new keys if loading old preset
    const mergedParams = {
      ...params, // Default/current structure
      ...item.params // Overwrite with saved values
    };

    setParams(mergedParams);

    // Important: Force a clean start with the NEW merged params
    // We pass mergedParams because 'params' state won't update until next render
    startNewRun(mergedParams);
  };

  const deleteFromGallery = (id) => {
    setGallery(gallery.filter(item => item.id !== id));
  };

  const exportSVG = () => {
    const { width, height } = canvasSize;
    let svgContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
    svgLines.current.forEach(line => {
      svgContent += `<line x1="${line.x1.toFixed(2)}" y1="${line.y1.toFixed(2)}" x2="${line.x2.toFixed(2)}" y2="${line.y2.toFixed(2)}" stroke="${line.color}" stroke-opacity="${line.alpha}" stroke-width="${line.lw.toFixed(2)}"/>`;
    });
    svgContent += `</svg>`;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `amuse_${Date.now()}.svg`;
    link.click();
  };

  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `amuse_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Piano note playback
  const playNote = (noteName, octave) => {
    if (!audioCtx.current || !params.soundEnabled) return;

    const noteFrequencies = {
      'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13,
      'E': 329.63, 'F': 349.23, 'F#': 369.99, 'G': 392.00,
      'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
    };

    const baseFreq = noteFrequencies[noteName];
    if (!baseFreq) return;

    // Meditative Chord Palette
    const chordTypes = {
      major: [0, 4, 7],
      minor: [0, 3, 7],
      sus2: [0, 2, 7],
      sus4: [0, 5, 7],
      maj7: [0, 4, 7, 11],
      min7: [0, 3, 7, 10],
      dom7: [0, 4, 7, 10],
      add9: [0, 4, 7, 14],
      min9: [0, 3, 7, 10, 14],
    };

    const getChordType = (note) => {
      const chordMap = {
        'C': 'maj7', 'C#': 'dom7', 'D': 'sus2', 'D#': 'min7',
        'E': 'min9', 'F': 'major', 'F#': 'sus4', 'G': 'add9',
        'G#': 'min7', 'A': 'min7', 'A#': 'dom7', 'B': 'minor',
      };
      return chordTypes[chordMap[note] || 'major'];
    };

    // 1. APPLY TRANSPOSITION
    const transposeOffset = params.synthTranspose || 0;
    const rootFreq = baseFreq * Math.pow(2, Math.min(octave, 3) - 4 + (transposeOffset / 12));

    // 2. APPLY HARMONIC COMPLEXITY (Spreads intervals)
    const complexity = params.synthComplexity || 1.0;
    const intervals = getChordType(noteName).map(s => s * complexity);

    // Create fundamental frequencies + a sub-octave layer
    const chordFreqs = intervals.map(semitones => rootFreq * Math.pow(2, semitones / 12));
    const subFreq = rootFreq * 0.5; // Sub-octave for depth

    const now = audioCtx.current.currentTime;
    const attackTime = 0.5;    // Shorter attack (User request)
    const sustainTime = 1.0;   // Shorter sustain (User request)
    const releaseTime = 1.5;   // Shorter release (User request)

    // 3. DRIVE STAGE (Distortion)
    let driveNode = null;
    if (params.synthDrive > 0) {
      driveNode = audioCtx.current.createWaveShaper();
      const n_samples = 44100;
      const curve = new Float32Array(n_samples);
      const k = params.synthDrive;
      const deg = Math.PI / 180;
      for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1;
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
      driveNode.curve = curve;
      driveNode.oversampling = '4x';
    }

    // 4. MASTER EQ / FILTER
    const filter = audioCtx.current.createBiquadFilter();
    filter.type = 'lowpass';
    const cutoff = params.synthCutoff || 800;
    const resonance = params.synthResonance || 1;

    filter.frequency.setValueAtTime(cutoff, now);
    filter.frequency.exponentialRampToValueAtTime(cutoff * 0.6, now + attackTime + sustainTime);
    filter.Q.value = resonance;

    // Routing: Filter -> Drive (if any) -> Delay/Reverb/Destination
    if (driveNode) {
      filter.connect(driveNode);
      driveNode.connect(audioCtx.current.destination);
      if (reverbNode.current) driveNode.connect(reverbNode.current);
      if (delayNode.current) driveNode.connect(delayNode.current);
    } else {
      filter.connect(audioCtx.current.destination);
      if (reverbNode.current) filter.connect(reverbNode.current);
      if (delayNode.current) filter.connect(delayNode.current);
    }

    // Function to create a voiced oscillator layer
    const createOscLayer = (freq, vol, detune = 0, type = 'sine', panValue = 0) => {
      const osc = audioCtx.current.createOscillator();
      const gain = audioCtx.current.createGain();
      const panner = audioCtx.current.createStereoPanner();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.detune.setValueAtTime(detune, now);

      panner.pan.setValueAtTime(panValue, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + attackTime);
      gain.gain.setValueAtTime(vol, now + attackTime + sustainTime);
      gain.gain.exponentialRampToValueAtTime(0.001, now + attackTime + sustainTime + releaseTime);

      osc.connect(gain);
      gain.connect(panner);

      // Connect to chordGain, then to MASTER FILTER
      if (chordGain.current) {
        panner.connect(chordGain.current);
        chordGain.current.connect(masterFilter.current || audioCtx.current.destination);
      } else if (masterFilter.current) {
        panner.connect(masterFilter.current);
      } else {
        panner.connect(audioCtx.current.destination);
      }

      osc.start(now);
      osc.stop(now + attackTime + sustainTime + releaseTime);
    };

    // LAYER 1: The Sub (Deep base)
    createOscLayer(subFreq, 0.08, 0, 'triangle', 0);

    // LAYER 2: The Chord notes (Rich texture)
    chordFreqs.forEach((freq, i) => {
      const pan = (i % 2 === 0 ? -0.5 : 0.5) * (i / chordFreqs.length);
      const vol = 0.15 / chordFreqs.length; // Base volume, chordGain controls overall

      // Double oscillators per note for detuned chorus effect
      createOscLayer(freq, vol, 5, 'sine', pan);
      createOscLayer(freq, vol, -5, 'sine', -pan);

      // Add a subtle higher harmonic for "shimmer" (very quiet)
      if (i === 0) createOscLayer(freq * 2, 0.02, 10, 'sine', 0.2);
    });
  };

  // Keyboard to piano mapping
  useEffect(() => {
    if (!params.soundEnabled) return;

    const keyMap = {
      // White keys (lower row)
      'a': { note: 'C', octave: 3 },
      's': { note: 'D', octave: 3 },
      'd': { note: 'E', octave: 3 },
      'f': { note: 'F', octave: 3 },
      'g': { note: 'G', octave: 3 },
      'h': { note: 'A', octave: 3 },
      'j': { note: 'B', octave: 3 },
      'k': { note: 'C', octave: 4 },
      'l': { note: 'D', octave: 4 },
      ';': { note: 'E', octave: 4 },
      "'": { note: 'F', octave: 4 },
      // Black keys (upper row)
      'w': { note: 'C#', octave: 3 },
      'e': { note: 'D#', octave: 3 },
      't': { note: 'F#', octave: 3 },
      'y': { note: 'G#', octave: 3 },
      'u': { note: 'A#', octave: 3 },
      'o': { note: 'C#', octave: 4 },
      'p': { note: 'D#', octave: 4 },
      '[': { note: 'F#', octave: 4 },
      ']': { note: 'G#', octave: 4 },
    };

    const handleKeyDown = (e) => {
      if (e.repeat) return; // Prevent repeated firing
      const mapping = keyMap[e.key.toLowerCase()];
      if (mapping) {
        e.preventDefault();
        playNote(mapping.note, mapping.octave);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.soundEnabled, params.synthWaveform]);

  return (
    <div className={`app-container theme-${params.theme}`}>
      {isInitialLoading && (
        <div className="splash-screen">
          <div className="splash-content">
            <div className="splash-logo">
              <div className="spiro-loader"></div>
            </div>
            <h1>AMUSE</h1>
            <p>Generative Art & Sound Synthesis</p>
            <p style={{ fontSize: '12px', marginTop: '15px', opacity: 0.6, letterSpacing: '2px', fontFamily: "'Orbitron', sans-serif" }}>created by Van Lax</p>
            <div className="loading-bar-container">
              <div className="loading-bar-progress"></div>
            </div>
          </div>
        </div>
      )}

      <div className="canvas-container" ref={containerRef}>
        <div className="canvas-wrapper" style={{
          transform: `scale(${baseScale * params.zoom})`,
          transition: 'transform 0.2s ease-out'
        }}>
          <canvas
            ref={canvasRef}
            style={{ filter: params.glow ? 'brightness(1.2) contrast(1.1) drop-shadow(0 0 10px rgba(0, 240, 255, 0.3))' : 'none' }}
          />
          <canvas
            ref={debugCanvasRef}
            className="debug-canvas"
            onMouseMove={handleMouseMove}
          />
        </div>
        <div className="stats">
          Amuse v3.2 | Immersive Art Machine | {params.soundEnabled ? '🔊 SONIC SYNTH ACTIVE' : 'VISUAL MODE'}
        </div>

        {/* Virtual Piano */}
        {params.soundEnabled && (
          <div className="piano-container">
            <div className="piano-keyboard">
              {/* Octave 3 */}
              <div className="piano-octave">
                <button className={`piano-key white ${currentNote.name === 'C' && currentNote.octave === 3 ? 'active' : ''}`} onMouseDown={() => playNote('C', 3)}><span>C3</span></button>
                <button className={`piano-key black ${currentNote.name === 'C#' && currentNote.octave === 3 ? 'active' : ''}`} onMouseDown={() => playNote('C#', 3)}></button>
                <button className={`piano-key white ${currentNote.name === 'D' && currentNote.octave === 3 ? 'active' : ''}`} onMouseDown={() => playNote('D', 3)}><span>D3</span></button>
                <button className={`piano-key black ${currentNote.name === 'D#' && currentNote.octave === 3 ? 'active' : ''}`} onMouseDown={() => playNote('D#', 3)}></button>
                <button className={`piano-key white ${currentNote.name === 'E' && currentNote.octave === 3 ? 'active' : ''}`} onMouseDown={() => playNote('E', 3)}><span>E3</span></button>
                <button className={`piano-key white ${currentNote.name === 'F' && currentNote.octave === 3 ? 'active' : ''}`} onMouseDown={() => playNote('F', 3)}><span>F3</span></button>
                <button className={`piano-key black ${currentNote.name === 'F#' && currentNote.octave === 3 ? 'active' : ''}`} onMouseDown={() => playNote('F#', 3)}></button>
                <button className={`piano-key white ${currentNote.name === 'G' && currentNote.octave === 3 ? 'active' : ''}`} onMouseDown={() => playNote('G', 3)}><span>G3</span></button>
                <button className={`piano-key black ${currentNote.name === 'G#' && currentNote.octave === 3 ? 'active' : ''}`} onMouseDown={() => playNote('G#', 3)}></button>
                <button className={`piano-key white ${currentNote.name === 'A' && currentNote.octave === 3 ? 'active' : ''}`} onMouseDown={() => playNote('A', 3)}><span>A3</span></button>
                <button className={`piano-key black ${currentNote.name === 'A#' && currentNote.octave === 3 ? 'active' : ''}`} onMouseDown={() => playNote('A#', 3)}></button>
                <button className={`piano-key white ${currentNote.name === 'B' && currentNote.octave === 3 ? 'active' : ''}`} onMouseDown={() => playNote('B', 3)}><span>B3</span></button>
              </div>
              {/* Octave 4 */}
              <div className="piano-octave">
                <button className={`piano-key white ${currentNote.name === 'C' && currentNote.octave === 4 ? 'active' : ''}`} onMouseDown={() => playNote('C', 4)}><span>C4</span></button>
                <button className={`piano-key black ${currentNote.name === 'C#' && currentNote.octave === 4 ? 'active' : ''}`} onMouseDown={() => playNote('C#', 4)}></button>
                <button className={`piano-key white ${currentNote.name === 'D' && currentNote.octave === 4 ? 'active' : ''}`} onMouseDown={() => playNote('D', 4)}><span>D4</span></button>
                <button className={`piano-key black ${currentNote.name === 'D#' && currentNote.octave === 4 ? 'active' : ''}`} onMouseDown={() => playNote('D#', 4)}></button>
                <button className={`piano-key white ${currentNote.name === 'E' && currentNote.octave === 4 ? 'active' : ''}`} onMouseDown={() => playNote('E', 4)}><span>E4</span></button>
                <button className={`piano-key white ${currentNote.name === 'F' && currentNote.octave === 4 ? 'active' : ''}`} onMouseDown={() => playNote('F', 4)}><span>F4</span></button>
                <button className={`piano-key black ${currentNote.name === 'F#' && currentNote.octave === 4 ? 'active' : ''}`} onMouseDown={() => playNote('F#', 4)}></button>
                <button className={`piano-key white ${currentNote.name === 'G' && currentNote.octave === 4 ? 'active' : ''}`} onMouseDown={() => playNote('G', 4)}><span>G4</span></button>
                <button className={`piano-key black ${currentNote.name === 'G#' && currentNote.octave === 4 ? 'active' : ''}`} onMouseDown={() => playNote('G#', 4)}></button>
                <button className={`piano-key white ${currentNote.name === 'A' && currentNote.octave === 4 ? 'active' : ''}`} onMouseDown={() => playNote('A', 4)}><span>A4</span></button>
                <button className={`piano-key black ${currentNote.name === 'A#' && currentNote.octave === 4 ? 'active' : ''}`} onMouseDown={() => playNote('A#', 4)}></button>
                <button className={`piano-key white ${currentNote.name === 'B' && currentNote.octave === 4 ? 'active' : ''}`} onMouseDown={() => playNote('B', 4)}><span>B4</span></button>
              </div>
              {/* Octave 5 */}
              <div className="piano-octave">
                <button className={`piano-key white ${currentNote.name === 'C' && currentNote.octave === 5 ? 'active' : ''}`} onMouseDown={() => playNote('C', 5)}><span>C5</span></button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!viewMode && (
        <button
          className="mobile-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle Menu"
        >
          {isMobileMenuOpen ? '✕' : '⚙️'}
        </button>
      )}

      <div className={`controls-panel ${isMobileMenuOpen ? 'mobile-open' : ''}`} style={viewMode ? { display: 'none' } : {}}>
        <div>
          <h1>Amuse</h1>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Generative Art & Sound Synthesis</p>
          <p style={{ fontSize: '9px', color: 'var(--accent-primary)', marginTop: '5px', opacity: 0.8, letterSpacing: '1px', textTransform: 'uppercase' }}>Created by Van Lax</p>
        </div>

        {/* Randomizers - Top Priority */}
        <div className={`section-title ${collapsedSections['quickRandom'] ? 'collapsed' : ''}`} onClick={() => toggleSection('quickRandom')}>
          Quick Randomizers
        </div>
        <div className={`section-content ${collapsedSections['quickRandom'] ? 'collapsed' : ''}`}>
          <div className="button-group grid-2" style={{ marginBottom: '20px' }}>
            <button onClick={() => randomizer('A')}>🎲 Rand A (Sym)</button>
            <button onClick={() => randomizer('B')}>🎲 Rand B (Chaos)</button>
            <button onClick={() => randomizer('C')}>🎲 Rand C (Flow)</button>
            <button onClick={() => randomizer('D')}>🎲 Rand D (Deep)</button>
          </div>
        </div>

        {/* Main Actions */}
        <div className="button-group grid-4" style={{ marginBottom: '20px' }}>
          <button
            className={isRunning ? "running" : "primary"}
            onClick={togglePlay}
            style={isRunning ? { background: 'rgba(255, 100, 100, 0.2)', borderColor: '#ff6464', position: 'relative' } : {}}
          >
            {isRunning ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.2' }}>
                <span>⏸ Stop</span>
                <small style={{ fontSize: '9px', opacity: 0.7 }}>
                  {cycleTargetRef.current === Infinity ? 'Endless ∞' : `Cycle: ${Math.round(cycleProgress)}%`}
                </small>
              </div>
            ) : '▶ Run'}
          </button>
          <button onClick={handleRedraw}>🔄 Redraw</button>
          <button onClick={handleClear}>🗑 Clear</button>
          <button
            style={{ background: 'rgba(255, 50, 50, 0.3)', borderColor: '#ff3333', color: '#ff6666' }}
            onClick={handleReset}
            title="Full reset - stops everything and resets all parameters"
          >⚠️ Reset</button>
        </div>

        {/* SECTION: VIEW & EXPORT */}
        <div className={`section-title ${collapsedSections['viewExport'] ? 'collapsed' : ''}`} onClick={() => toggleSection('viewExport')}>
          View & Export
        </div>
        <div className={`section-content ${collapsedSections['viewExport'] ? 'collapsed' : ''}`}>
          <div className="control-group">
            <label>Zoom</label>
            <input type="range" min="0.5" max="4.0" step="0.1" value={params.zoom} onChange={(e) => updateParam('zoom', parseFloat(e.target.value))} />
          </div>
          <div className="button-group grid-2">
            <button className={params.showArms ? 'active' : ''} onClick={() => updateParam('showArms', !params.showArms)}>🦾 Arms</button>
            <button className={params.lensEnabled ? 'active' : ''} onClick={() => updateParam('lensEnabled', !params.lensEnabled)}>🔍 Lens</button>
          </div>
          <div className="button-group grid-1" style={{ marginTop: '10px' }}>
            <button
              className="primary"
              onClick={() => setSharingItem({
                id: 'current',
                params: { ...params },
                thumbnail: canvasRef.current ? canvasRef.current.toDataURL() : ''
              })}
              style={{ background: 'linear-gradient(135deg, #00f0ff 0%, #0077ff 100%)', color: 'black', fontWeight: 'bold' }}
            >
              🔗 SHARE UNIVERSE
            </button>
          </div>
        </div>

        {/* SECTION: CORE ENGINE */}
        <div className={`section-title ${collapsedSections['coreEngine'] ? 'collapsed' : ''}`} onClick={() => toggleSection('coreEngine')}>
          Core Engine
        </div>
        <div className={`section-content ${collapsedSections['coreEngine'] ? 'collapsed' : ''}`}>
          <div className="control-group">
            <label>Rendering Mode</label>
            <select value={params.mode} onChange={(e) => updateParam('mode', e.target.value)}>
              <option value={MODES.ORIGINAL}>Linkage (Spirograph)</option>
              <option value={MODES.CYMATICS}>Cymatics (Chladni Plate)</option>
            </select>
          </div>
          <div className="control-group">
            <label>Acceleration <span>{params.acceleration}</span></label>
            <input type="range" min="1" max="500" value={params.acceleration} onChange={(e) => updateParam('acceleration', parseInt(e.target.value))} />
          </div>
          <div className="control-group">
            <label>
              Rotor RPM
              <input
                type="number"
                step="0.001"
                value={params.rotorRPM}
                onChange={(e) => updateParam('rotorRPM', parseFloat(e.target.value) || 0)}
              />
            </label>
            <input type="range" min="-50" max="50" step="0.001" value={params.rotorRPM} onChange={(e) => updateParam('rotorRPM', parseFloat(e.target.value))} />
          </div>

          <div className="control-group" style={{ marginTop: '10px' }}>
            <button
              className={params.autoStop ? 'active' : ''}
              onClick={() => updateParam('autoStop', !params.autoStop)}
              style={{ width: '100%', fontSize: '11px', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span>{params.autoStop ? '🏁 Geometric Auto-Stop' : '🔄 Endless Rotation'}</span>
              <span style={{ opacity: 0.6 }}>{params.autoStop ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* SECTION: CYMATICS LAB */}
        {params.mode === MODES.CYMATICS && (
          <>
            <div className={`section-title ${collapsedSections['cymaticsLab'] ? 'collapsed' : ''}`} onClick={() => toggleSection('cymaticsLab')}>
              Cymatics Lab 🌊
            </div>
            <div className={`section-content ${collapsedSections['cymaticsLab'] ? 'collapsed' : ''}`}>

              {/* File Upload */}
              <div className="control-group">
                <input 
                  type="file" 
                  accept="audio/*" 
                  onChange={handleAudioUpload}
                  id="audio-upload"
                  style={{ display: 'none' }}
                />
                <button 
                  onClick={() => document.getElementById('audio-upload').click()}
                  style={{ width: '100%', background: 'linear-gradient(135deg, #00f0ff 0%, #ff00ff 100%)', color: '#000', fontWeight: 'bold', letterSpacing: '0.5px' }}
                >
                  🎵 {cymaticsTrackName ? 'Change Track' : 'Upload & Visualize'}
                </button>
              </div>

              {/* Player */}
              {cymaticsTrackName && (
                <div className="cymatics-player">
                  <div className="cymatics-track-name">♪ {cymaticsTrackName}</div>

                  {/* Waveform Canvas — click or drag to seek */}
                  <canvas
                    ref={waveformCanvasRef}
                    className="cymatics-waveform"
                    width={220}
                    height={60}
                    style={{ cursor: 'pointer' }}
                    onMouseDown={(e) => {
                      waveformDraggingRef.current = true;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = (e.clientX - rect.left) / rect.width;
                      handleCymaticsSeek(Math.max(0, Math.min(1, ratio)) * cymaticsDuration);
                    }}
                    onMouseMove={(e) => {
                      if (!waveformDraggingRef.current) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = (e.clientX - rect.left) / rect.width;
                      handleCymaticsSeek(Math.max(0, Math.min(1, ratio)) * cymaticsDuration);
                    }}
                    onMouseUp={() => { waveformDraggingRef.current = false; }}
                    onMouseLeave={() => { waveformDraggingRef.current = false; }}
                  />

                  {/* Timer */}
                  <div className="cymatics-timer">
                    {(() => {
                      const fmt = (t) => `${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
                      return `${fmt(cymaticsCurrentTime)} / ${fmt(cymaticsDuration)}`;
                    })()}
                  </div>

                  {/* Controls */}
                  <div className="cymatics-controls">
                    <button
                      className="cymatics-ctrl-btn"
                      onClick={() => { cymaticsOffsetRef.current = 0; handleCymaticsSeek(0); }}
                      title="Restart"
                    >⏮</button>
                    <button
                      className="cymatics-ctrl-btn cymatics-play-btn"
                      onClick={() => cymaticsPlaying ? cymaticsPause() : cymaticsPlay(cymaticsOffsetRef.current)}
                    >
                      {cymaticsPlaying ? '⏸' : '▶'}
                    </button>
                    <button
                      className="cymatics-ctrl-btn"
                      onClick={cymaticsStop}
                      title="Stop"
                    >⏹</button>
                  </div>
                </div>
              )}

              {/* Advanced Modes */}
              <div className="button-group grid-2" style={{ marginTop: '12px' }}>
                <button 
                  className={params.cymaticsFieldMode ? 'active' : ''}
                  onClick={() => updateParam('cymaticsFieldMode', !params.cymaticsFieldMode)}
                  style={{ fontSize: '10px' }}
                >
                  {params.cymaticsFieldMode ? '💠 Grid Field' : '⏳ Particle Sand'}
                </button>
                <button 
                  className={params.cymaticsRainbowMode ? 'active' : ''}
                  onClick={() => updateParam('cymaticsRainbowMode', !params.cymaticsRainbowMode)}
                  style={{ fontSize: '10px' }}
                >
                  {params.cymaticsRainbowMode ? '🌈 Spectral' : '⚪ Static'}
                </button>
                <button 
                  className={params.cymaticsGhostMode ? 'active' : ''}
                  onClick={() => updateParam('cymaticsGhostMode', !params.cymaticsGhostMode)}
                  style={{ fontSize: '10px' }}
                >
                  {params.cymaticsGhostMode ? '👻 Ghost ON' : '👻 Ghost OFF'}
                </button>
                <button 
                  className={params.cymaticsOilMode ? 'active' : ''}
                  onClick={() => updateParam('cymaticsOilMode', !params.cymaticsOilMode)}
                  style={{ fontSize: '10px' }}
                >
                  {params.cymaticsOilMode ? '🖼️ Art Freeze ON' : '🖼️ Art Freeze OFF'}
                </button>
                <button 
                  className={params.cymaticsCircular ? 'active' : ''}
                  onClick={() => updateParam('cymaticsCircular', !params.cymaticsCircular)}
                  style={{ fontSize: '10px' }}
                >
                  {params.cymaticsCircular ? '⚪ Circle ON' : '⬜ Circle OFF'}
                </button>
                <button 
                  className={params.cymaticsRippleMode ? 'active' : ''}
                  onClick={() => updateParam('cymaticsRippleMode', !params.cymaticsRippleMode)}
                  style={{ fontSize: '10px' }}
                >
                  {params.cymaticsRippleMode ? '🔘 Ripple Waves ON' : '🔘 Ripple Waves OFF'}
                </button>
                <button 
                  onClick={handleCymaticsShuffle}
                  style={{ fontSize: '10px', background: 'rgba(255,255,255,0.1)' }}
                >
                  🎲 Shuffle
                </button>
                <button 
                  onClick={handleCymaticsExport}
                  style={{ fontSize: '10px', background: 'rgba(0,255,150,0.2)', color: '#00ffaa', border: '1px solid rgba(0,255,150,0.3)' }}
                >
                  💾 Save Art
                </button>
              </div>

              {/* Cymatics Parameters */}
              <div className="control-group" style={{ marginTop: '12px' }}>
                <label>Sensitivity <span>{params.cymaticsSensitivity.toFixed(1)}</span></label>
                <input type="range" min="0.1" max="5.0" step="0.1" value={params.cymaticsSensitivity} onChange={(e) => updateParam('cymaticsSensitivity', parseFloat(e.target.value))} />
              </div>
              <div className="control-group">
                <label>N Parameter <span>{params.cymaticsN}</span></label>
                <input type="range" min="1" max="20" step="1" value={params.cymaticsN} onChange={(e) => updateParam('cymaticsN', parseInt(e.target.value))} />
              </div>
              <div className="control-group">
                <label>M Parameter <span>{params.cymaticsM}</span></label>
                <input type="range" min="1" max="20" step="1" value={params.cymaticsM} onChange={(e) => updateParam('cymaticsM', parseInt(e.target.value))} />
              </div>
              <div className="control-group">
                <label>Particle Count <span>{params.cymaticsParticleCount}</span></label>
                <input type="range" min="1000" max="30000" step="1000" value={params.cymaticsParticleCount} onChange={(e) => updateParam('cymaticsParticleCount', parseInt(e.target.value))} />
              </div>
              <div className="control-group">
                <label>Spin Speed <span>{params.cymaticsSpin.toFixed(2)}</span></label>
                <input type="range" min="-2.0" max="2.0" step="0.01" value={params.cymaticsSpin} onChange={(e) => updateParam('cymaticsSpin', parseFloat(e.target.value))} />
              </div>
              <div className="control-group">
                <label>Flight Speed (Zoom) <span>{params.cymaticsZoom.toFixed(2)}</span></label>
                <input type="range" min="-5.0" max="5.0" step="0.05" value={params.cymaticsZoom} onChange={(e) => updateParam('cymaticsZoom', parseFloat(e.target.value))} />
              </div>
            </div>
          </>
        )}

        {/* SECTION: ARM BASE */}
        <div className={`section-title ${collapsedSections['armBase'] ? 'collapsed' : ''}`} onClick={() => toggleSection('armBase')}>
          Arm Base
        </div>
        <div className={`section-content ${collapsedSections['armBase'] ? 'collapsed' : ''}`}>
          <div className="control-group">
            <label>Offset X <span>{params.baseoffsx}</span></label>
            <input type="range" min="-500" max="500" value={params.baseoffsx} onChange={(e) => updateParam('baseoffsx', parseInt(e.target.value))} />
          </div>
          <div className="control-group">
            <label>Offset Y <span>{params.baseoffsy}</span></label>
            <input type="range" min="-1000" max="0" value={params.baseoffsy} onChange={(e) => updateParam('baseoffsy', parseInt(e.target.value))} />
          </div>
          <div className="control-group">
            <label>Hand Distance <span>{params.handdist}</span></label>
            <input type="range" min="0" max="1000" value={params.handdist} onChange={(e) => updateParam('handdist', parseInt(e.target.value))} />
          </div>
        </div>

        {/* SECTION: GENERATIVE ART ENGINE */}
        <div className={`section-title ${collapsedSections['genArtEngine'] ? 'collapsed' : ''}`} onClick={() => toggleSection('genArtEngine')}>
          Generative Art Engine
        </div>
        <div className={`section-content ${collapsedSections['genArtEngine'] ? 'collapsed' : ''}`}>
          <div className="control-group">
            <label>Kaleidoscope Symmetry <span>{params.symmetry}x Axis</span></label>
            <div className="button-group grid-3" style={{ marginTop: '8px' }}>
              {[1, 2, 4, 6, 8, 12].map(s => (
                <button key={s} className={params.symmetry === s ? 'active' : ''} onClick={() => updateParam('symmetry', s)}>{s === 1 ? 'Off' : s + 'x'}</button>
              ))}
            </div>
          </div>

          <div className="button-group grid-2" style={{ marginTop: '10px' }}>
            <button className={params.autoEvolve ? 'active' : ''} onClick={() => updateParam('autoEvolve', !params.autoEvolve)}>
              {params.autoEvolve ? '🧬 Evolve: On' : '🧬 Evolve: Off'}
            </button>
            <button className={params.glow ? 'active' : ''} onClick={() => updateParam('glow', !params.glow)}>
              {params.glow ? '✨ Glow: On' : '✨ Glow: Off'}
            </button>
          </div>
        </div>

        {/* SECTION: IMMERSIVE & VIEW CONTROLS */}
        <div className={`section-title ${collapsedSections['viewControls'] ? 'collapsed' : ''}`} onClick={() => toggleSection('viewControls')}>
          Immersive & View Controls
        </div>
        <div className={`section-content ${collapsedSections['viewControls'] ? 'collapsed' : ''}`}>
          <div className="control-group">
            <label>View Zoom <span>{(params.zoom * 100).toFixed(0)}%</span></label>
            <input type="range" min="0.5" max="4.0" step="0.1" value={params.zoom} onChange={(e) => updateParam('zoom', parseFloat(e.target.value))} />
          </div>
          <div className="button-group">
            <button className={params.showArms ? 'active' : ''} onClick={() => updateParam('showArms', !params.showArms)}>
              {params.showArms ? '🦾 Mechanisms: On' : '🦾 Mechanisms: Off'}
            </button>
            <button className={params.lensEnabled ? 'active' : ''} onClick={() => updateParam('lensEnabled', !params.lensEnabled)}>
              {params.lensEnabled ? '🔍 Lens: Active' : '🔍 Enable Lens'}
            </button>
          </div>
          <div className="button-group" style={{ marginTop: '10px' }}>
            <button className={params.mouseInteraction ? 'active' : ''} onClick={() => updateParam('mouseInteraction', !params.mouseInteraction)}>
              {params.mouseInteraction ? '🖱️ Distort: On' : '🖱️ Distort: Off'}
            </button>
            <button className={params.showFinishPoint ? 'active' : ''} onClick={() => updateParam('showFinishPoint', !params.showFinishPoint)}>
              {params.showFinishPoint ? '🎯 Finish Point: On' : '🎯 Finish Point: Off'}
            </button>
          </div>
        </div>

        {/* SECTION: LEFT MECHANISM */}
        <div className={`section-title ${collapsedSections['leftMechanism'] ? 'collapsed' : ''}`} onClick={() => toggleSection('leftMechanism')}>
          Left Mechanism
        </div>
        <div className={`section-content ${collapsedSections['leftMechanism'] ? 'collapsed' : ''}`}>
          <div className="control-group">
            <label>
              RPM
              <input
                type="number"
                step="0.001"
                value={params.lrpm}
                onChange={(e) => updateParam('lrpm', parseFloat(e.target.value) || 0)}
              />
            </label>
            <input type="range" min="-100" max="100" step="0.001" value={params.lrpm} onChange={(e) => updateParam('lrpm', parseFloat(e.target.value))} />
          </div>
          <div className="control-group">
            <label>Arm Lengths (1 & 2)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input type="range" min="0" max="500" value={params.larm1} onChange={(e) => updateParam('larm1', parseInt(e.target.value))} />
              <input type="range" min="0" max="800" value={params.larm2} onChange={(e) => updateParam('larm2', parseInt(e.target.value))} />
            </div>
          </div>
        </div>

        {/* SECTION: RIGHT MECHANISM */}
        <div className={`section-title ${collapsedSections['rightMechanism'] ? 'collapsed' : ''}`} onClick={() => toggleSection('rightMechanism')}>
          Right Mechanism
        </div>
        <div className={`section-content ${collapsedSections['rightMechanism'] ? 'collapsed' : ''}`}>
          <div className="control-group">
            <label>
              RPM
              <input
                type="number"
                step="0.001"
                value={params.rrpm}
                onChange={(e) => updateParam('rrpm', parseFloat(e.target.value) || 0)}
              />
            </label>
            <input type="range" min="-100" max="100" step="0.001" value={params.rrpm} onChange={(e) => updateParam('rrpm', parseFloat(e.target.value))} />
          </div>
          <div className="control-group">
            <label>Arm Lengths (1 & 2)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input type="range" min="0" max="500" value={params.rarm1} onChange={(e) => updateParam('rarm1', parseInt(e.target.value))} />
              <input type="range" min="0" max="800" value={params.rarm2} onChange={(e) => updateParam('rarm2', parseInt(e.target.value))} />
            </div>
          </div>
          <div className="control-group">
            <label>Extension <span>{params.rarmext}</span></label>
            <input type="range" min="-200" max="400" value={params.rarmext} onChange={(e) => updateParam('rarmext', parseInt(e.target.value))} />
          </div>
        </div>

        {/* SECTION: STYLE */}
        <div className={`section-title ${collapsedSections['penStyle'] ? 'collapsed' : ''}`} onClick={() => toggleSection('penStyle')}>
          Pen & Style
        </div>
        <div className={`section-content ${collapsedSections['penStyle'] ? 'collapsed' : ''}`}>
          <div className="control-group">
            <select value={params.penStyle} onChange={(e) => updateParam('penStyle', parseInt(e.target.value))}>
              <option value={PEN_STYLES.RAINBOW}>🌈 Rainbow</option>
              <option value={PEN_STYLES.BW}>🌓 Black & White</option>
              <option value={PEN_STYLES.KALEIDOSCOPE}>💠 Kaleidoscope</option>
              <option value={PEN_STYLES.BLUE}>🌊 Deep Blue</option>
              <option value={PEN_STYLES.GOLDEN}>✨ Golden Gradient</option>
              <option value={PEN_STYLES.FRAGMENTED}>⚡ Fragmented (Glitch)</option>
              <option value={PEN_STYLES.HOLOGRAPHIC}>💎 Holographic 3D omni</option>
              <option value={PEN_STYLES.SILK}>🕸️ Fine Silk (Ultra)</option>
              <option value={PEN_STYLES.SILK_INVERSE}>✨ Ethereal Silk (Inverse)</option>
            </select>
          </div>
          <div className="control-group">
            <label>Line Width <span>{params.lineWidth.toFixed(1)}</span></label>
            <input type="range" min="0.1" max="5.0" step="0.1" value={params.lineWidth} onChange={(e) => updateParam('lineWidth', parseFloat(e.target.value))} />
          </div>
          <div className="button-group grid-4" style={{ marginTop: '10px' }}>
            <button className={params.brightnessMode === BRIGHTNESS_MODES.DIV10 ? 'active' : ''} onClick={() => updateParam('brightnessMode', BRIGHTNESS_MODES.DIV10)}>/10</button>
            <button className={params.brightnessMode === BRIGHTNESS_MODES.DIV5 ? 'active' : ''} onClick={() => updateParam('brightnessMode', BRIGHTNESS_MODES.DIV5)}>/5</button>
            <button className={params.brightnessMode === BRIGHTNESS_MODES.X1 ? 'active' : ''} onClick={() => updateParam('brightnessMode', BRIGHTNESS_MODES.X1)}>1x</button>
            <button className={params.brightnessMode === BRIGHTNESS_MODES.X2 ? 'active' : ''} onClick={() => updateParam('brightnessMode', BRIGHTNESS_MODES.X2)}>2x</button>
          </div>
        </div>

        {/* SECTION: AUDIO */}
        <div className={`section-title ${collapsedSections['spiroSynth'] ? 'collapsed' : ''}`} onClick={() => toggleSection('spiroSynth')}>
          Spiro-Synth 2.0
        </div>
        <div className={`section-content ${collapsedSections['spiroSynth'] ? 'collapsed' : ''}`}>
          <div className="control-group">
            <div className="note-display">
              <div className="note-label">{params.synthScale} Scale</div>
              <div className="note-value">{currentNote.name}<sub>{currentNote.octave}</sub></div>
              <div className="note-freq">{currentNote.freq} Hz</div>
            </div>

            <div className="control-group">
              <label>Waveform</label>
              <div className="button-group grid-4" style={{ marginTop: '5px' }}>
                <button className={params.synthWaveform === 'sine' ? 'active' : ''} onClick={() => updateParam('synthWaveform', 'sine')}>~</button>
                <button className={params.synthWaveform === 'triangle' ? 'active' : ''} onClick={() => updateParam('synthWaveform', 'triangle')}>△</button>
                <button className={params.synthWaveform === 'sawtooth' ? 'active' : ''} onClick={() => updateParam('synthWaveform', 'sawtooth')}>N</button>
                <button className={params.synthWaveform === 'square' ? 'active' : ''} onClick={() => updateParam('synthWaveform', 'square')}>∏</button>
              </div>
            </div>

            <div className="control-group">
              <label>Musical Scale</label>
              <select value={params.synthScale} onChange={(e) => updateParam('synthScale', e.target.value)}>
                <option value="chromatic">Chromatic</option>
                <option value="major">Major</option>
                <option value="minor">Minor</option>
                <option value="pentatonic">Pentatonic</option>
                <option value="blues">Blues</option>
              </select>
            </div>

            <div className="control-group">
              <label>FX: Delay / Feedback / Reverb</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <input type="range" min="0" max="1" step="0.05" value={params.synthDelay} onChange={(e) => updateParam('synthDelay', parseFloat(e.target.value))} />
                <input type="range" min="0" max="0.9" step="0.05" value={params.synthFeedback} onChange={(e) => updateParam('synthFeedback', parseFloat(e.target.value))} />
                <input type="range" min="0" max="1" step="0.05" value={params.synthReverb} onChange={(e) => updateParam('synthReverb', parseFloat(e.target.value))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '9px', textAlign: 'center', marginTop: '4px', color: 'var(--text-tertiary)' }}>
                <span>Delay</span><span>Feedback</span><span>Reverb</span>
              </div>
            </div>
          </div>
        </div>

        {/* NEW: SONIC MODELING SECTION */}
        <div className={`section-title ${collapsedSections['sonicEQ'] ? 'collapsed' : ''}`} onClick={() => toggleSection('sonicEQ')}>
          Sonic Modeling & EQ
        </div>
        <div className={`section-content ${collapsedSections['sonicEQ'] ? 'collapsed' : ''}`}>
          <div className="control-group">
            <label>Transposition <span>{params.synthTranspose > 0 ? '+' : ''}{params.synthTranspose}</span></label>
            <input type="range" min="-12" max="12" step="1" value={params.synthTranspose} onChange={(e) => updateParam('synthTranspose', parseInt(e.target.value))} />
          </div>

          <div className="control-group">
            <label>Filter Cutoff (EQ) <span>{params.synthCutoff}Hz</span></label>
            <input type="range" min="200" max="5000" step="10" value={params.synthCutoff} onChange={(e) => updateParam('synthCutoff', parseInt(e.target.value))} />
          </div>

          <div className="control-group">
            <label>Resonance (Q) <span>{params.synthResonance}</span></label>
            <input type="range" min="1" max="20" step="0.1" value={params.synthResonance} onChange={(e) => updateParam('synthResonance', parseFloat(e.target.value))} />
          </div>

          <div className="control-group">
            <label>Harmonic Complexity <span>{params.synthComplexity.toFixed(2)}x</span></label>
            <input type="range" min="0.5" max="2.5" step="0.1" value={params.synthComplexity} onChange={(e) => updateParam('synthComplexity', parseFloat(e.target.value))} />
          </div>

          <div className="control-group">
            <label>Drive (Saturation) <span>{params.synthDrive}</span></label>
            <input type="range" min="0" max="100" step="1" value={params.synthDrive} onChange={(e) => updateParam('synthDrive', parseInt(e.target.value))} />
          </div>
        </div>

        {/* NEW: GENERATIVE PERFORMANCE */}
        <div className={`section-title ${collapsedSections['genPerf'] ? 'collapsed' : ''}`} onClick={() => toggleSection('genPerf')}>
          Generative Performance
        </div>
        <div className={`section-content ${collapsedSections['genPerf'] ? 'collapsed' : ''}`}>
          <div className="control-group">
            <label>Rhythmic Pulse (LFO) <span>Spd: {params.synthLFOFreq}Hz | Amt: {Math.round(params.synthLFOAmount * 100)}%</span></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input type="range" min="0" max="10" step="0.1" value={params.synthLFOFreq} onChange={(e) => updateParam('synthLFOFreq', parseFloat(e.target.value))} />
              <input type="range" min="0" max="1" step="0.05" value={params.synthLFOAmount} onChange={(e) => updateParam('synthLFOAmount', parseFloat(e.target.value))} />
            </div>
          </div>

          <div className="control-group">
            <label>Micro-Arpeggiator <span>{params.synthArpSpeed === 0 ? 'Off' : `Speed: ${params.synthArpSpeed}`}</span></label>
            <input type="range" min="0" max="20" step="1" value={params.synthArpSpeed} onChange={(e) => updateParam('synthArpSpeed', parseInt(e.target.value))} />
          </div>

          <div className="control-group">
            <label>Mix: Melody / Chords <span>{Math.round(params.synthMelodyVol * 100)}% | {Math.round(params.synthChordVol * 100)}%</span></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input type="range" min="0" max="1" step="0.05" value={params.synthMelodyVol} onChange={(e) => updateParam('synthMelodyVol', parseFloat(e.target.value))} />
              <input type="range" min="0" max="1" step="0.05" value={params.synthChordVol} onChange={(e) => updateParam('synthChordVol', parseFloat(e.target.value))} />
            </div>
          </div>

          <div className="button-group grid-2" style={{ marginTop: '10px' }}>
            <button
              className={params.soundEnabled ? 'active primary' : ''}
              onClick={() => {
                if (!audioCtx.current) initAudio();
                updateParam('soundEnabled', !params.soundEnabled);
              }}
              style={{ width: '100%' }}
            >
              {params.soundEnabled ? '🔊 Audio ON' : '🔈 Enable Audio'}
            </button>
            <button
              onClick={resetAudio}
              style={{ width: '100%', background: 'rgba(255, 100, 100, 0.1)', borderColor: 'rgba(255, 100, 100, 0.3)' }}
              title="Panic button: fixes audio hang/feedback"
            >
              ♻️ Reset Engine
            </button>
          </div>
        </div>

        {/* GALLERY */}
        {!viewMode && (
          <div className={`section-title ${collapsedSections['gallery'] ? 'collapsed' : ''}`} onClick={() => toggleSection('gallery')}>
            Gallery & Presets
          </div>
        )}
        {!viewMode && (
          <div className={`section-content ${collapsedSections['gallery'] ? 'collapsed' : ''}`}>
            <div className="button-group grid-2" style={{ marginBottom: '15px' }}>
              <button className="primary" onClick={saveToGallery}>⭐ Save Preset</button>
              <button onClick={refreshGallery} style={{ fontSize: '11px' }}>🔄 Reload</button>
            </div>

            <div className="gallery-grid">
              {gallery.map(item => (
                <div key={item.id} className="gallery-item">
                  <img src={item.thumbnail} alt="Saved spirograph" onClick={() => loadFromGallery(item)} />
                  <div className="gallery-item-actions">
                    <button className="small-btn" onClick={() => loadFromGallery(item)}>▶ Load</button>
                    <button className="small-btn" onClick={() => setSharingItem(item)}>🔗 Share</button>
                    <button className="small-btn delete" onClick={() => deleteFromGallery(item.id)}>🗑</button>
                  </div>
                </div>
              ))}
              {gallery.length === 0 && (
                <p style={{ gridColumn: 'span 2', textAlign: 'center', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  Your saved configurations will appear here.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* VIEW MODE OVERLAY */}
      {viewMode && (
        <div style={{
          position: 'fixed',
          bottom: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          textAlign: 'center',
          width: '100%'
        }}>
          <button
            className="primary"
            style={{
              padding: '15px 30px',
              fontSize: '18px',
              fontFamily: "'Orbitron', sans-serif",
              background: 'rgba(0,0,0,0.8)',
              color: '#00f0ff',
              boxShadow: '0 0 20px rgba(0,240,255,0.4)',
              border: '1px solid rgba(0,240,255,0.5)',
              borderRadius: '30px',
              cursor: 'pointer'
            }}
            onClick={handleCreateNew}
          >
            ✨ Хочу создать свою вселенную
          </button>
        </div>
      )}

      {/* SHARE MODAL */}
      {sharingItem && (
        <div className="share-overlay" onClick={() => setSharingItem(null)}>
          <div className="share-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setSharingItem(null)}>×</button>

            <h2>Share Universe</h2>

            <div className="share-content-wrapper">
              <div className="share-preview-wrapper">
                <img src={sharingItem.thumbnail} alt="Shared Preview" className="share-preview-img" />
              </div>

              <div className="share-details-wrapper">
                {generateMathFormula(sharingItem.params)}

                <div className="url-row-container">
                  <div className="url-label">Unique Universe Link</div>
                  <div className="url-row">
                    <div className="url-text-mask">
                      {(() => {
                        const fullUrl = generateShareLink(sharingItem.params);
                        const parts = fullUrl.split('?p=');
                        if (parts.length === 2) {
                          return `${parts[0]}?p=${parts[1].substring(0, 8)}...`;
                        }
                        return fullUrl;
                      })()}
                    </div>
                    <button className="copy-btn-icon" onClick={() => {
                      // Copy the short link if available, otherwise the full working URL
                      navigator.clipboard.writeText(shortLink || generateShareLink(sharingItem.params)).then(() => alert('Link copied to clipboard!'));
                    }}>
                      COPY
                    </button>
                  </div>
                </div>

                <div className="share-grid">
                  <button
                    className="share-btn telegram"
                    disabled={isShortening}
                    onClick={() => {
                      window.open(`https://t.me/share/url?url=${encodeURIComponent(shortLink)}`, '_blank');
                    }}
                  >
                    {!isShortening && <span>✈️</span>}
                    {isShortening ? 'Preparing...' : 'Telegram'}
                  </button>

                  <button
                    className="share-btn vk"
                    disabled={isShortening}
                    onClick={() => {
                      window.open(`https://vk.com/share.php?url=${encodeURIComponent(shortLink)}&title=${encodeURIComponent("Amuse — Посмотреть шедевр")}`, '_blank');
                    }}
                  >
                    {!isShortening && <span>💙</span>}
                    {isShortening ? 'Preparing...' : 'VK'}
                  </button>

                  <button
                    className="share-btn whatsapp"
                    disabled={isShortening}
                    onClick={() => {
                      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent("Amuse — Посмотреть шедевр: " + shortLink)}`, '_blank');
                    }}
                  >
                    {!isShortening && <span>💬</span>}
                    {isShortening ? 'Preparing...' : 'WhatsApp'}
                  </button>

                  <button
                    className="share-btn wechat"
                    disabled={isShortening}
                    onClick={() => {
                      navigator.clipboard.writeText(shortLink).then(() => alert('Link for WeChat copied! Open WeChat and paste to share.'));
                    }}
                  >
                    {!isShortening && <span>🟢</span>}
                    {isShortening ? 'Preparing...' : 'WeChat'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
