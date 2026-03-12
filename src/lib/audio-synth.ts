const ctx = () => new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

type SynthFn = (audioCtx: AudioContext, duration: number) => AudioBuffer;

const noise = (audioCtx: AudioContext, dur: number): AudioBuffer => {
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
};

const synthMap: Record<string, SynthFn> = {
  'Свуш вверх': (ac, dur) => {
    const len = ac.sampleRate * dur;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const freq = 200 + t * 2000;
      const env = Math.sin(t * Math.PI);
      d[i] = Math.sin(2 * Math.PI * freq * (i / ac.sampleRate)) * env * 0.4
           + (Math.random() * 2 - 1) * env * 0.15;
    }
    return buf;
  },

  'Свуш вниз': (ac, dur) => {
    const len = ac.sampleRate * dur;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const freq = 2200 - t * 2000;
      const env = Math.sin(t * Math.PI);
      d[i] = Math.sin(2 * Math.PI * freq * (i / ac.sampleRate)) * env * 0.4
           + (Math.random() * 2 - 1) * env * 0.15;
    }
    return buf;
  },

  'Удар': (ac, dur) => {
    const len = ac.sampleRate * dur;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.exp(-t * 12);
      const freq = 80 * Math.exp(-t * 4);
      d[i] = Math.sin(2 * Math.PI * freq * (i / ac.sampleRate)) * env * 0.7
           + (Math.random() * 2 - 1) * Math.exp(-t * 20) * 0.5;
    }
    return buf;
  },

  'Переход звука': (ac, dur) => {
    const len = ac.sampleRate * dur;
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    const dL = buf.getChannelData(0);
    const dR = buf.getChannelData(1);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.sin(t * Math.PI);
      const freq = 300 + Math.sin(t * Math.PI * 4) * 200;
      const s = Math.sin(2 * Math.PI * freq * (i / ac.sampleRate)) * env * 0.3;
      const n = (Math.random() * 2 - 1) * env * 0.1;
      dL[i] = s + n;
      dR[i] = Math.sin(2 * Math.PI * (freq + 50) * (i / ac.sampleRate)) * env * 0.3 + n;
    }
    return buf;
  },

  'Клик кнопки': (ac, dur) => {
    const len = ac.sampleRate * dur;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.exp(-t * 30);
      d[i] = Math.sin(2 * Math.PI * 1200 * (i / ac.sampleRate)) * env * 0.5
           + Math.sin(2 * Math.PI * 2400 * (i / ac.sampleRate)) * env * 0.2
           + (Math.random() * 2 - 1) * Math.exp(-t * 50) * 0.3;
    }
    return buf;
  },

  'Нотификация': (ac, dur) => {
    const len = ac.sampleRate * dur;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    const notes = [880, 1108.73, 1318.51];
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const noteIdx = Math.min(Math.floor(t * notes.length), notes.length - 1);
      const localT = (t * notes.length) - noteIdx;
      const env = Math.sin(localT * Math.PI) * (1 - t * 0.5);
      d[i] = Math.sin(2 * Math.PI * notes[noteIdx] * (i / ac.sampleRate)) * env * 0.3
           + Math.sin(2 * Math.PI * notes[noteIdx] * 2 * (i / ac.sampleRate)) * env * 0.1;
    }
    return buf;
  },

  'Корпоративный фон': (ac, dur) => {
    const len = ac.sampleRate * dur;
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    const dL = buf.getChannelData(0);
    const dR = buf.getChannelData(1);
    const chords = [
      [261.63, 329.63, 392.00],
      [293.66, 369.99, 440.00],
      [329.63, 415.30, 493.88],
      [261.63, 329.63, 392.00],
    ];
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const sec = (i / ac.sampleRate);
      const chordIdx = Math.floor(sec / 2) % chords.length;
      const chord = chords[chordIdx];
      const env = 0.15 * (1 - Math.abs(2 * ((sec % 2) / 2) - 1) * 0.3);
      let sL = 0, sR = 0;
      for (const f of chord) {
        sL += Math.sin(2 * Math.PI * f * sec) * env;
        sR += Math.sin(2 * Math.PI * (f * 1.002) * sec) * env;
      }
      const pad = Math.sin(2 * Math.PI * 130.81 * sec) * 0.08;
      const fade = Math.min(t * 10, 1) * Math.min((1 - t) * 10, 1);
      dL[i] = (sL + pad) * fade;
      dR[i] = (sR + pad) * fade;
    }
    return buf;
  },

  'Эпик оркестр': (ac, dur) => {
    const len = ac.sampleRate * dur;
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    const dL = buf.getChannelData(0);
    const dR = buf.getChannelData(1);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const sec = i / ac.sampleRate;
      const buildup = Math.min(t * 3, 1);
      const fade = Math.min(t * 5, 1) * Math.min((1 - t) * 5, 1);
      const bass = Math.sin(2 * Math.PI * 65.41 * sec) * 0.2 * buildup;
      const str1 = Math.sin(2 * Math.PI * 196 * sec) * 0.12 * buildup;
      const str2 = Math.sin(2 * Math.PI * 246.94 * sec) * 0.1 * buildup;
      const str3 = Math.sin(2 * Math.PI * 329.63 * sec) * 0.08 * buildup;
      const brass = Math.sin(2 * Math.PI * 392 * sec + Math.sin(sec * 5) * 0.5) * 0.06 * buildup * buildup;
      const perc = (Math.random() * 2 - 1) * 0.02 * buildup;
      const timpani = Math.sin(2 * Math.PI * 98 * sec) * Math.max(0, Math.exp(-((sec % 2) * 5))) * 0.15;
      const sum = (bass + str1 + str2 + str3 + brass + perc + timpani) * fade;
      dL[i] = sum;
      dR[i] = sum * 0.95 + Math.sin(2 * Math.PI * 200 * sec) * 0.02 * buildup;
    }
    return buf;
  },

  'Лёгкий поп': (ac, dur) => {
    const len = ac.sampleRate * dur;
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    const dL = buf.getChannelData(0);
    const dR = buf.getChannelData(1);
    const bpm = 120;
    const beatLen = 60 / bpm;
    for (let i = 0; i < len; i++) {
      const sec = i / ac.sampleRate;
      const t = i / len;
      const beat = sec % beatLen;
      const kick = Math.sin(2 * Math.PI * 60 * sec) * Math.exp(-beat / beatLen * 10) * 0.3;
      const hihat = (Math.random() * 2 - 1) * Math.exp(-(beat % (beatLen / 2)) * 30) * 0.08;
      const snare = (sec % (beatLen * 2)) > beatLen
        ? (Math.random() * 2 - 1) * Math.exp(-((sec % (beatLen * 2)) - beatLen) * 15) * 0.15
        : 0;
      const notes = [261.63, 329.63, 392, 440];
      const noteIdx = Math.floor(sec / beatLen) % notes.length;
      const synth = Math.sin(2 * Math.PI * notes[noteIdx] * sec) * 0.1;
      const fade = Math.min(t * 5, 1) * Math.min((1 - t) * 5, 1);
      dL[i] = (kick + hihat + snare + synth) * fade;
      dR[i] = (kick + hihat * 0.7 + snare + synth * 0.9) * fade;
    }
    return buf;
  },

  'Акустическая гитара': (ac, dur) => {
    const len = ac.sampleRate * dur;
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    const dL = buf.getChannelData(0);
    const dR = buf.getChannelData(1);
    const notes = [329.63, 293.66, 261.63, 293.66, 329.63, 329.63, 329.63];
    const noteLen = dur / notes.length;
    for (let i = 0; i < len; i++) {
      const sec = i / ac.sampleRate;
      const t = i / len;
      const noteIdx = Math.min(Math.floor(sec / noteLen), notes.length - 1);
      const localSec = sec - noteIdx * noteLen;
      const env = Math.exp(-localSec * 3) * 0.3;
      const f = notes[noteIdx];
      const s = Math.sin(2 * Math.PI * f * sec) * env
              + Math.sin(2 * Math.PI * f * 2 * sec) * env * 0.4
              + Math.sin(2 * Math.PI * f * 3 * sec) * env * 0.15
              + Math.sin(2 * Math.PI * f * 4 * sec) * env * 0.06;
      const fade = Math.min(t * 5, 1) * Math.min((1 - t) * 5, 1);
      dL[i] = s * fade;
      dR[i] = s * fade * 0.95;
    }
    return buf;
  },

  'Электронный бит': (ac, dur) => {
    const len = ac.sampleRate * dur;
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    const dL = buf.getChannelData(0);
    const dR = buf.getChannelData(1);
    const bpm = 140;
    const beatLen = 60 / bpm;
    for (let i = 0; i < len; i++) {
      const sec = i / ac.sampleRate;
      const t = i / len;
      const beat = sec % beatLen;
      const kick = Math.sin(2 * Math.PI * 55 * sec * (1 + Math.exp(-beat * 20))) * Math.exp(-beat * 8) * 0.35;
      const sub = Math.sin(2 * Math.PI * 55 * sec) * 0.1;
      const hihat = (Math.random() * 2 - 1) * Math.exp(-(beat % (beatLen / 4)) * 50) * 0.06;
      const clap = (sec % (beatLen * 2)) > beatLen
        ? (Math.random() * 2 - 1) * Math.exp(-((sec % (beatLen * 2)) - beatLen) * 20) * 0.12
        : 0;
      const wobble = Math.sin(2 * Math.PI * (110 + Math.sin(sec * 3) * 30) * sec) * 0.08;
      const fade = Math.min(t * 5, 1) * Math.min((1 - t) * 5, 1);
      dL[i] = (kick + sub + hihat + clap + wobble) * fade;
      dR[i] = (kick + sub + hihat * 0.6 + clap + wobble * 0.8) * fade;
    }
    return buf;
  },

  'Пианино соло': (ac, dur) => {
    const len = ac.sampleRate * dur;
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    const dL = buf.getChannelData(0);
    const dR = buf.getChannelData(1);
    const melody = [261.63, 293.66, 329.63, 349.23, 392, 349.23, 329.63, 293.66,
                    261.63, 246.94, 220, 246.94, 261.63, 329.63, 392, 523.25];
    const noteLen = dur / melody.length;
    for (let i = 0; i < len; i++) {
      const sec = i / ac.sampleRate;
      const t = i / len;
      const noteIdx = Math.min(Math.floor(sec / noteLen), melody.length - 1);
      const localSec = sec - noteIdx * noteLen;
      const env = Math.exp(-localSec * 2) * 0.25;
      const f = melody[noteIdx];
      const s = Math.sin(2 * Math.PI * f * sec) * env
              + Math.sin(2 * Math.PI * f * 2 * sec) * env * 0.5
              + Math.sin(2 * Math.PI * f * 3 * sec) * env * 0.2
              + Math.sin(2 * Math.PI * f * 5 * sec) * env * 0.05;
      const fade = Math.min(t * 5, 1) * Math.min((1 - t) * 5, 1);
      dL[i] = s * fade;
      dR[i] = s * fade * 0.97 + Math.sin(2 * Math.PI * f * 1.001 * sec) * env * 0.03 * fade;
    }
    return buf;
  },
};

function bufferToWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = len * blockAlign;
  const headerSize = 44;
  const ab = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(ab);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numCh; ch++) channels.push(buffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([ab], { type: 'audio/wav' });
}

const audioCache = new Map<string, string>();

export function generateAudio(name: string, duration: number): string | null {
  const key = `${name}_${duration}`;
  if (audioCache.has(key)) return audioCache.get(key)!;

  const synthFn = synthMap[name];
  if (!synthFn) return null;

  try {
    const audioCtx = ctx();
    const buffer = synthFn(audioCtx, duration);
    const wav = bufferToWav(buffer);
    const url = URL.createObjectURL(wav);
    audioCache.set(key, url);
    audioCtx.close();
    return url;
  } catch {
    return null;
  }
}

export function getAvailableSounds(): string[] {
  return Object.keys(synthMap);
}

export default generateAudio;
