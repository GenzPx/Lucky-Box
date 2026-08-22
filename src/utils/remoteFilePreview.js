export async function readRemoteFilePreview({
	editorCache,
	transportCache,
	encoding,
}) {
	const editorCacheExists = await editorCache.exists();
	if (editorCacheExists) {
		return {
			editorCacheExists,
			text: await editorCache.readFile(encoding),
		};
	}
	try {
		if (transportCache && (await transportCache.exists())) {
			return {
				editorCacheExists,
				text: await transportCache.readFile(encoding),
			};
		}
	} catch (_error) {}
	return {
		editorCacheExists,
		text: null,
	};
}
