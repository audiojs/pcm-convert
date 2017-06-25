'use strict'

var test = require('tape')
var convert = require('./')

test('FloatLE to Int16BE', function (t) {
	var buf = new Buffer(8);
	buf.writeFloatLE(1.0, 0);
	buf.writeFloatLE(-0.5, 4);

	var newBuf = convert(buf, 'float32 le', 'int16 be');
	newBuf = Buffer.from(newBuf.buffer)
	var val1 = newBuf.readInt16BE(0);
	var val2 = newBuf.readInt16BE(2);

	t.equal(Math.pow(2, 15) - 1, val1);
	t.equal(-Math.pow(2, 14), val2);
	t.end()
});

test('markers', function (t) {
	let arr = convert(new Uint8Array([0, 255, 255, 0, 0, 255]), 'interleaved')

	t.deepEqual(arr, [-1, 1, -1, 1, -1, 1])

	t.end()
})


test('bad markers', function (t) {
	t.throws(() => {
		convert([0,0,0,0], 'float32 3')
	})
	t.end()
})


test('float to whatever', t => {
	t.deepEqual(
		convert(new Float32Array([1, 1, -1, -1]),'float32', 'int16'),
		[32767, 32767, -32768, -32768])

	t.deepEqual(
		convert(new Float32Array([1, 1, -1, -1]),'float32', 'int8'),
		[127, 127, -128, -128])

	t.deepEqual(
		convert(new Float32Array([1, 1, -1, -1]),'float32', 'uint16'),
		[65535, 65535, 0, 0])

	t.end()
})
