const TERMINAL_STATES = new Set(["completed", "failed", "cancelled"]);
export default class OperationQueue {
	#tasks = new Map();
	#pending = [];
	#running = new Set();
	#listeners = new Set();
	#nextId = 1;
	#paused = false;
	constructor({ concurrency = 2, historyLimit = 100 } = {}) {
		this.concurrency = Math.max(1, Number(concurrency) || 2);
		this.historyLimit = Math.max(10, Number(historyLimit) || 100);
	}
	enqueue(operation, options = {}) {
		if (typeof operation !== "function") {
			throw new TypeError("Queue operation must be a function");
		}
		const id = String(options.id || `operation-${this.#nextId++}`);
		if (this.#tasks.has(id))
			throw new Error(`Operation '${id}' already exists`);
		const controller = new AbortController();
		const task = {
			id,
			type: options.type || "generic",
			title: options.title || "Operation",
			description: options.description || "",
			metadata: options.metadata || {},
			state: "queued",
			progress: 0,
			processedBytes: 0,
			totalBytes: Number(options.totalBytes) || 0,
			message: "",
			createdAt: Date.now(),
			startedAt: null,
			endedAt: null,
			result: undefined,
			error: null,
			operation,
			controller,
			pauseWaiters: [],
		};
		this.#tasks.set(id, task);
		this.#pending.push(id);
		this.#emit("queued", task);
		this.#drain();
		return this.#publicTask(task);
	}
	pause(id) {
		const task = this.#tasks.get(String(id));
		if (!task || TERMINAL_STATES.has(task.state)) return false;
		if (task.state === "queued" || task.state === "running") {
			task.state = "paused";
			this.#emit("paused", task);
			return true;
		}
		return false;
	}
	resume(id) {
		const task = this.#tasks.get(String(id));
		if (!task || task.state !== "paused") return false;
		task.state = this.#running.has(task.id) ? "running" : "queued";
		for (const resolve of task.pauseWaiters.splice(0)) resolve();
		this.#emit("resumed", task);
		this.#drain();
		return true;
	}
	cancel(id, reason = "Cancelled by user") {
		const task = this.#tasks.get(String(id));
		if (!task || TERMINAL_STATES.has(task.state)) return false;
		task.controller.abort(reason);
		task.state = "cancelled";
		task.message = reason;
		task.endedAt = Date.now();
		this.#pending = this.#pending.filter((taskId) => taskId !== task.id);
		for (const resolve of task.pauseWaiters.splice(0)) resolve();
		this.#emit("cancelled", task);
		return true;
	}
	pauseAll() {
		this.#paused = true;
		for (const task of this.#tasks.values()) this.pause(task.id);
		this.#emit("queue-paused", null);
	}
	resumeAll() {
		this.#paused = false;
		for (const task of this.#tasks.values()) this.resume(task.id);
		this.#emit("queue-resumed", null);
		this.#drain();
	}
	clearCompleted() {
		for (const [id, task] of this.#tasks) {
			if (TERMINAL_STATES.has(task.state)) this.#tasks.delete(id);
		}
		this.#emit("cleared", null);
	}
	get(id) {
		const task = this.#tasks.get(String(id));
		return task ? this.#publicTask(task) : null;
	}
	list({ state, type } = {}) {
		return [...this.#tasks.values()]
			.filter((task) => !state || task.state === state)
			.filter((task) => !type || task.type === type)
			.sort((a, b) => b.createdAt - a.createdAt)
			.map((task) => this.#publicTask(task));
	}
	onChange(listener) {
		if (typeof listener !== "function") return () => {};
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}
	destroy() {
		for (const task of this.#tasks.values())
			this.cancel(task.id, "Queue destroyed");
		this.#tasks.clear();
		this.#pending = [];
		this.#running.clear();
		this.#listeners.clear();
	}
	async #run(task) {
		if (task.state === "cancelled") return;
		task.state = "running";
		task.startedAt = Date.now();
		this.#running.add(task.id);
		this.#emit("started", task);
		const context = {
			signal: task.controller.signal,
			metadata: task.metadata,
			report: (update = {}) => {
				if (task.controller.signal.aborted) return;
				if (update.processedBytes != null) {
					task.processedBytes = Math.max(0, Number(update.processedBytes) || 0);
				}
				if (update.totalBytes != null) {
					task.totalBytes = Math.max(0, Number(update.totalBytes) || 0);
				}
				if (update.progress != null) {
					task.progress = clampProgress(update.progress);
				} else if (task.totalBytes > 0) {
					task.progress = clampProgress(task.processedBytes / task.totalBytes);
				}
				if (update.message != null) task.message = String(update.message);
				this.#emit("progress", task);
			},
			waitIfPaused: async () => {
				if (task.state !== "paused" && !this.#paused) return;
				await new Promise((resolve) => task.pauseWaiters.push(resolve));
				if (task.controller.signal.aborted) {
					throw new DOMException("Operation cancelled", "AbortError");
				}
			},
		};
		try {
			task.result = await task.operation(context);
			if (task.state !== "cancelled") {
				task.state = "completed";
				task.progress = 1;
				task.endedAt = Date.now();
				this.#emit("completed", task);
			}
		} catch (error) {
			if (task.controller.signal.aborted || error?.name === "AbortError") {
				task.state = "cancelled";
				task.message ||= "Operation cancelled";
				this.#emit("cancelled", task);
			} else {
				task.state = "failed";
				task.error = error instanceof Error ? error.message : String(error);
				this.#emit("failed", task);
			}
			task.endedAt = Date.now();
		} finally {
			this.#running.delete(task.id);
			this.#trimHistory();
			this.#drain();
		}
	}
	#drain() {
		if (this.#paused) return;
		while (this.#running.size < this.concurrency && this.#pending.length) {
			const id = this.#pending.shift();
			const task = this.#tasks.get(id);
			if (!task || task.state === "cancelled") continue;
			if (task.state === "paused") {
				this.#pending.push(id);
				break;
			}
			this.#run(task);
		}
	}
	#trimHistory() {
		const completed = [...this.#tasks.values()]
			.filter((task) => TERMINAL_STATES.has(task.state))
			.sort((a, b) => b.endedAt - a.endedAt);
		for (const task of completed.slice(this.historyLimit))
			this.#tasks.delete(task.id);
	}
	#publicTask(task) {
		const { operation, controller, pauseWaiters, ...publicTask } = task;
		return {
			...publicTask,
			metadata: {
				...publicTask.metadata,
			},
		};
	}
	#emit(type, task) {
		const payload = task ? this.#publicTask(task) : null;
		for (const listener of this.#listeners) {
			try {
				listener({
					type,
					task: payload,
				});
			} catch (error) {
				console.error("OperationQueue listener failed", error);
			}
		}
	}
}
function clampProgress(value) {
	return Math.min(1, Math.max(0, Number(value) || 0));
}
