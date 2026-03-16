/**
 * @module pcm-convert
 * Convert PCM audio data between formats
 */

const DTYPE = {
	float32: { C: Float32Array, min: -1, max: 1 },
	float64: { C: Float64Array, min: -1, max: 1 },
	uint8:   { C: Uint8Array,   min: 0,  max: 255 },
	uint16:  { C: Uint16Array,  min: 0,  max: 65535 },
	uint32:  { C: Uint32Array,  min: 0,  max: 4294967295 },
	int8:    { C: Int8Array,    min: -128, max: 127 },
	int16:   { C: Int16Array,   min: -32768, max: 32767 },
	int32:   { C: Int32Array,   min: -2147483648, max: 2147483647 },
}

const CHANNELS = { mono: 1, stereo: 2, quad: 4, '5.1': 6 }

const isTyped = v => ArrayBuffer.isView(v) && !(v instanceof DataView)
const isContainer = v => v != null && typeof v !== 'string' && (Array.isArray(v) || isTyped(v) || v instanceof ArrayBuffer)
const isAudioBuffer = v => v != null && typeof v.getChannelData === 'function' && typeof v.numberOfChannels === 'number'

// Parse format string or object into normalized descriptor
function parse(fmt) {
	if (!fmt) return {}
	if (typeof fmt !== 'string') {
		let d = fmt.dtype || (fmt.type && DTYPE[fmt.type] ? fmt.type : null)
		let r = {}
		if (d) r.dtype = d
		if (fmt.channels != null) r.channels = fmt.channels
		if (fmt.interleaved != null) r.interleaved = fmt.interleaved
		if (fmt.endianness) r.endianness = fmt.endianness
		return r
	}
	let r = {}
	for (let t of fmt.split(/\s+/)) {
		let lo = t.toLowerCase()
		if (DTYPE[lo]) r.dtype = lo
		else if (CHANNELS[lo]) r.channels = CHANNELS[lo]
		else if (lo === 'interleaved') r.interleaved = true
		else if (lo === 'planar') r.interleaved = false
		else if (lo === 'le' || lo === 'be') r.endianness = lo
		else if (lo === 'array') r.container = 'array'
		else if (lo === 'arraybuffer') r.container = 'arraybuffer'
		else if (lo === 'buffer') r.container = 'buffer'
		else if (lo === 'audiobuffer') r.dtype = 'float32'
		else throw Error('Unknown format token: ' + t)
	}
	return r
}

// Detect format from data type
function detect(data) {
	if (data == null) return {}
	if (isAudioBuffer(data)) return { dtype: 'float32', channels: data.numberOfChannels, interleaved: false }
	// Buffer before typed array loop — Buffer extends Uint8Array but needs distinct detection
	if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) return { dtype: 'uint8', container: 'buffer' }
	for (let k in DTYPE) if (data instanceof DTYPE[k].C) return { dtype: k }
	if (data instanceof Uint8ClampedArray) return { dtype: 'uint8' }
	if (data instanceof ArrayBuffer) return { container: 'arraybuffer' }
	if (Array.isArray(data)) return { container: 'array' }
	return {}
}

function range(dtype) { return DTYPE[dtype] || { min: -1, max: 1 } }

export default function convert(src, from, to, dst) {
	if (!src) throw Error('Source data required')
	if (from == null) throw Error('Format required')

	// Resolve overloaded arguments
	if (to === undefined && dst === undefined) {
		if (isContainer(from)) { dst = from; to = detect(dst); from = detect(src) }
		else { to = parse(from); from = detect(src) }
	} else if (dst === undefined) {
		if (isContainer(to)) { dst = to; to = parse(from); from = detect(src) }
		else { from = { ...detect(src), ...parse(from) }; to = parse(to) }
	} else {
		from = { ...detect(src), ...parse(from) }
		to = { ...(dst ? detect(dst) : {}), ...parse(to) }
	}

	// Fill defaults
	if (!to.dtype) to.dtype = from.dtype
	if (to.channels == null && from.channels != null) to.channels = from.channels
	if (to.interleaved != null && from.interleaved == null) {
		from.interleaved = !to.interleaved
		if (!from.channels) from.channels = 2
	}
	if (from.interleaved != null && !from.channels) from.channels = 2

	let fromR = from.container === 'array' ? { min: -1, max: 1 } : range(from.dtype)
	let toR = to.container === 'array' ? { min: -1, max: 1 } : range(to.dtype)

	// Extract source as indexable numeric sequence
	let samples
	if (isAudioBuffer(src)) {
		let nc = src.numberOfChannels, len = src.length
		samples = new Float32Array(len * nc)
		for (let c = 0; c < nc; c++) samples.set(src.getChannelData(c), len * c)
	} else if (src instanceof ArrayBuffer) {
		samples = new (DTYPE[from.dtype]?.C || Uint8Array)(src)
	} else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(src)) {
		samples = new (DTYPE[from.dtype]?.C || Uint8Array)(
			src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength)
		)
	} else {
		samples = src
	}

	let len = samples.length
	let needsMap = fromR.min !== toR.min || fromR.max !== toR.max
	let reinterleave = from.interleaved != null && to.interleaved != null && from.interleaved !== to.interleaved
	let ch = from.channels || 1, seg = Math.floor(len / ch)
	let Ctor = DTYPE[to.dtype]?.C || Float32Array

	// Conversion: fast copy / range map / reinterleave
	let out
	if (!needsMap && !reinterleave) {
		out = to.container === 'array' ? Array.from(samples) : new Ctor(samples)
	} else {
		out = to.container === 'array' ? new Array(len) : new Ctor(len)
		let fromSpan = fromR.max - fromR.min, toSpan = toR.max - toR.min
		if (!reinterleave) {
			for (let i = 0; i < len; i++) {
				let v = ((samples[i] - fromR.min) / fromSpan) * toSpan + toR.min
				out[i] = v < toR.min ? toR.min : v > toR.max ? toR.max : v
			}
		} else {
			let deint = from.interleaved
			for (let i = 0; i < len; i++) {
				let si = deint ? (i % seg) * ch + ~~(i / seg) : (i % ch) * seg + ~~(i / ch)
				let v = samples[si]
				if (needsMap) {
					v = ((v - fromR.min) / fromSpan) * toSpan + toR.min
					if (v < toR.min) v = toR.min
					else if (v > toR.max) v = toR.max
				}
				out[i] = v
			}
		}
	}

	// Write to caller-provided target
	if (dst) {
		if (Array.isArray(dst)) { for (let i = 0; i < len; i++) dst[i] = out[i]; out = dst }
		else if (dst instanceof ArrayBuffer) { let tc = new (DTYPE[to.dtype]?.C || Uint8Array)(dst); tc.set(out); out = tc }
		else { dst.set(out); out = dst }
	}

	// Endianness swap — after dst write so .set() doesn't undo byte reordering
	let info = DTYPE[to.dtype]
	if (info && info.C.BYTES_PER_ELEMENT > 1 &&
		from.endianness && to.endianness && from.endianness !== to.endianness &&
		out.buffer) {
		let le = to.endianness === 'le'
		let view = new DataView(out.buffer)
		let step = info.C.BYTES_PER_ELEMENT
		let fn = 'set' + to.dtype[0].toUpperCase() + to.dtype.slice(1)
		for (let i = 0; i < len; i++) view[fn](i * step, out[i], le)
	}

	// Return requested container type
	if (to.container === 'arraybuffer' || to.container === 'buffer') return out.buffer || out
	return out
}
