const DEFAULT_MAX_ENTRIES = 5000;
export default class NetworkSession {
	#entries = new Map();
	#order = [];
	#listeners = new Set();
	#rules = [];
	#nextId = 1;
	constructor({ maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
		this.maxEntries = Math.max(100, Number(maxEntries) || DEFAULT_MAX_ENTRIES);
		this.startedAt = Date.now();
	}
	addRequest(input = {}) {
		const id = String(input.id || this.#nextId++);
		const startedAt = Number(input.startedAt) || Date.now();
		const entry = {
			id,
			url: String(input.url || ""),
			method: String(input.method || "GET").toUpperCase(),
			requestHeaders: normalizeHeaders(input.requestHeaders),
			requestBody: input.requestBody ?? null,
			resourceType: input.resourceType || "other",
			initiator: input.initiator ?? null,
			startedAt,
			endedAt: null,
			duration: null,
			status: null,
			statusText: "",
			responseHeaders: {},
			responseBody: null,
			mimeType: "",
			encodedSize: 0,
			fromCache: false,
			blocked: false,
			error: null,
			timing: input.timing ?? null,
		};
		this.#entries.set(id, entry);
		this.#order.push(id);
		this.#trim();
		this.#emit("request", entry);
		return entry;
	}
	completeRequest(id, result = {}) {
		const entry = this.#entries.get(String(id));
		if (!entry) return null;
		entry.endedAt = Number(result.endedAt) || Date.now();
		entry.duration = Math.max(0, entry.endedAt - entry.startedAt);
		entry.status = result.status == null ? entry.status : Number(result.status);
		entry.statusText = result.statusText ?? entry.statusText;
		entry.responseHeaders = normalizeHeaders(result.responseHeaders);
		entry.responseBody = result.responseBody ?? entry.responseBody;
		entry.mimeType = result.mimeType ?? entry.mimeType;
		entry.encodedSize =
			Number(result.encodedSize) || byteLength(entry.responseBody);
		entry.fromCache = Boolean(result.fromCache);
		entry.timing = result.timing ?? entry.timing;
		this.#emit("response", entry);
		return entry;
	}
	failRequest(id, error) {
		const entry = this.#entries.get(String(id));
		if (!entry) return null;
		entry.endedAt = Date.now();
		entry.duration = Math.max(0, entry.endedAt - entry.startedAt);
		entry.error =
			error instanceof Error
				? error.message
				: String(error || "Request failed");
		this.#emit("error", entry);
		return entry;
	}
	get(id) {
		return this.#entries.get(String(id)) || null;
	}
	list(filter = {}) {
		const query = String(filter.query || "").toLowerCase();
		return this.#order
			.map((id) => this.#entries.get(id))
			.filter(Boolean)
			.filter((entry) => {
				if (
					filter.method &&
					entry.method !== String(filter.method).toUpperCase()
				)
					return false;
				if (filter.resourceType && entry.resourceType !== filter.resourceType)
					return false;
				if (filter.status && entry.status !== Number(filter.status))
					return false;
				if (filter.errorsOnly && !entry.error && !entry.blocked) return false;
				return !query || entry.url.toLowerCase().includes(query);
			});
	}
	clear() {
		this.#entries.clear();
		this.#order = [];
		this.#emit("clear", null);
	}
	addRule(rule = {}) {
		const normalized = {
			id: String(
				rule.id ||
					`rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			),
			enabled: rule.enabled !== false,
			match: rule.match || "*",
			action: rule.action || "block",
			redirectUrl: rule.redirectUrl || "",
			method: rule.method ? String(rule.method).toUpperCase() : null,
			headers: normalizeHeaders(rule.headers),
			body: rule.body ?? null,
		};
		this.#rules.push(normalized);
		this.#emit("rules", this.rules());
		return normalized;
	}
	removeRule(id) {
		const before = this.#rules.length;
		this.#rules = this.#rules.filter((rule) => rule.id !== String(id));
		if (before !== this.#rules.length) this.#emit("rules", this.rules());
	}
	rules() {
		return this.#rules.map((rule) => ({
			...rule,
			headers: {
				...rule.headers,
			},
		}));
	}
	matchRule(request) {
		return (
			this.#rules.find((rule) => {
				if (!rule.enabled) return false;
				if (
					rule.method &&
					rule.method !== String(request.method || "GET").toUpperCase()
				)
					return false;
				return wildcardMatch(String(request.url || ""), rule.match);
			}) || null
		);
	}
	toHAR({ creatorName = "LuckyBox", creatorVersion = "1.13.1" } = {}) {
		return {
			log: {
				version: "1.2",
				creator: {
					name: creatorName,
					version: creatorVersion,
				},
				pages: [],
				entries: this.list().map(toHarEntry),
			},
		};
	}
	onChange(listener) {
		if (typeof listener !== "function") return () => {};
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}
	destroy() {
		this.clear();
		this.#rules = [];
		this.#listeners.clear();
	}
	#trim() {
		while (this.#order.length > this.maxEntries) {
			this.#entries.delete(this.#order.shift());
		}
	}
	#emit(type, payload) {
		for (const listener of this.#listeners) {
			try {
				listener({
					type,
					payload,
				});
			} catch (error) {
				console.error("NetworkSession listener failed", error);
			}
		}
	}
}
function normalizeHeaders(headers) {
	if (!headers) return {};
	if (Array.isArray(headers)) {
		return Object.fromEntries(
			headers.map(({ name, value }) => [String(name), String(value)]),
		);
	}
	return Object.fromEntries(
		Object.entries(headers).map(([name, value]) => [name, String(value)]),
	);
}
function wildcardMatch(value, pattern) {
	if (pattern instanceof RegExp) return pattern.test(value);
	const source = String(pattern || "*")
		.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
		.replace(/\*/g, ".*");
	return new RegExp(`^${source}$`, "i").test(value);
}
function byteLength(value) {
	if (value == null) return 0;
	return new TextEncoder().encode(
		typeof value === "string" ? value : JSON.stringify(value),
	).length;
}
function headersForHar(headers) {
	return Object.entries(headers || {}).map(([name, value]) => ({
		name,
		value: String(value),
	}));
}
function toHarEntry(entry) {
	const requestBody =
		entry.requestBody == null ? null : String(entry.requestBody);
	const responseBody =
		entry.responseBody == null ? "" : String(entry.responseBody);
	return {
		startedDateTime: new Date(entry.startedAt).toISOString(),
		time: entry.duration ?? 0,
		request: {
			method: entry.method,
			url: entry.url,
			httpVersion: "HTTP/1.1",
			headers: headersForHar(entry.requestHeaders),
			queryString: [],
			cookies: [],
			headersSize: -1,
			bodySize: byteLength(requestBody),
			...(requestBody == null
				? {}
				: {
						postData: {
							mimeType: "",
							text: requestBody,
						},
					}),
		},
		response: {
			status: entry.status ?? 0,
			statusText: entry.statusText || entry.error || "",
			httpVersion: "HTTP/1.1",
			headers: headersForHar(entry.responseHeaders),
			cookies: [],
			content: {
				size: entry.encodedSize || byteLength(responseBody),
				mimeType: entry.mimeType || "application/octet-stream",
				text: responseBody,
			},
			redirectURL:
				entry.responseHeaders?.location ||
				entry.responseHeaders?.Location ||
				"",
			headersSize: -1,
			bodySize: entry.encodedSize || byteLength(responseBody),
		},
		cache: {},
		timings: entry.timing || {
			send: 0,
			wait: entry.duration ?? 0,
			receive: 0,
		},
		_serverIPAddress: "",
		_connection: "",
		_luckybox: {
			resourceType: entry.resourceType,
			initiator: entry.initiator,
			blocked: entry.blocked,
			fromCache: entry.fromCache,
		},
	};
}
