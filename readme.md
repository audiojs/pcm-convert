# pcm-convert [![stable](https://img.shields.io/badge/stability-stable-green.svg)](http://github.com/badges/stability-badges)

Convert PCM audio data between formats. Zero dependencies, ESM.

## Usage

[![npm install pcm-convert](https://nodei.co/npm/pcm-convert.png?mini=true)](https://npmjs.org/package/pcm-convert/)

```js
import convert from 'pcm-convert'

// float32 → uint8
let uint8arr = convert([0, 0.1, 0.1, 0], 'float32', 'uint8')

// interleaved uint8 → planar float32
let float32arr = convert(new Uint8Array([127, 200, 127, 200]), 'uint8 stereo interleaved', 'float32 planar')

// deinterleave, same dtype
let int8arr = convert(new Int8Array([-100, 100, -100, 100]), 'interleaved', 'planar')

// endianness swap
let float32be = convert(new Float32Array([1, .5, -.5, -1]), 'le', 'be')

// object formats
let float64 = convert(float32be, {
  dtype: 'float32',
  channels: 2,
  interleaved: false,
  endianness: 'be'
}, {
  dtype: 'float64',
  interleaved: true,
  endianness: 'le'
})

// auto-detect source, convert to target
let uint16 = convert(new Uint8Array([0, 255]), 'uint16')

// write into existing container
convert(new Uint8Array([0, 255]), new Uint16Array(2))

// full arguments
let uint16arr = convert([0, 0, 1, 1], 'float32 le stereo planar', 'uint16 interleaved be', new Uint16Array(4))
```

## API

### convert(src, srcFormat?, dstFormat?, dst?)

Convert `src` from `srcFormat` to `dstFormat`. Format can be a string with space-separated tags or an object. If `srcFormat` is omitted, it is detected from `src`. If `dst` container is provided, result is written into it.

#### Source types

| Type | Dtype |
|---|---|
| `Array` | float range (−1..1) |
| `Float32Array` | `float32` |
| `Float64Array` | `float64` |
| `ArrayBuffer` | `uint8` |
| `Buffer` | `uint8` |
| `Uint8Array` | `uint8` |
| `Uint8ClampedArray` | `uint8` |
| `Uint16Array` | `uint16` |
| `Uint32Array` | `uint32` |
| `Int8Array` | `int8` |
| `Int16Array` | `int16` |
| `Int32Array` | `int32` |
| `AudioBuffer` | `float32` (planar) |

#### Format

String: `'uint8 interleaved stereo le'`, `'float64 planar quad'` — tokens in any order, all optional.

Object:

| Property | Values |
|---|---|
| `dtype` | `uint8`, `uint16`, `uint32`, `int8`, `int16`, `int32`, `float32`, `float64` |
| `interleaved` | `true` (interleaved) or `false` (planar) |
| `channels` | Number, or string: `mono`, `stereo`, `quad`, `5.1` |
| `endianness` | `le` or `be` |

Container tokens for output: `array`, `arraybuffer`, `buffer`.

## License

MIT

<p align=center><a href="https://github.com/krishnized/license/">ॐ</a></p>
