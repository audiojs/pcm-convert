# pcm-convert [![stable](https://img.shields.io/badge/stability-stable-green.svg)](http://github.com/badges/stability-badges)

Convert PCM audio data between formats.

## Usage

[![npm install pcm-convert](https://nodei.co/npm/pcm-convert.png?mini=true)](https://npmjs.org/package/pcm-convert/)

```js
import convert from 'pcm-convert'

// float32 → int16
convert(new Float32Array([1, -1, 0.5]), 'int16')

// interleaved uint8 → planar float32
convert(new Uint8Array([127, 200, 127, 200]), 'uint8 stereo interleaved', 'float32 planar')

// endianness swap
convert(new Float32Array([1, .5, -.5, -1]), 'le', 'be')

// planar channel arrays → interleaved PCM (replaces pcm-encode)
let left = new Float32Array([1, 0, -1])
let right = new Float32Array([0, 0.5, -0.5])
convert([left, right], 'int16 interleaved le')

// AudioBuffer → int16
convert(audioBuffer, 'int16 interleaved')

// auto-detect source, convert to target
convert(new Uint8Array([0, 255]), 'uint16')

// write into existing container
convert(new Uint8Array([0, 255]), new Uint16Array(2))

// object formats
convert(data, { dtype: 'float32', channels: 2, interleaved: false }, { dtype: 'int16', interleaved: true })
```

### parse, detect, stringify, sampleRate

```js
import { parse, stringify, detect, sampleRate } from 'pcm-convert'

parse('float32 stereo planar 44100')
// → { dtype: 'float32', channels: 2, interleaved: false, sampleRate: 44100 }

stringify({ dtype: 'float32', channels: 2, interleaved: false })
// → 'float32 stereo planar'

detect(new Float32Array(4))
// → { dtype: 'float32' }

detect([new Float32Array(4), new Float32Array(4)])
// → { dtype: 'float32', channels: 2, interleaved: false }

sampleRate
// → [8000, 11025, 16000, 22050, 44100, 48000, ..., 384000]
```

## API

### convert(src, srcFormat?, dstFormat?, dst?)

Convert `src` from `srcFormat` to `dstFormat`. If `srcFormat` is omitted, it is detected from `src`. If `dst` container is provided, result is written into it.

#### Source types

| Type | Dtype |
|---|---|
| `Float32Array` | `float32` |
| `Float64Array` | `float64` |
| `Int8/16/32Array` | `int8/16/32` |
| `Uint8/16/32Array` | `uint8/16/32` |
| `Array` | float range (-1..1) |
| `Float32Array[]` | planar channels |
| `AudioBuffer` | `float32` planar |
| `ArrayBuffer` | `uint8` |
| `Buffer` | `uint8` |

#### Format

String: space-separated tokens in any order (commas, semicolons, underscores also accepted). Object: same fields as properties. Aliases in parentheses are object-only.

| Field | Values |
|---|---|
| `dtype` (`type`) | `float32`, `float64`, `float`, `int8`, `int16`, `int32`, `int`, `uint8`, `uint16`, `uint32`, `uint` |
| `channels` (`numberOfChannels`) | `mono`, `stereo`, `quad`, `2.1`, `5.1`, `N-channel`, or number |
| `interleaved` | `interleaved`, `interleave`, `planar` (or boolean) |
| `endianness` | `le`, `be`, `littleendian`, `bigendian` |
| `sampleRate` (`rate`) | `8000`, `11025`, `16000`, `22050`, `44100`, `48000`, `88200`, `96000`, `176400`, `192000`, `352800`, `384000` (or number) |
| `container` | `array`, `arraybuffer`, `buffer` |

## Absorbs

v3 consolidates these packages:

- [audio-format](https://npmjs.org/package/audio-format) → `parse`, `detect`, `stringify`
- [sample-rate](https://npmjs.org/package/sample-rate) → `sampleRate`
- `pcm-encode` (from web-audio-api) → `convert([...channels], format)`

## License

MIT

<p align=center><a href="https://github.com/krishnized/license/">ॐ</a></p>
