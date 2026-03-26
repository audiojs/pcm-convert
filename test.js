import { test } from 'node:test'
import assert from 'node:assert'
import convert, { parse, detect, stringify, sampleRate } from './index.js'
import AudioBuffer from 'audio-buffer'

const eq = (a, b) => assert.deepStrictEqual([...a], b)

// === Existing convert tests ===

test('float32 LE → int16 BE', () => {
	let buf = Buffer.alloc(8)
	buf.writeFloatLE(1.0, 0)
	buf.writeFloatLE(-0.5, 4)

	let out = convert(buf, 'float32 le', 'int16 be')
	let raw = Buffer.from(out.buffer)

	assert.equal(raw.readInt16BE(0), 32767)
	assert.equal(raw.readInt16BE(2), -16384)
})

test('endianness swap', () => {
	let out = convert(new Float32Array([1, -0.5]), 'float32 le', 'be')
	let raw = Buffer.from(out.buffer)

	assert.equal(raw.readFloatBE(0), 1.0)
	assert.equal(raw.readFloatBE(4), -0.5)
})

test('format string markers', () => {
	let out = convert(new Uint8Array([0, 255, 255, 0, 0, 255]), 'interleaved', 'float32 planar')
	eq(out, [-1, 1, -1, 1, -1, 1])
})

test('unknown token throws', () => {
	assert.throws(() => convert([0, 0, 0, 0], 'float32 xx'))
})

test('float32 → int16/int8/uint16', () => {
	eq(convert(new Float32Array([1, 1, -1, -1]), 'float32', 'int16'), [32767, 32767, -32768, -32768])
	eq(convert(new Float32Array([1, 1, -1, -1]), 'float32', 'int8'), [127, 127, -128, -128])
	eq(convert(new Float32Array([1, 1, -1, -1]), 'float32', 'uint16'), [65535, 65535, 0, 0])
})

test('interleave', () => {
	eq(convert(new Uint8Array([0, 2, 4, 6, 1, 3, 5, 7]), 'planar', 'interleaved'), [0, 1, 2, 3, 4, 5, 6, 7])
})

test('deinterleave', () => {
	let out = convert(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]), { interleaved: true }, { interleaved: false })
	eq(out, [0, 2, 4, 6, 1, 3, 5, 7])
	assert.ok(out instanceof Uint8Array)
})

test('array output', () => {
	let out = convert(new Uint8Array([0, 255, 0, 255, 0, 255, 0, 255]), { interleaved: true }, 'array planar')
	assert.deepStrictEqual(out, [-1, -1, -1, -1, 1, 1, 1, 1])
	assert.ok(Array.isArray(out))
})

test('arraybuffer output', () => {
	let out = convert(new Uint8Array([0, 255, 0, 255, 0, 255, 0, 255]), { interleaved: true }, 'arraybuffer planar')
	assert.ok(out instanceof ArrayBuffer)
})

test('speaker test — deinterleave + type conversion', () => {
	eq(convert(new Float32Array([-1, 0, 1, 0]),
		{ type: 'float32', interleaved: false, channels: 2 },
		{ type: 'int16', interleaved: true }
	), [-32768, 32767, 0, 0])

	eq(convert(new Float32Array([-1, 0, 1, 0]),
		{ dtype: 'float32', interleaved: false, channels: 2 },
		{ dtype: 'int16', interleaved: true }
	), [-32768, 32767, 0, 0])
})

test('auto-detect source format', () => {
	eq(convert(new Float32Array([-1, 0, 1, 0]),
		{ type: 'int16', interleaved: true }
	), [-32768, 32767, 0, 0])

	eq(convert(new Uint8Array([0, 255]), 'uint16'), [0, 65535])
})

test('AudioBuffer input', () => {
	let buf1 = new AudioBuffer({ length: 4, sampleRate: 44100 })
	buf1.getChannelData(0).set([0, 0, 1, 1])
	eq(convert(buf1, 'array'), [0, 0, 1, 1])

	let buf2 = new AudioBuffer({ length: 2, numberOfChannels: 2, sampleRate: 44100 })
	buf2.getChannelData(0).set([1, 0])
	buf2.getChannelData(1).set([0, 1])
	eq(convert(buf2, 'array'), [1, 0, 0, 1])
})

test('AudioBuffer to float32', () => {
	let buf = new AudioBuffer({ length: 4, sampleRate: 44100 })
	buf.getChannelData(0).set([0, 1, 0, -1])
	eq(convert(buf, 'float32'), [0, 1, 0, -1])
})

test('float32 planar → AudioBuffer', () => {
	let src = new Float32Array([1, -1, 0, 0.5])
	let out = convert(src, { dtype: 'float32', channels: 2, interleaved: false, sampleRate: 44100 }, 'audiobuffer')
	assert.ok(typeof out.getChannelData === 'function')
	assert.equal(out.numberOfChannels, 2)
	assert.equal(out.length, 2)
	assert.equal(out.sampleRate, 44100)
	eq(out.getChannelData(0), [1, -1])
	eq(out.getChannelData(1), [0, 0.5])
})

test('int16 interleaved → AudioBuffer', () => {
	let src = new Int16Array([32767, 0, -32768, 16384])
	let out = convert(src, { dtype: 'int16', channels: 2, interleaved: true, sampleRate: 48000 }, 'audiobuffer')
	assert.ok(typeof out.getChannelData === 'function')
	assert.equal(out.numberOfChannels, 2)
	assert.equal(out.sampleRate, 48000)
	assert.ok(Math.abs(out.getChannelData(0)[0] - 1) < 0.001)
	assert.ok(Math.abs(out.getChannelData(1)[0] - 0) < 0.001)
	assert.ok(Math.abs(out.getChannelData(0)[1] - (-1)) < 0.001)
})

test('destination container — typed array', () => {
	let holder = new Uint8Array(4)
	convert([0, 1, 0, -1], 'uint8', holder)
	eq(holder, [127, 255, 127, 0])
})

test('destination container — auto-detect both', () => {
	let h = new Uint16Array(2)
	convert(new Uint8Array([0, 255]), h)
	eq(h, [0, 65535])
})

test('destination container — 4-arg', () => {
	let h = []
	convert(new Uint8Array([0, 255, 0, 255]), 'interleaved', 'float32 planar', h)
	assert.deepStrictEqual(h, [-1, -1, 1, 1])
})

test('arraybuffer should not shortcut', () => {
	let ab = new Float32Array([0, 0, 1, 1]).buffer
	let out = convert(ab, { type: 'float32', interleaved: true }, 'float32 interleaved')
	assert.ok(out instanceof Float32Array)
	eq(out, [0, 0, 1, 1])
})

test('self-target conversion', () => {
	let arr = new Float32Array([0, 1, 0, 1])
	convert(arr, 'interleaved', 'planar', arr)
	eq(arr, [0, 0, 1, 1])
})

test('arraybuffer output preserves dtype', () => {
	let res = convert(new Float32Array([-1, 0, 1]), 'float32', 'arraybuffer')
	assert.ok(res instanceof ArrayBuffer)
	eq(new Float32Array(res), [-1, 0, 1])

	let res2 = convert(new Float32Array([-1, 0, 1]).buffer, 'float32', 'arraybuffer')
	assert.ok(res2 instanceof ArrayBuffer)
	eq(new Float32Array(res2), [-1, 0, 1])
})

test('full args with undefined to', () => {
	let res = convert([0, 1], 'float32', undefined, new Uint8Array(2))
	eq(res, [127, 255])
})

test('data to arraybuffer container', () => {
	let res = convert(new Uint8Array([127, 255]), new ArrayBuffer(2))
	eq(new Uint8Array(res), [127, 255])
})

test('endianness swap with destination target', () => {
	let dst = new Int16Array(2)
	convert(new Float32Array([1, -0.5]), 'float32 le', 'int16 be', dst)
	let raw = Buffer.from(dst.buffer)
	assert.equal(raw.readInt16BE(0), 32767)
	assert.equal(raw.readInt16BE(2), -16384)
})

// === Planar channel array input (absorbs pcm-encode) ===

test('Float32Array[] → int16 interleaved', () => {
	let left = new Float32Array([1, -1])
	let right = new Float32Array([0, 0.5])
	let out = convert([left, right], 'int16 interleaved')
	assert.ok(out instanceof Int16Array)
	eq(out, [32767, 0, -32768, 16383])
})

test('Float32Array[] → float32 interleaved', () => {
	let left = new Float32Array([1, 0])
	let right = new Float32Array([0, 1])
	let out = convert([left, right], 'float32 interleaved')
	eq(out, [1, 0, 0, 1])
})

test('Float32Array[] → int16 planar (no reinterleave)', () => {
	let left = new Float32Array([1, -1])
	let right = new Float32Array([0, 0.5])
	let out = convert([left, right], 'int16')
	eq(out, [32767, -32768, 0, 16383])
})

test('Float32Array[] mono', () => {
	let ch = new Float32Array([1, 0, -1])
	let out = convert([ch], 'int16')
	eq(out, [32767, 0, -32768])
})

test('Int16Array[] → float32 interleaved', () => {
	let left = new Int16Array([32767, -32768])
	let right = new Int16Array([0, 16384])
	let out = convert([left, right], 'float32 interleaved')
	assert.ok(out instanceof Float32Array)
	assert.ok(Math.abs(out[0] - 1) < 0.001)
	assert.ok(Math.abs(out[2] - (-1)) < 0.001)
})

// === Format parse tests ===

test('parse: basic format string', () => {
	let f = parse('float32 stereo planar le')
	assert.equal(f.dtype, 'float32')
	assert.equal(f.channels, 2)
	assert.equal(f.interleaved, false)
	assert.equal(f.endianness, 'le')
})

test('parse: sample rate', () => {
	let f = parse('int16 stereo 44100')
	assert.equal(f.dtype, 'int16')
	assert.equal(f.channels, 2)
	assert.equal(f.sampleRate, 44100)
})

test('parse: comma/semicolon separators', () => {
	let f = parse('float32, stereo, planar')
	assert.equal(f.dtype, 'float32')
	assert.equal(f.channels, 2)
	assert.equal(f.interleaved, false)
})

test('parse: dtype aliases', () => {
	assert.equal(parse('float').dtype, 'float32')
	assert.equal(parse('int').dtype, 'int32')
	assert.equal(parse('uint').dtype, 'uint32')
})

test('parse: removed aliases throw', () => {
	assert.throws(() => parse('interleave'), /Unknown format token/)
	assert.throws(() => parse('littleendian'), /Unknown format token/)
	assert.throws(() => parse('bigendian'), /Unknown format token/)
})

test('parse: channel aliases', () => {
	assert.equal(parse('mono').channels, 1)
	assert.equal(parse('quad').channels, 4)
	assert.equal(parse('5.1').channels, 6)
	assert.equal(parse('2.1').channels, 3)
})

test('parse: object with type alias', () => {
	let f = parse({ type: 'float32', channels: 2 })
	assert.equal(f.dtype, 'float32')
	assert.equal(f.channels, 2)
})

test('parse: object with numberOfChannels', () => {
	let f = parse({ dtype: 'int16', numberOfChannels: 6 })
	assert.equal(f.dtype, 'int16')
	assert.equal(f.channels, 6)
})

test('parse: audiobuffer as container', () => {
	assert.deepStrictEqual(parse('audiobuffer'), { container: 'audiobuffer' })
})

// === Format detect tests ===

test('detect: typed arrays', () => {
	assert.equal(detect(new Float32Array(1)).dtype, 'float32')
	assert.equal(detect(new Int16Array(1)).dtype, 'int16')
	assert.equal(detect(new Uint8Array(1)).dtype, 'uint8')
})

test('detect: AudioBuffer', () => {
	let buf = new AudioBuffer({ length: 4, numberOfChannels: 2, sampleRate: 48000 })
	let f = detect(buf)
	assert.equal(f.dtype, 'float32')
	assert.equal(f.channels, 2)
	assert.equal(f.interleaved, false)
	assert.equal(f.sampleRate, 48000)
})

test('detect: planar channel arrays', () => {
	let f = detect([new Float32Array(4), new Float32Array(4)])
	assert.equal(f.dtype, 'float32')
	assert.equal(f.channels, 2)
	assert.equal(f.interleaved, false)
})

test('detect: plain array', () => {
	assert.equal(detect([1, 2, 3]).container, 'array')
})

test('detect: ArrayBuffer', () => {
	assert.equal(detect(new ArrayBuffer(4)).container, 'arraybuffer')
})

// === Format stringify tests ===

test('stringify: basic', () => {
	assert.equal(stringify({ dtype: 'float32', channels: 2, interleaved: false }), 'float32 stereo planar')
})

test('stringify: omits le by default', () => {
	assert.equal(stringify({ dtype: 'int16', endianness: 'le' }), 'int16')
	assert.equal(stringify({ dtype: 'int16', endianness: 'be' }), 'int16 be')
})

test('stringify: with sample rate', () => {
	assert.equal(stringify({ dtype: 'float32', sampleRate: 44100 }), 'float32 44100')
})

test('stringify: omit nothing', () => {
	let s = stringify({ dtype: 'int16', endianness: 'le' }, null)
	assert.equal(s, 'int16 le')
})

// === Rates ===

test('sampleRate: standard sample rates', () => {
	assert.ok(Array.isArray(sampleRate))
	assert.equal(sampleRate.length, 12)
	assert.ok(sampleRate.includes(44100))
	assert.ok(sampleRate.includes(48000))
	assert.ok(sampleRate.includes(96000))
})
