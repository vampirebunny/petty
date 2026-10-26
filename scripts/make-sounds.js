// Renders the bark and the meow into WAV files.
// Run: node scripts/make-sounds.js
// Each clip is an oscillator, a biquad filter, and a gain envelope, recorded offline so the app
// can play a clip and change its pitch with the
// playback rate (breed pitch times the age factor, with pitch correction off).
const fs = require('fs');
const path = require('path');

const rate = 44100;

// Web Audio style automation: a list of [time, value, 'set' | 'lin' | 'exp'] events.
function automation(events) {
  return (t) => {
    let from = events[0];
    for (let i = 1; i < events.length; i += 1) {
      const to = events[i];
      if (t < to[0]) {
        const k = (t - from[0]) / (to[0] - from[0]);
        return to[2] === 'exp' ? from[1] * Math.pow(to[1] / from[1], k) : from[1] + (to[1] - from[1]) * k;
      }
      from = to;
    }
    return from[1];
  };
}

function biquad(type, q) {
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  return (input, freq) => {
    const w = (2 * Math.PI * Math.min(freq, rate * 0.45)) / rate;
    const alpha = Math.sin(w) / (2 * q);
    const cos = Math.cos(w);
    let b0;
    let b1;
    let b2;
    if (type === 'lowpass') {
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = (1 - cos) / 2;
    } else {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    }
    const a0 = 1 + alpha;
    const a1 = (-2 * cos) / a0;
    const a2 = (1 - alpha) / a0;
    const y = (b0 / a0) * input + (b1 / a0) * x1 + (b2 / a0) * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = input;
    y2 = y1;
    y1 = y;
    return y;
  };
}

function render(seconds, freqAt, filter, filterAt, gainAt) {
  const total = Math.ceil(seconds * rate);
  const out = new Float32Array(total);
  let phase = 0;
  for (let i = 0; i < total; i += 1) {
    const t = i / rate;
    phase = (phase + freqAt(t) / rate) % 1;
    const saw = 2 * phase - 1;
    out[i] = filter(saw, filterAt(t)) * gainAt(t);
  }
  return out;
}

function wav(samples) {
  let peak = 0;
  for (const s of samples) {
    peak = Math.max(peak, Math.abs(s));
  }
  const gain = peak > 0 ? 0.8 / peak : 1;
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s * gain)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// Dog bark at breed pitch 1 and full growth factor 1: base 210 Hz, 0.22 s.
const bark = (() => {
  const base = 210;
  return render(
    0.22,
    automation([
      [0, base * 1.5, 'set'],
      [0.16, base * 0.8, 'exp'],
    ]),
    biquad('lowpass', 1),
    () => 900,
    automation([
      [0, 0.0001, 'set'],
      [0.02, 0.3, 'exp'],
      [0.2, 0.0001, 'exp'],
    ]),
  );
})();

// Cat meow at breed pitch 1.5 and growth factor 1: base 330 * 1.5 Hz, 0.62 s.
const meow = (() => {
  const base = 330 * 1.5;
  return render(
    0.62,
    automation([
      [0, base * 0.9, 'set'],
      [0.2, base * 1.3, 'lin'],
      [0.55, base * 0.8, 'lin'],
    ]),
    biquad('bandpass', 1.2),
    automation([
      [0, 900, 'set'],
      [0.25, 1700, 'lin'],
      [0.55, 1000, 'lin'],
    ]),
    automation([
      [0, 0.0001, 'set'],
      [0.06, 0.5, 'exp'],
      [0.6, 0.0001, 'exp'],
    ]),
  );
})();

const dir = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'bark.wav'), wav(bark));
fs.writeFileSync(path.join(dir, 'meow.wav'), wav(meow));
console.log('wrote bark.wav and meow.wav to assets/sounds');
