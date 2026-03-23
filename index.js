/**
 * @module pcm-convert
 * Convert PCM audio data between formats
 */

export const sampleRates = [8000, 11025, 16000, 22050, 44100, 48000, 88200, 96000, 176400, 192000, 352800, 384000]

const RATE_SET = new Set(sampleRates)

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

const dtype = d => DTYPE[d] && d || DTYPE[d + '32'] && (d + '32')

const CONTAINER = { array: 1, arraybuffer: 1, buffer: 1 }

const CHANNELS = { mono: 1, stereo: 2, '2.1': 3, quad: 4, '5.1': 6 }
for (let i = 3; i <= 32; i++) CHANNELS[i + '-channel'] ||= i

const CHANNEL_NAME = {}
for (let k in CHANNELS) CHANNEL_NAME[CHANNELS[k]] ||= k

const isTyped = v => ArrayBuffer.isView(v) && !(v instanceof DataView)
const isPlanar = v => Array.isArray(v) && v.length > 0 && isTyped(v[0])
const isContainer = v => v != null && typeof v !== 'string' && !isPlanar(v) && (Array.isArray(v) || isTyped(v) || v instanceof ArrayBuffer)
const isAudioBuffer = v => v != null && typeof v.getChannelData === 'function' && typeof v.numberOfChannels === 'number'

// Parse format string or object into normalized descriptor
export function parse(fmt) {
	if (!fmt) return {}

	if (typeof fmt !== 'string') {
		let r = {}
		let d = fmt.dtype || fmt.type
		if (dtype(d)) r.dtype = dtype(d)
		if (d && CONTAINER[d]) r.container = d
		if (fmt.channels != null) r.channels = CHANNELS[fmt.channels] || +fmt.channels
		if (fmt.numberOfChannels != null) r.channels ??= fmt.numberOfChannels
		if (fmt.interleaved != null) r.interleaved = fmt.interleaved
		if (fmt.endianness) r.endianness = fmt.endianness
		if (fmt.sampleRate != null) r.sampleRate = fmt.sampleRate
		if (fmt.rate != null) r.sampleRate ??= fmt.rate
		if (fmt.container) r.container = fmt.container
		return r
	}

	let r = {}
	for (let t of fmt.split(/\s*[,;_]\s*|\s+/)) {
		let lo = t.toLowerCase()
		if (dtype(lo)) r.dtype = dtype(lo)
		else if (CONTAINER[lo]) r.container = lo
		else if (CHANNELS[lo]) r.channels = CHANNELS[lo]
		else if (lo === 'interleaved' || lo === 'interleave') r.interleaved = true
		else if (lo === 'planar') r.interleaved = false
		else if (lo === 'le' || lo === 'littleendian') r.endianness = 'le'
		else if (lo === 'be' || lo === 'bigendian') r.endianness = 'be'
		else if (/^\d+$/.test(lo) && RATE_SET.has(+lo)) r.sampleRate = +lo
		else throw Error('Unknown format token: ' + t)
	}
	return r
}

// Detect format from data
export function detect(data) {
	if (data == null) return {}
	if (isAudioBuffer(data))
		return { dtype: 'float32', channels: data.numberOfChannels, interleaved: false, sampleRate: data.sampleRate }
	if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) return { dtype: 'uint8', container: 'buffer' }
	if (data instanceof Float32Array) return { dtype: 'float32' }
	if (data instanceof Float64Array) return { dtype: 'float64' }
	if (data instanceof Int8Array) return { dtype: 'int8' }
	if (data instanceof Int16Array) return { dtype: 'int16' }
	if (data instanceof Int32Array) return { dtype: 'int32' }
	if (data instanceof Uint8Array) return { dtype: 'uint8' }
	if (data instanceof Uint8ClampedArray) return { dtype: 'uint8' }
	if (data instanceof Uint16Array) return { dtype: 'uint16' }
	if (data instanceof Uint32Array) return { dtype: 'uint32' }
	if (data instanceof ArrayBuffer) return { container: 'arraybuffer' }
	if (Array.isArray(data)) {
		if (isPlanar(data))
			return { ...detect(data[0]), channels: data.length, interleaved: false }
		return { container: 'array' }
	}
	return {}
}

// Stringify format object
export function stringify(format, omit) {
	if (omit === undefined) omit = { endianness: 'le' }
	else if (typeof omit === 'string') omit = parse(omit)
	else if (omit == null) omit = {}

	let parts = []
	if (format.dtype && format.dtype !== omit.dtype) parts.push(format.dtype)
	if (format.container && format.container !== omit.container) parts.push(format.container)
	if (format.channels != null && format.channels !== omit.channels)
		parts.push(CHANNEL_NAME[format.channels] || format.channels + '-channel')
	if (format.endianness && format.endianness !== omit.endianness) parts.push(format.endianness)
	if (format.interleaved != null && format.interleaved !== omit.interleaved)
		parts.push(format.interleaved ? 'interleaved' : 'planar')
	if (format.sampleRate != null && format.sampleRate !== omit.sampleRate) parts.push(format.sampleRate)
	return parts.join(' ')
}

function range(d) { return DTYPE[d] || { min: -1, max: 1 } }

export default function convert(src, from, to, dst) {
	if (!src) throw Error('Source data required')
	if (from == null) throw Error('Format required')

	let srcInfo = detect(src)

	// Resolve overloaded arguments
	if (to === undefined && dst === undefined) {
		if (isContainer(from)) { dst = from; to = detect(dst); from = srcInfo }
		else { to = parse(from); from = srcInfo }
	} else if (dst === undefined) {
		if (isContainer(to)) { dst = to; to = parse(from); from = srcInfo }
		else { from = { ...srcInfo, ...parse(from) }; to = parse(to) }
	} else {
		from = { ...srcInfo, ...parse(from) }
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
	if (isPlanar(src)) {
		let ch = src.length, len = src[0].length
		samples = new (src[0].constructor)(len * ch)
		for (let c = 0; c < ch; c++) samples.set(src[c], len * c)
	} else if (isAudioBuffer(src)) {
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

	// Endianness swap
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
