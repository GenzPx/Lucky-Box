class FileTypeHandlerRegistry {
	#handlers = new Map();
	registerFileHandler(id, { extensions, handleFile }) {
		if (this.#handlers.has(id)) {
			throw new Error(`Handler with id '${id}' is already registered`);
		}
		if (!extensions?.length) {
			throw new Error("extensions array is required");
		}
		if (typeof handleFile !== "function") {
			throw new Error("handleFile function is required");
		}
		const normalizedExts = extensions.map((ext) =>
			ext.toLowerCase().replace(/^\./, ""),
		);
		this.#handlers.set(id, {
			extensions: normalizedExts,
			handleFile,
		});
	}
	unregisterFileHandler(id) {
		this.#handlers.delete(id);
	}
	getFileHandler(filename) {
		const ext = filename.split(".").pop().toLowerCase();
		for (const [id, handler] of this.#handlers) {
			if (
				handler.extensions.includes(ext) ||
				handler.extensions.includes("*")
			) {
				return {
					id,
					...handler,
				};
			}
		}
		return null;
	}
	getHandlers() {
		return new Map(this.#handlers);
	}
}
export const fileTypeHandler = new FileTypeHandlerRegistry();
export default fileTypeHandler;
