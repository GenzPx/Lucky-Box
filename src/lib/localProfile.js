const STORAGE_KEY = "luckybox.localProfile";
const listeners = new Set();
const defaults = Object.freeze({
	name: "LuckyBox User",
	bio: "Local profile",
	avatar: "",
});
function read() {
	try {
		return {
			...defaults,
			...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"),
		};
	} catch {
		return { ...defaults };
	}
}
function save(profile) {
	const value = {
		name: String(profile.name || defaults.name).trim() || defaults.name,
		bio: String(profile.bio || "").trim(),
		avatar: String(profile.avatar || ""),
	};
	localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
	for (const listener of listeners) listener({ ...value });
	return value;
}
function reset() {
	localStorage.removeItem(STORAGE_KEY);
	const value = read();
	for (const listener of listeners) listener({ ...value });
	return value;
}
function onChange(listener) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
export default { read, save, reset, onChange };
