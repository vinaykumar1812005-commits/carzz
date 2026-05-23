// Web Audio API engine sound generator
class CarzzAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.engineGain = null;
    
    this.windNode = null;
    this.windFilter = null;
    this.windGain = null;

    this.brakeOsc = null;
    this.brakeGain = null;
    
    this.isStarted = false;
    this.targetRPM = 0.1; // idle
    this.currentRPM = 0.1;
    this.volume = 0.5; // default volume
  }

  init() {
    if (this.ctx) return;
    
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn("Web Audio API not supported");
      return;
    }
    
    this.ctx = new AudioContextClass();
    
    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);
    
    this.setupEngine();
    this.setupWind();
    this.setupBrake();
  }

  setupEngine() {
    // Engine low-pass filter
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 150;
    this.engineFilter.Q.value = 3;
    
    // Engine Volume
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    
    // Oscillators
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 35; // idle frequency
    
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.value = 17.5; // sub octave

    // Connection
    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc1.start(0);
    this.engineOsc2.start(0);
  }

  setupWind() {
    // Generate white noise for wind simulation
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 400;
    this.windFilter.Q.value = 1.0;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.02; // very quiet at start

    whiteNoise.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    
    whiteNoise.start(0);
    this.windNode = whiteNoise;
  }

  setupBrake() {
    this.brakeGain = this.ctx.createGain();
    this.brakeGain.gain.value = 0;

    this.brakeOsc = this.ctx.createOscillator();
    this.brakeOsc.type = 'sine';
    this.brakeOsc.frequency.value = 2400; // High squeal

    // Add a tiny filter to make it sound slightly metallic/gritty
    const brakeFilter = this.ctx.createBiquadFilter();
    brakeFilter.type = 'peaking';
    brakeFilter.frequency.value = 2400;
    brakeFilter.Q.value = 10;
    brakeFilter.gain.value = 10;

    this.brakeOsc.connect(brakeFilter);
    brakeFilter.connect(this.brakeGain);
    this.brakeGain.connect(this.masterGain);

    this.brakeOsc.start(0);
  }

  startEngine() {
    this.init();
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    
    if (this.isStarted) return;
    this.isStarted = true;

    // Ignition sound effect
    const now = this.ctx.currentTime;
    
    // Engine starter rev
    this.engineGain.gain.cancelScheduledValues(now);
    this.engineGain.gain.setValueAtTime(0, now);
    this.engineGain.gain.linearRampToValueAtTime(0.6, now + 0.1);
    this.engineGain.gain.exponentialRampToValueAtTime(0.25, now + 0.8);

    this.engineOsc1.frequency.cancelScheduledValues(now);
    this.engineOsc1.frequency.setValueAtTime(20, now);
    this.engineOsc1.frequency.exponentialRampToValueAtTime(140, now + 0.2);
    this.engineOsc1.frequency.exponentialRampToValueAtTime(35, now + 0.8);

    this.engineOsc2.frequency.cancelScheduledValues(now);
    this.engineOsc2.frequency.setValueAtTime(10, now);
    this.engineOsc2.frequency.exponentialRampToValueAtTime(70, now + 0.2);
    this.engineOsc2.frequency.exponentialRampToValueAtTime(17.5, now + 0.8);

    this.engineFilter.frequency.cancelScheduledValues(now);
    this.engineFilter.frequency.setValueAtTime(80, now);
    this.engineFilter.frequency.exponentialRampToValueAtTime(450, now + 0.25);
    this.engineFilter.frequency.exponentialRampToValueAtTime(150, now + 0.8);
  }

  stopEngine() {
    if (!this.isStarted) return;
    this.isStarted = false;
    
    const now = this.ctx.currentTime;
    
    // Wind down
    this.engineGain.gain.cancelScheduledValues(now);
    this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, now);
    this.engineGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    this.engineOsc1.frequency.cancelScheduledValues(now);
    this.engineOsc1.frequency.exponentialRampToValueAtTime(10, now + 0.8);

    this.engineOsc2.frequency.cancelScheduledValues(now);
    this.engineOsc2.frequency.exponentialRampToValueAtTime(5, now + 0.8);
    
    this.windGain.gain.cancelScheduledValues(now);
    this.windGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  }

  setVolume(vol) {
    this.volume = vol;
    if (this.masterGain) {
      this.masterGain.gain.value = vol;
    }
  }

  update(speed, throttle, brake) {
    if (!this.isStarted || !this.ctx) return;

    // Target RPM is calculated based on throttle, speed, and whether it's braking
    if (brake > 0) {
      this.targetRPM = 0.08; // engine drops below idle slightly during hard braking
    } else {
      this.targetRPM = 0.1 + (throttle * 0.45) + (speed * 0.45);
    }

    // Smooth RPM adjustments (inertia)
    this.currentRPM += (this.targetRPM - this.currentRPM) * 0.12;

    const baseFreq = 30 + this.currentRPM * 150;
    const now = this.ctx.currentTime;

    // Engine oscillators pitch update
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);

    // Dynamic lowpass filter cutoff frequency based on RPM
    const filterFreq = 120 + this.currentRPM * 800 + (throttle * 300);
    this.engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.05);

    // Adjust engine noise level dynamically
    const gainVal = 0.18 + (this.currentRPM * 0.16) + (throttle * 0.1);
    this.engineGain.gain.setTargetAtTime(gainVal, now, 0.08);

    // Wind Sound simulation based on car speed
    if (this.windFilter && this.windGain) {
      const windFreq = 200 + (speed * 800);
      const windVol = 0.005 + (speed * 0.08);
      this.windFilter.frequency.setTargetAtTime(windFreq, now, 0.1);
      this.windGain.gain.setTargetAtTime(windVol, now, 0.15);
    }

    // Brake squeal sound simulation
    if (this.brakeOsc && this.brakeGain) {
      if (brake > 0.1 && speed > 0.1) {
        const squealVol = Math.min(0.04, brake * speed * 0.08);
        this.brakeGain.gain.setTargetAtTime(squealVol, now, 0.05);
        // Slightly wobble squeal pitch
        this.brakeOsc.frequency.setValueAtTime(2400 + Math.sin(this.ctx.currentTime * 50) * 80, now);
      } else {
        this.brakeGain.gain.setTargetAtTime(0, now, 0.1);
      }
    }
  }
}

// Export single instance globally
window.carzzAudio = new CarzzAudioEngine();
