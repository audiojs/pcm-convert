# pcm-convert [![stable](https://img.shields.io/badge/stability-stable-green.svg)](http://github.com/badges/stability-badges)

Convert PCM audio data between formats — dtype, layout, endianness, container, and sample rate (polyphase FIR anti-aliased resampling via [`@audio/resample-polyphase`](https://github.com/audiojs/resample)). ESM.

[![npm install pcm-convert](https://nodei.co/npm/pcm-convert.png?mini=true)](https://npmjs.org/package/pcm-convert/)

```js
import convert, { parse, detect, stringify, sampleRate } from 'pcm-convert'

// dtype conversion
convert(new Float32Array([1, -1, 0.5]), 'int16')

// sample-rate conversion (rates on both sides → resampled, anti-aliased)
convert(samples, 'float32 44100', 'float32 48000')
convert(samples, 'int16 stereo interleaved 48000', 'float32 16000')  // the 48k → 16k voice-agent path

// interleaved → planar, dtype change
convert(new Uint8Array([127, 200, 127, 200]), 'uint8 stereo interleaved', 'float32 planar')

// endianness swap
convert(new Float32Array([1, .5, -.5, -1]), 'le', 'be')

// planar channel arrays → interleaved (replaces pcm-encode)
convert([new Float32Array([1, 0, -1]), new Float32Array([0, 0.5, -0.5])], 'int16 interleaved')

// AudioBuffer input (auto-detected)
convert(audioBuffer, 'int16 interleaved')

// any format → AudioBuffer (browser-native; Node.js auto-discovers audio-buffer package if installed)
convert(new Int16Array([...]), { dtype: 'int16', channels: 2, interleaved: true, sampleRate: 44100 }, 'audiobuffer')

// no AudioBuffer global and no synchronous require (a browser worker, Node before 20.19 / 22.12): the
// audio-buffer package loads in the background; await it before the first conversion to 'audiobuffer'
import { ready } from 'pcm-convert'
await ready

// write into existing buffer
convert(new Uint8Array([0, 255]), new Uint16Array(2))

// object format
convert(data, { dtype: 'float32', channels: 2, interleaved: false }, { dtype: 'int16', interleaved: true })

// format utilities
parse('float32 stereo planar 44100')  // → { dtype: 'float32', channels: 2, interleaved: false, sampleRate: 44100 }
stringify({ dtype: 'float32', channels: 2, interleaved: false })  // → 'float32 stereo planar'
detect(new Int16Array(4))  // → { dtype: 'int16' }
detect([new Float32Array(4), new Float32Array(4)])  // → { dtype: 'float32', channels: 2, interleaved: false }
```

## API

### `convert(src, from?, to?, dst?)`

Converts `src` from format `from` to format `to`. If `from` is omitted, it is detected from `src`. If `dst` is provided, result is written into it.

**Source types**: `Float32Array`, `Float64Array`, `Int8/16/32Array`, `Uint8/16/32Array`, `Array` (float -1..1), `Float32Array[]` (planar channels), `AudioBuffer` (Web Audio API), `ArrayBuffer`, `Buffer` (Node.js).

### Format

String (`'float32 stereo planar 44100'`) or object (`{ dtype, channels, interleaved, endianness, sampleRate, container }`). Tokens in any order; commas, semicolons, underscores accepted as separators.

| Field | Tokens / values |
|---|---|
| `dtype` | `float32`, `float64`, `float`, `int8`, `int16`, `int32`, `int`, `uint8`, `uint16`, `uint32`, `uint` |
| `channels` | `mono`, `stereo`, `quad`, `2.1`, `5.1`, `N-channel` — or any number in object format |
| `interleaved` | `interleaved`, `planar` — or boolean in object format |
| `endianness` | `le`, `be` |
| `sampleRate` | `8000` `11025` `16000` `22050` `44100` `48000` `88200` `96000` `176400` `192000` `352800` `384000` — or any number in object format |
| `container` | `array`, `arraybuffer`, `buffer` (Node.js), `audiobuffer` |

In string format, bare numbers are matched against the sample rate whitelist. Use `N-channel` for arbitrary channel counts.

When both `from.sampleRate` and `to.sampleRate` are present and differ, samples are resampled — rational polyphase FIR (Kaiser-windowed, ~85 dB stopband), output length `round(n · to/from)`. Equal or absent rates pass through untouched. `AudioBuffer` sources carry their own rate, so `convert(audioBuffer, 'audiobuffer 48000')` resamples and stamps the target rate.

Object aliases: `type` → `dtype`, `numberOfChannels` → `channels`, `rate` → `sampleRate`.

### `parse(fmt)` → descriptor  •  `detect(data)` → descriptor  •  `stringify(descriptor, omit?)` → string

### `sampleRate` — standard sample rates array

## Absorbs

- [audio-format](https://npmjs.org/package/audio-format) → `parse`, `detect`, `stringify`
- [sample-rate](https://npmjs.org/package/sample-rate) → `sampleRate`
- pcm-encode → `convert([...channels], format)`

## License

MIT

<p align=center><a href="https://github.com/krishnized/license/">ॐ</a></p>
