export async function loadFileBrowser() {
	return (await import("pages/fileBrowser")).default;
}
