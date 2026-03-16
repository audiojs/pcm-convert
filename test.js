import { test } from 'node:test'
import assert from 'node:assert'
import convert from './index.js'
import AudioBuffer from 'audio-buffer'

const eq = (a, b) => assert.deepStrictEqual([...a], b)

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
	eq(convert(buf1, 'audiobuffer', 'array'), [0, 0, 1, 1])

	let buf2 = new AudioBuffer({ length: 2, numberOfChannels: 2, sampleRate: 44100 })
	buf2.getChannelData(0).set([1, 0])
	buf2.getChannelData(1).set([0, 1])
	eq(convert(buf2, 'audiobuffer', 'array'), [1, 0, 0, 1])
})

test('AudioBuffer to float32', () => {
	let buf = new AudioBuffer({ length: 4, sampleRate: 44100 })
	buf.getChannelData(0).set([0, 1, 0, -1])
	eq(convert(buf, 'float32'), [0, 1, 0, -1])
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
