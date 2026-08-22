import fsOperation from "fileSystem";
import settingsPage from "components/settingsPage";
import toast from "components/toast";
import alert from "dialogs/alert";
import confirm from "dialogs/confirm";
import loader from "dialogs/loader";
import config from "lib/config";
import appSettings from "lib/settings";
import FileBrowser from "pages/fileBrowser";
import helpers from "utils/helpers";
import Uri from "utils/Uri";
import Url from "utils/Url";

const BACKUP_VERSION = 2;
const CRC32_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let i = 0; i < 256; i++) {
		let crc = i;
		for (let j = 0; j < 8; j++) {
			crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
		}
		table[i] = crc >>> 0;
	}
	return table;
})();
function generateChecksum(data) {
	let crc = 0xffffffff;
	for (let i = 0; i < data.length; i++) {
		const byte = data.charCodeAt(i) & 0xff;
		crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
	}
	return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}
function validateBackupStructure(backup) {
	const errors = [];
	const warnings = [];
	if (!backup || typeof backup !== "object") {
		errors.push(strings["backup not valid object"]);
		return {
			valid: false,
			errors,
			warnings,
			isLegacy: false,
		};
	}
	const isLegacy = !backup.version;
	if (isLegacy) {
		const hasData =
			backup.settings || backup.keyBindings || backup.installedPlugins;
		if (!hasData) {
			errors.push(strings["backup no data"]);
		}
		warnings.push(strings["backup legacy warning"]);
	} else {
		if (backup.version >= 2) {
			if (!backup.metadata) {
				warnings.push(strings["backup missing metadata"]);
			}
			if (backup.checksum) {
				try {
					const dataToCheck = JSON.stringify({
						settings: backup.settings,
						keyBindings: backup.keyBindings,
						installedPlugins: backup.installedPlugins,
					});
					const expectedChecksum = generateChecksum(dataToCheck);
					if (backup.checksum !== expectedChecksum) {
						warnings.push(strings["backup checksum mismatch"]);
					}
				} catch (e) {
					warnings.push(strings["backup checksum verify failed"]);
				}
			}
		}
	}
	if (backup.settings !== undefined && typeof backup.settings !== "object") {
		errors.push(strings["backup invalid settings"]);
	}
	if (
		backup.keyBindings !== undefined &&
		typeof backup.keyBindings !== "object"
	) {
		errors.push(strings["backup invalid keybindings"]);
	}
	if (
		backup.installedPlugins !== undefined &&
		!Array.isArray(backup.installedPlugins)
	) {
		errors.push(strings["backup invalid plugins"]);
	}
	return {
		valid: errors.length === 0,
		errors,
		warnings,
		isLegacy,
	};
}
function formatDateForFilename(date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	return `${year}${month}${day}_${hours}${minutes}`;
}
function backupRestore() {
	const title =
		strings.backup.capitalize() + "/" + strings.restore.capitalize();
	const items = [
		{
			key: "backup",
			text: strings.backup.capitalize(),
			icon: "file_downloadget_app",
			chevron: true,
		},
		{
			key: "restore",
			text: strings.restore.capitalize(),
			icon: "historyrestore",
			chevron: true,
		},
		{
			note: strings["backup/restore note"],
		},
	];
	return settingsPage(title, items, callback, undefined, {
		preserveOrder: true,
		pageClassName: "detail-settings-page",
		listClassName: "detail-settings-list",
		groupByDefault: true,
	});
	function callback(key) {
		switch (key) {
			case "backup":
				backup();
				return;
			case "restore":
				restore();
				return;
			default:
				break;
		}
	}
	async function backup() {
		const loaderDialog = loader.create(
			strings.backup.capitalize(),
			strings["preparing backup"],
		);
		try {
			loaderDialog.show();
			loaderDialog.setMessage(strings["collecting settings"]);
			const settings = appSettings.value;
			loaderDialog.setMessage(strings["collecting key bindings"]);
			let keyBindings = null;
			try {
				const keybindingsFS = fsOperation(KEYBINDING_FILE);
				if (await keybindingsFS.exists()) {
					keyBindings = await keybindingsFS.readFile("json");
				}
			} catch (error) {
				console.warn("Could not read keybindings:", error);
			}
			loaderDialog.setMessage(strings["collecting plugins"]);
			const installedPlugins = [];
			const pluginDetails = [];
			try {
				const pluginsDir = fsOperation(window.PLUGIN_DIR);
				if (await pluginsDir.exists()) {
					const plugins = await pluginsDir.lsDir();
					for (const plugin of plugins) {
						try {
							const pluginJsonPath = Url.join(
								window.PLUGIN_DIR,
								plugin.name,
								"plugin.json",
							);
							const pluginJson =
								await fsOperation(pluginJsonPath).readFile("json");
							const pluginInfo = {
								id: pluginJson.id || plugin.name,
								name: pluginJson.name || plugin.name,
								version: pluginJson.version || "unknown",
								source: pluginJson.source || null,
							};
							pluginDetails.push(pluginInfo);
							if (pluginJson.source) {
								installedPlugins.push(pluginJson.source);
							} else {
								installedPlugins.push(pluginJson.id || plugin.name);
							}
						} catch (error) {
							installedPlugins.push(plugin.name);
							pluginDetails.push({
								id: plugin.name,
								name: plugin.name,
								version: "unknown",
								source: null,
							});
						}
					}
				}
			} catch (error) {
				console.warn("Could not read plugins directory:", error);
			}
			loaderDialog.hide();
			const { url } = await FileBrowser("folder", strings["select folder"]);
			loaderDialog.show();
			loaderDialog.setMessage(
				strings["creating backup"] || "Creating backup file...",
			);
			const timestamp = formatDateForFilename(new Date());
			const backupFilename = `Acode_backup_${timestamp}.backup`;
			const backupDirname = "Backup";
			const backupDir = Url.join(url, backupDirname);
			const backupFile = Url.join(backupDir, backupFilename);
			const backupStorageFS = fsOperation(url);
			const backupDirFS = fsOperation(backupDir);
			const backupFileFS = fsOperation(backupFile);
			if (!(await backupDirFS.exists())) {
				await backupStorageFS.createDirectory(backupDirname);
			}
			if (!(await backupFileFS.exists())) {
				await backupDirFS.createFile(backupFilename);
			}
			const backupData = {
				settings,
				keyBindings,
				installedPlugins,
			};
			const checksum = generateChecksum(JSON.stringify(backupData));
			const backupObject = {
				version: BACKUP_VERSION,
				metadata: {
					createdAt: new Date().toISOString(),
					appVersion: BuildInfo?.version || "unknown",
					pluginCount: installedPlugins.length,
					hasSettings: !!settings,
					hasKeyBindings: !!keyBindings,
				},
				checksum,
				settings,
				keyBindings,
				installedPlugins,
				pluginDetails,
			};
			const backupString = JSON.stringify(backupObject, null, 2);
			await backupFileFS.writeFile(backupString);
			loaderDialog.destroy();
			const message = [
				strings["backup successful"],
				`<br><small>${Uri.getVirtualAddress(backupFile)}</small><br>`,
				`<strong>${strings.settings || "Settings"}:</strong> ✓`,
				`<strong>${strings["key bindings"] || "Key Bindings"}:</strong> ${keyBindings ? "✓" : "-"}`,
				`<strong>${strings.plugins || "Plugins"}:</strong> ${installedPlugins.length}`,
			].join("<br>");
			alert(strings.success.toUpperCase(), message);
		} catch (error) {
			loaderDialog.destroy();
			console.error("Backup error:", error);
			alert(
				strings.error.toUpperCase(),
				`${strings["error details"] || "Error"}: ${error.message || error}`,
			);
		}
	}
	function restore() {
		sdcard.openDocumentFile(
			(data) => {
				backupRestore.restore(data.uri);
			},
			(error) => {
				console.error("File picker error:", error);
				toast(strings.error || "Error selecting file");
			},
			"application/octet-stream",
		);
	}
}
backupRestore.restore = async function (url) {
	const loaderDialog = loader.create(
		strings.restore.capitalize(),
		strings["please wait..."],
	);
	const restoreResults = {
		settings: {
			attempted: false,
			success: false,
			error: null,
		},
		keyBindings: {
			attempted: false,
			success: false,
			error: null,
		},
		plugins: {
			attempted: false,
			success: [],
			failed: [],
			skipped: [],
		},
	};
	try {
		loaderDialog.show();
		const fs = fsOperation(url);
		let backupContent;
		try {
			backupContent = await fs.readFile("utf8");
		} catch (error) {
			throw new Error(`Could not read backup file: ${error.message}`);
		}
		let backup;
		try {
			backup = JSON.parse(backupContent);
		} catch (error) {
			loaderDialog.destroy();
			alert(strings.error.toUpperCase(), strings["invalid backup file"]);
			return;
		}
		loaderDialog.setMessage(strings["validating backup"]);
		const validation = validateBackupStructure(backup);
		if (!validation.valid) {
			loaderDialog.destroy();
			const errorMessage = [
				strings["invalid backup file"],
				"",
				`${strings["issues found"]}:`,
				...validation.errors.map((e) => `• ${e}`),
			].join("\n");
			alert(strings.error.toUpperCase(), errorMessage);
			return;
		}
		loaderDialog.hide();
		const backupInfo = backup.metadata || {};
		const confirmParts = [
			`<strong>${strings["restore will include"]}</strong><br><br>`,
			`${strings.settings}: ${backup.settings ? strings.yes : strings.no}<br>`,
			`${strings["key bindings"]}: ${backup.keyBindings ? strings.yes : strings.no}<br>`,
			`${strings.plugins}: ${backup.installedPlugins?.length || 0}<br>`,
		];
		if (backupInfo.createdAt) {
			confirmParts.push(
				`<br><small>${strings["last modified"]}: ${new Date(backupInfo.createdAt).toLocaleString()}</small><br>`,
			);
		}
		if (validation.warnings && validation.warnings.length > 0) {
			confirmParts.push(`<br><strong>${strings.warning}:</strong><br>`);
			for (const warning of validation.warnings) {
				confirmParts.push(`- ${warning}<br>`);
			}
		}
		confirmParts.push(`<br><strong>${strings["restore warning"]}</strong>`);
		const shouldContinue = await confirm(
			strings.restore.capitalize(),
			confirmParts.join(""),
			true,
		);
		if (!shouldContinue) {
			return;
		}
		const selectedOptions = [];
		if (backup.settings) selectedOptions.push("settings");
		if (backup.keyBindings) selectedOptions.push("keyBindings");
		if (backup.installedPlugins?.length) selectedOptions.push("plugins");
		loaderDialog.show();
		if (selectedOptions.includes("keyBindings") && backup.keyBindings) {
			restoreResults.keyBindings.attempted = true;
			loaderDialog.setMessage(strings["restoring key bindings"]);
			try {
				const keybindingsFS = fsOperation(window.KEYBINDING_FILE);
				if (!(await keybindingsFS.exists())) {
					const parentDir = fsOperation(DATA_STORAGE);
					await parentDir.createFile(".key-bindings.json");
				}
				const text = JSON.stringify(backup.keyBindings, undefined, 2);
				await keybindingsFS.writeFile(text);
				restoreResults.keyBindings.success = true;
			} catch (error) {
				console.error("Error restoring key bindings:", error);
				restoreResults.keyBindings.error = error.message;
			}
		}
		if (
			selectedOptions.includes("plugins") &&
			Array.isArray(backup.installedPlugins) &&
			backup.installedPlugins.length > 0
		) {
			restoreResults.plugins.attempted = true;
			const { default: installPlugin } = await import("lib/installPlugin");
			const totalPlugins = backup.installedPlugins.length;
			let currentPlugin = 0;
			for (const id of backup.installedPlugins) {
				currentPlugin++;
				if (!id) {
					restoreResults.plugins.skipped.push({
						id: "(empty)",
						reason: "Empty plugin ID",
					});
					continue;
				}
				const pluginName =
					backup.pluginDetails?.find((p) => p.id === id || p.source === id)
						?.name || id;
				loaderDialog.setMessage(
					`${strings["restoring plugins"]} (${currentPlugin}/${totalPlugins}): ${pluginName}`,
				);
				try {
					if (
						id.startsWith("content://") ||
						id.startsWith("file://") ||
						id.includes("/")
					) {
						try {
							const sourceFS = fsOperation(id);
							if (!(await sourceFS.exists())) {
								restoreResults.plugins.skipped.push({
									id: pluginName,
									reason: strings["source not found"],
								});
								continue;
							}
							await installPlugin(id);
							restoreResults.plugins.success.push(pluginName);
						} catch (error) {
							restoreResults.plugins.failed.push({
								id: pluginName,
								reason: error.message,
							});
						}
					} else {
						const pluginUrl = Url.join(config.API_BASE, `plugin/${id}`);
						let remotePlugin = null;
						try {
							remotePlugin = await fsOperation(pluginUrl).readFile("json");
						} catch (error) {
							restoreResults.plugins.failed.push({
								id: pluginName,
								reason: strings["plugin not found"],
							});
							continue;
						}
						if (remotePlugin) {
							let purchaseToken = null;
							const isPaid = Number.parseFloat(remotePlugin.price) > 0;
							if (isPaid) {
								try {
									const [product] = await helpers.promisify(iap.getProducts, [
										remotePlugin.sku,
									]);
									if (product) {
										const purchases = await helpers.promisify(iap.getPurchases);
										const purchase = purchases.find((p) =>
											p.productIds.includes(product.productId),
										);
										purchaseToken = purchase?.purchaseToken;
									}
									if (!purchaseToken) {
										restoreResults.plugins.skipped.push({
											id: pluginName,
											reason: strings["paid plugin skipped"],
										});
										continue;
									}
								} catch (error) {
									restoreResults.plugins.skipped.push({
										id: pluginName,
										reason: `Paid plugin - ${error.message}`,
									});
									continue;
								}
							}
							try {
								await installPlugin(id, remotePlugin.name, purchaseToken);
								restoreResults.plugins.success.push(pluginName);
							} catch (error) {
								restoreResults.plugins.failed.push({
									id: pluginName,
									reason: error.message,
								});
							}
						}
					}
				} catch (error) {
					console.error(`Error restoring plugin ${id}:`, error);
					restoreResults.plugins.failed.push({
						id: pluginName,
						reason: error.message,
					});
				}
			}
		}
		if (selectedOptions.includes("settings") && backup.settings) {
			restoreResults.settings.attempted = true;
			loaderDialog.setMessage(strings["restoring settings"]);
			try {
				const currentSettings = appSettings.value;
				const restoredSettings = backup.settings;
				const validSettings = {};
				for (const key of Object.keys(currentSettings)) {
					if (key in restoredSettings) {
						if (typeof restoredSettings[key] === typeof currentSettings[key]) {
							validSettings[key] = restoredSettings[key];
						}
					}
				}
				await appSettings.update(validSettings, false);
				restoreResults.settings.success = true;
			} catch (error) {
				console.error("Error restoring settings:", error);
				restoreResults.settings.error = error.message;
			}
		}
		loaderDialog.destroy();
		const summaryParts = [
			`<strong>${strings["restore completed"]}</strong><br><br>`,
		];
		if (restoreResults.settings.attempted) {
			const status = restoreResults.settings.success
				? `✓ ${strings.restored}`
				: `✗ ${strings.failed}`;
			summaryParts.push(`${strings.settings}: ${status}<br>`);
		}
		if (restoreResults.keyBindings.attempted) {
			const status = restoreResults.keyBindings.success
				? `✓ ${strings.restored}`
				: `✗ ${strings.failed}`;
			summaryParts.push(`${strings["key bindings"]}: ${status}<br>`);
		}
		if (restoreResults.plugins.attempted) {
			summaryParts.push(`<br><strong>${strings.plugins}</strong><br>`);
			if (restoreResults.plugins.success.length > 0) {
				summaryParts.push(
					`✓ ${strings.restored}: ${restoreResults.plugins.success.length}<br>`,
				);
			}
			if (restoreResults.plugins.failed.length > 0) {
				summaryParts.push(
					`✗ ${strings.failed}: ${restoreResults.plugins.failed.length}<br>`,
				);
				for (const f of restoreResults.plugins.failed.slice(0, 3)) {
					summaryParts.push(`<small>- ${f.id}: ${f.reason}</small><br>`);
				}
				if (restoreResults.plugins.failed.length > 3) {
					summaryParts.push(
						`<small>...${strings.more || "and"} ${restoreResults.plugins.failed.length - 3} ${strings.more || "more"}</small><br>`,
					);
				}
			}
			if (restoreResults.plugins.skipped.length > 0) {
				summaryParts.push(
					`${strings.skipped}: ${restoreResults.plugins.skipped.length}<br>`,
				);
				for (const s of restoreResults.plugins.skipped.slice(0, 3)) {
					summaryParts.push(`<small>- ${s.id}: ${s.reason}</small><br>`);
				}
				if (restoreResults.plugins.skipped.length > 3) {
					summaryParts.push(
						`<small>...${strings.more} ${restoreResults.plugins.skipped.length - 3} ${strings.more}</small><br>`,
					);
				}
			}
		}
		summaryParts.push(`<br>${strings["reload to apply"]}`);
		const shouldReload = await confirm(
			strings["restore completed"],
			summaryParts.join(""),
			true,
		);
		if (shouldReload) {
			location.reload();
		}
	} catch (err) {
		loaderDialog.destroy();
		console.error("Restore error:", err);
		alert(
			strings.error.toUpperCase(),
			`${strings["error details"]}: ${err.message || err}`,
		);
	}
};
export default backupRestore;
