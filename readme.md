# pcm-convert [![unstable](https://img.shields.io/badge/stability-unstable-green.svg)](http://github.com/badges/stability-badges) [![Build Status](https://img.shields.io/travis/audiojs/pcm-convert.svg)](https://travis-ci.org/audiojs/pcm-convert)

Convert data from one pcm-format to another.

## Usage

[![npm install pcm-convert](https://nodei.co/npm/pcm-convert.png?mini=true)](https://npmjs.org/package/pcm-convert/)

```js
const convert = require('pcm-convert')

//convert data from float32 to uint8 array
let uint8arr = convert([0, 0.1, 0.1, 0], 'float32 mono', 'uint8')

//convert interleaved uint8 to planar float32 array
let float32arr = convert(new Uint8Array([127, 200, 127, 200]),
  {
    interleaved: true,
    channels: 2
  },
  'float32 planar')
```

## API

### convert(src, srcFormat, dstFormat='float32 planar')

Takes data in `src` container and converts from `srcFormat` to `dstFormat`. Format can be whether a string with markers or an object with properties.

#### Source

Source format is inferred from `source` data type, and extended with `srcFormat` properties. By default source is considered to have `planar mono le` properties.

| Type | Dtype |
|---|---|
| `Array` | `float32` |
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

#### Format

Format can be defined as `dtype` string with markers, eg. `'uint8 interleaved mono le'`, or `'float64 planar quad'` (markers can be skipped), or an object with the following properties:

| Property | Meaning |
|---|---|
| `dtype` | [Dtype](https://github.com/shama/dtype) string: `uint8`, `uint16`, `uint32`, `int8`, `int16`, `int32`, `float32`, `float64`, `array` (only for `dstFormat`).  |
| `interleaved` | Whether data has `interleaved` or `planar` layout. |
| `channels` | Number of channels in source, cannot be changed. Can be `mono`, `stereo`, `quad`, `5.1` or a number. |
| `endianness` | `be` or `le`, defaults to OS endianness. |

## Related

* [audio-oscillator](https://github.com/audiojs/audio-oscillator)
* [createPeriodicWave](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createPeriodicWave)
* [List of periodic functions](https://en.wikipedia.org/wiki/List_of_periodic_functions)

## Credits

© 2017 Dima Yv. MIT License
