import SidebarApp from "./sidebarApp";

const SIDEBAR_APPS_LAST_SECTION = "sidebarAppsLastSection";
let $apps;
let $sidebar;
let currentSection = localStorage.getItem(SIDEBAR_APPS_LAST_SECTION);
const apps = [];
function add(
	icon,
	id,
	title,
	initFunction,
	prepend = false,
	onSelected = () => {},
) {
	currentSection ??= id;
	const app = new SidebarApp(icon, id, title, initFunction, onSelected);
	apps.push(app);
	app.install(prepend);
	if (currentSection === id) {
		setActiveApp(id);
	}
}
function remove(id) {
	const app = apps.find((app) => app.id === id);
	if (!app) return;
	const wasActive = app.active;
	app.remove();
	apps.splice(apps.indexOf(app), 1);
	if (wasActive && apps.length > 0) {
		const preferredApp = apps.find((app) => app.id === currentSection);
		setActiveApp(preferredApp?.id || apps[0].id);
		return;
	}
	if (!apps.length) {
		currentSection = null;
		localStorage.removeItem(SIDEBAR_APPS_LAST_SECTION);
	}
}
function init($el) {
	$sidebar = $el;
	$apps = $sidebar.get(".app-icons-container");
	$apps.addEventListener("click", onclick);
	SidebarApp.init($el, $apps);
}
async function loadApps() {
	add(...(await import("./files")).default);
	add(...(await import("./searchInFiles")).default);
	add(...(await import("./extensions")).default);
	add(...(await import("./notification")).default);
}
function ensureActiveApp() {
	const activeApps = apps.filter((app) => app.active);
	if (activeApps.length === 1) return;
	if (activeApps.length > 1) {
		const preferredActiveApp = activeApps.find(
			(app) => app.id === currentSection,
		);
		setActiveApp(preferredActiveApp?.id || activeApps[0].id);
		return;
	}
	if (apps.length > 0) {
		const preferredApp = apps.find((app) => app.id === currentSection);
		setActiveApp(preferredApp?.id || apps[0].id);
	}
}
function get(id) {
	const app = apps.find((app) => app.id === id);
	return app.container;
}
function onclick(e) {
	const target = e.target;
	const { action, id } = target.dataset;
	if (action !== "sidebar-app") return;
	setActiveApp(id);
}
function setActiveApp(id) {
	const app = apps.find((app) => app.id === id);
	if (!app) return;
	currentSection = id;
	localStorage.setItem(SIDEBAR_APPS_LAST_SECTION, id);
	for (const currentApp of apps) {
		currentApp.active = currentApp.id === id;
	}
}
export default {
	init,
	add,
	get,
	remove,
	loadApps,
	ensureActiveApp,
};
