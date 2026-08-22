const ALGORITHMS = Object.freeze({
	sha1: "SHA-1",
	sha256: "SHA-256",
	sha384: "SHA-384",
	sha512: "SHA-512",
});
export function supportedAlgorithms() {
	return Object.keys(ALGORITHMS);
}
export async function digest(input, algorithm = "sha256") {
	const normalized = normalizeAlgorithm(algorithm);
	const bytes = await toArrayBuffer(input);
	const result = await crypto.subtle.digest(normalized, bytes);
	return toHex(result);
}
export async function verify(input, expected, algorithm = "sha256") {
	const actual = await digest(input, algorithm);
	return {
		algorithm: normalizeAlgorithm(algorithm),
		expected: normalizeHex(expected),
		actual,
		matches: actual === normalizeHex(expected),
	};
}
export function detectAlgorithm(checksum) {
	switch (normalizeHex(checksum).length) {
		case 40:
			return "sha1";
		case 64:
			return "sha256";
		case 96:
			return "sha384";
		case 128:
			return "sha512";
		default:
			return null;
	}
}
function normalizeAlgorithm(value) {
	const key = String(value || "sha256")
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");
	const algorithm = ALGORITHMS[key];
	if (!algorithm) throw new Error(`Unsupported checksum algorithm: ${value}`);
	return algorithm;
}
async function toArrayBuffer(input) {
	if (typeof input === "string") return new TextEncoder().encode(input).buffer;
	if (input instanceof ArrayBuffer) return input;
	if (ArrayBuffer.isView(input)) {
		return input.buffer.slice(
			input.byteOffset,
			input.byteOffset + input.byteLength,
		);
	}
	if (typeof Blob !== "undefined" && input instanceof Blob) {
		return await input.arrayBuffer();
	}
	throw new TypeError("Checksum input must be text, Blob/File, or binary data");
}
function normalizeHex(value) {
	return String(value || "")
		.toLowerCase()
		.replace(/[^a-f0-9]/g, "");
}
function toHex(buffer) {
	return [...new Uint8Array(buffer)]
		.map((value) => value.toString(16).padStart(2, "0"))
		.join("");
}
