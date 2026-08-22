export default async function CustomTheme(...args) {
	const customTheme = (await import("./customTheme")).default;
	customTheme();
}
