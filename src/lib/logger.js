import fsOperation from "fileSystem";
import Url from "utils/Url";
import config from "./config";

class Logger {
	#logBuffer;
	#maxBufferSize;
	#logLevel;
	#logFileName;
	#flushInterval;
	#autoFlushInterval;
	#maxFileSize;
	constructor(
		maxBufferSize = 1000,
		logLevel = "info",
		flushInterval = 30000,
		maxFileSize = 10 * 1024 * 1024,
	) {
		this.#logBuffer = new Map();
		this.#maxBufferSize = maxBufferSize;
		this.#logLevel = logLevel;
		this.#logFileName = config.LOG_FILE_NAME;
		this.#flushInterval = flushInterval;
		this.#maxFileSize = maxFileSize;
		this.#startAutoFlush();
		this.#setupAppLifecycleHandlers();
	}
	log(level, message) {
		const levels = ["error", "warn", "info", "debug"];
		if (levels.indexOf(level) <= levels.indexOf(this.#logLevel)) {
			let logEntry;
			if (message instanceof Error) {
				logEntry = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message.name}: ${message.message}\nStack trace: ${message.stack}`;
			} else {
				logEntry = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
			}
			if (this.#logBuffer.size >= this.#maxBufferSize) {
				const oldestKey = this.#logBuffer.keys().next().value;
				this.#logBuffer.delete(oldestKey);
			}
			this.#logBuffer.set(Date.now(), logEntry);
		}
	}
	flushLogs() {
		if (this.#logBuffer.size > 0) {
			const logContent = Array.from(this.#logBuffer.values()).join("\n");
			this.#writeLogToFile(logContent);
			this.#logBuffer.clear();
		}
	}
	#writeLogToFile = async (logContent) => {
		try {
			const logFilePath = Url.join(DATA_STORAGE, config.LOG_FILE_NAME);
			if (!(await fsOperation(logFilePath).exists())) {
				await fsOperation(window.DATA_STORAGE).createFile(
					config.LOG_FILE_NAME,
					logContent,
				);
			} else {
				let existingData = await fsOperation(logFilePath).readFile("utf8");
				let newData = existingData + "\n" + logContent;
				if (new Blob([newData]).size > this.#maxFileSize) {
					const lines = newData.split("\n");
					while (
						new Blob([lines.join("\n")]).size > this.#maxFileSize &&
						lines.length > 0
					) {
						lines.shift();
					}
					newData = lines.join("\n");
				}
				await fsOperation(logFilePath).writeFile(newData);
			}
		} catch (error) {
			console.error(
				"Error in handling fs operation on log file. Error:",
				error,
			);
		}
	};
	#startAutoFlush = () => {
		this.#autoFlushInterval = setInterval(() => {
			this.flushLogs();
		}, this.#flushInterval);
	};
	stopAutoFlush() {
		clearInterval(this.#autoFlushInterval);
	}
	#setupAppLifecycleHandlers = () => {
		document.addEventListener(
			"pause",
			() => {
				this.flushLogs();
			},
			false,
		);
	};
}
export default Logger;
