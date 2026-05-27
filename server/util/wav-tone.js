/**
 * Generate a warm ambient pad WAV buffer as fallback audio.
 * Uses multiple sine waves forming pleasant chords with slow modulation,
 * so it sounds like background music rather than a test tone.
 */
function generateWavTone(frequency = 220, duration = 30, sampleRate = 44100) {
  const numSamples = sampleRate * duration
  const dataSize = numSamples * 2
  const buffer = Buffer.alloc(44 + dataSize)

  // RIFF header
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)

  // fmt chunk
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)

  // data chunk
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  // Ambient chord: multiple harmonics at different amplitudes for a warm pad sound
  // C major 7th chord voices spread across octaves
  const voices = [
    { freq: 261.63, amp: 0.25 },  // C4
    { freq: 329.63, amp: 0.20 },  // E4
    { freq: 392.00, amp: 0.18 },  // G4
    { freq: 493.88, amp: 0.12 },  // B4
    { freq: 523.25, amp: 0.08 },  // C5 (octave)
    { freq: 196.00, amp: 0.15 },  // G3 (bass)
  ]

  // Secondary chord Am7 (for slow progression)
  const voices2 = [
    { freq: 220.00, amp: 0.25 },  // A3
    { freq: 261.63, amp: 0.20 },  // C4
    { freq: 329.63, amp: 0.18 },  // E4
    { freq: 440.00, amp: 0.12 },  // A4
    { freq: 523.25, amp: 0.08 },  // C5
    { freq: 110.00, amp: 0.15 },  // A2 (bass)
  ]

  const fadeLen = Math.min(sampleRate / 2, Math.floor(numSamples * 0.03))
  const progressionLen = sampleRate * 8 // switch chords every 8 seconds

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate
    const chordSet = (Math.floor(i / progressionLen) % 2 === 0) ? voices : voices2

    let sample = 0
    for (const v of chordSet) {
      // Add slow vibrato for warmth
      const vibrato = 1 + 0.003 * Math.sin(2 * Math.PI * 0.3 * t + v.freq * 0.01)
      sample += Math.sin(2 * Math.PI * v.freq * vibrato * t) * v.amp
    }

    // Apply fade in
    if (i < fadeLen) sample *= (i / fadeLen)
    // Apply fade out
    if (i > numSamples - fadeLen) sample *= ((numSamples - i) / fadeLen)

    // Soft clip to prevent harshness
    sample = Math.tanh(sample * 1.5) / 1.5

    buffer.writeInt16LE(Math.round(sample * 8192), 44 + i * 2)
  }

  return buffer
}

module.exports = { generateWavTone }
