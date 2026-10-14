let context: AudioContext | undefined;
let musicTimer: number | undefined;
let musicStep = 0;
let activeTheme: BgmTheme = null;
let runningTheme: BgmTheme = null;
let musicBus: GainNode | undefined;
let delayNode: DelayNode | undefined;
let ambientSource: AudioBufferSourceNode | undefined;
let ambientLfo: OscillatorNode | undefined;

export type BgmTheme = 'home' | 'campus-river' | 'mountain-stream' | 'archive' | 'shop' | 'map' | 'story' | null;

interface MusicPattern {
  tempo: number;
  lead: number[];
  bass: number[];
  chords: number[][];
  color: number;
  water: number;
  swing: number;
}

const MUSIC: Record<NonNullable<BgmTheme>, MusicPattern> = {
  home: { tempo:305, lead:[64,0,67,71,0,67,62,0,64,67,71,74,71,0,67,0], bass:[40,0,40,0,43,0,38,0], chords:[[52,59,64],[55,62,67],[50,57,62],[55,59,64]], color:1250, water:.0012, swing:.06 },
  'campus-river': { tempo:270, lead:[67,69,74,0,71,69,67,64,67,69,76,74,71,0,69,0], bass:[43,0,45,0,40,0,38,0], chords:[[55,62,67],[57,64,69],[52,59,64],[50,57,62]], color:1550, water:.0045, swing:.08 },
  'mountain-stream': { tempo:235, lead:[76,78,81,0,78,76,74,71,74,76,81,83,81,78,76,0], bass:[45,0,42,0,47,0,43,0], chords:[[57,64,69],[54,61,66],[59,66,71],[55,62,67]], color:1850, water:.007, swing:.04 },
  archive: { tempo:340, lead:[64,0,0,67,0,71,0,69,64,0,67,0,74,0,71,0], bass:[40,0,40,0,43,0,45,0], chords:[[52,59,64],[52,57,64],[55,62,67],[57,64,69]], color:1050, water:.0007, swing:.03 },
  shop: { tempo:265, lead:[67,71,74,0,71,69,72,76,74,71,69,0,67,69,71,0], bass:[43,0,47,0,45,0,48,0], chords:[[55,62,67],[59,66,71],[57,64,69],[60,67,72]], color:1450, water:.0005, swing:.11 },
  map: { tempo:300, lead:[64,67,69,0,72,71,69,67,62,64,67,0,69,67,64,0], bass:[40,0,45,0,43,0,38,0], chords:[[52,59,64],[57,64,69],[55,62,67],[50,57,62]], color:1350, water:.001, swing:.05 },
  story: { tempo:390, lead:[64,0,67,0,69,0,67,0,62,0,64,0,67,0,0,0], bass:[40,0,0,0,43,0,0,0], chords:[[52,59,64],[55,62,67],[50,57,62],[52,57,64]], color:900, water:.0008, swing:.02 },
};

function getContext(): AudioContext {
  context ??= new AudioContext();
  if (context.state === 'suspended') void context.resume();
  return context;
}

function ensureMusicGraph(): void {
  const audio = getContext();
  if (musicBus && delayNode) return;
  musicBus = audio.createGain();
  musicBus.gain.value = .72;
  musicBus.connect(audio.destination);
  delayNode = audio.createDelay(.8);
  delayNode.delayTime.value = .23;
  const feedback = audio.createGain();
  feedback.gain.value = .18;
  const wet = audio.createGain();
  wet.gain.value = .16;
  delayNode.connect(feedback).connect(delayNode);
  delayNode.connect(wet).connect(audio.destination);
}

function frequency(midi: number): number { return 440 * 2 ** ((midi - 69) / 12); }

function playMusicNote(midi: number, duration: number, wave: OscillatorType, volume: number, color: number, delaySend = .08): void {
  if (!midi || !context || !musicBus || !delayNode) return;
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const send = context.createGain();
  oscillator.type = wave;
  oscillator.frequency.value = frequency(midi);
  filter.type = 'lowpass';
  filter.frequency.value = color;
  filter.Q.value = .7;
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + .045);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume * .42), now + duration * .48);
  gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
  send.gain.value = delaySend;
  oscillator.connect(filter).connect(gain).connect(musicBus);
  gain.connect(send).connect(delayNode);
  oscillator.start(now);
  oscillator.stop(now + duration + .04);
}

function stopAmbience(): void {
  if (ambientSource) {
    try { ambientSource.stop(); } catch { /* already stopped */ }
    ambientSource.disconnect();
  }
  if (ambientLfo) {
    try { ambientLfo.stop(); } catch { /* already stopped */ }
    ambientLfo.disconnect();
  }
  ambientSource = undefined;
  ambientLfo = undefined;
}

function startAmbience(pattern: MusicPattern): void {
  if (!context || pattern.water <= 0) return;
  stopAmbience();
  const length = context.sampleRate * 3;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let previous = 0;
  for (let index = 0; index < length; index++) {
    const white = Math.random() * 2 - 1;
    previous = previous * .985 + white * .015;
    data[index] = previous * 3.2;
  }
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const lfo = context.createOscillator();
  const lfoDepth = context.createGain();
  source.buffer = buffer;
  source.loop = true;
  filter.type = 'bandpass';
  filter.frequency.value = activeTheme === 'mountain-stream' ? 1300 : 720;
  filter.Q.value = .45;
  gain.gain.value = pattern.water;
  lfo.frequency.value = .12;
  lfoDepth.gain.value = pattern.water * .28;
  lfo.connect(lfoDepth).connect(gain.gain);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start();
  lfo.start();
  ambientSource = source;
  ambientLfo = lfo;
}

function stopMusic(): void {
  if (musicTimer !== undefined) window.clearTimeout(musicTimer);
  musicTimer = undefined;
  runningTheme = null;
  stopAmbience();
}

function startMusic(): void {
  if (!activeTheme) return;
  ensureMusicGraph();
  if (musicTimer !== undefined && runningTheme === activeTheme) return;
  stopMusic();
  musicStep = 0;
  runningTheme = activeTheme;
  const pattern = MUSIC[activeTheme];
  startAmbience(pattern);
  const tick = () => {
    if (!activeTheme || activeTheme !== runningTheme) return;
    const seconds = pattern.tempo / 1000;
    const lead = pattern.lead[musicStep % pattern.lead.length];
    const bass = pattern.bass[musicStep % pattern.bass.length];
    playMusicNote(lead, seconds * 1.55, 'triangle', .015, pattern.color, .10);
    if (bass && musicStep % 2 === 0) playMusicNote(bass, seconds * 3.25, 'sine', .012, 620, .04);
    if (musicStep % 8 === 0) {
      const chord = pattern.chords[Math.floor(musicStep / 8) % pattern.chords.length];
      chord.forEach((note, index) => playMusicNote(note, seconds * 7.2, 'sine', .0038, 720 + index * 90, .15));
    }
    const swing = musicStep % 2 === 0 ? 1 + pattern.swing : 1 - pattern.swing;
    musicStep++;
    musicTimer = window.setTimeout(tick, pattern.tempo * swing);
  };
  tick();
}

export function setBgm(theme: BgmTheme): void {
  if (activeTheme === theme && runningTheme === theme) return;
  activeTheme = theme;
  if (!theme) return stopMusic();
  if (context) startMusic();
}

export function sfx(kind: 'tap' | 'cast' | 'bite' | 'catch' | 'fail' | 'buy'): void {
  getContext();
  startMusic();
  const notes = kind === 'catch' ? [392,523,659,784] : kind === 'fail' ? [180,125] : kind === 'bite' ? [540,760] : kind === 'buy' ? [440,660] : kind === 'cast' ? [240,360] : [330];
  notes.forEach((note, index) => {
    const oscillator = context!.createOscillator();
    const gain = context!.createGain();
    const filter = context!.createBiquadFilter();
    const start = context!.currentTime + index * .08;
    oscillator.type = kind === 'catch' ? 'triangle' : 'sine';
    oscillator.frequency.value = note;
    filter.type = 'lowpass';
    filter.frequency.value = kind === 'catch' ? 2100 : 1600;
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(.055, start + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, start + .16);
    oscillator.connect(filter).connect(gain).connect(context!.destination);
    oscillator.start(start);
    oscillator.stop(start + .18);
  });
}
