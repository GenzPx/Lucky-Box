import "./style.scss";
let $statusBar = null;
let hideTimeout = null;
const activeProgress = new Map();
let currentServerId = null;
let currentServerLabel = null;
function ensureStatusBar() {
	if ($statusBar && document.body.contains($statusBar)) {
		return $statusBar;
	}
	$statusBar = (
		<div id="lsp-status-bar" className="lsp-status info">
			<div className="lsp-status-content">
				<span className="lsp-status-icon icon autorenew"></span>
				<div className="lsp-status-text">
					<span className="lsp-status-title"></span>
					<span className="lsp-status-message"></span>
				</div>
				<div className="lsp-status-progress">
					<span className="lsp-status-progress-text"></span>
				</div>
			</div>
			<button
				type="button"
				className="lsp-status-close icon clearclose"
				onclick={hideStatusBar}
				aria-label="Close"
			></button>
		</div>
	);
	const $container = document.querySelector(".notification-item-container");
	if ($container) {
		$container.prepend($statusBar);
	} else {
		document.body.appendChild($statusBar);
	}
	return $statusBar;
}
function buildAggregatedStatus() {
	const items = Array.from(activeProgress.values());
	const taskCount = items.length;
	if (taskCount === 0) {
		return {
			message: "",
			avgProgress: null,
			taskCount: 0,
		};
	}
	const itemsWithProgress = items.filter(
		(item) => typeof item.percentage === "number",
	);
	const avgProgress =
		itemsWithProgress.length > 0
			? Math.round(
					itemsWithProgress.reduce(
						(sum, item) => sum + (item.percentage || 0),
						0,
					) / itemsWithProgress.length,
				)
			: null;
	if (taskCount === 1) {
		const item = items[0];
		const parts = [];
		if (item.message) {
			parts.push(item.message);
		} else if (item.title) {
			parts.push(item.title);
		}
		return {
			message: parts.join(" "),
			avgProgress,
			taskCount,
		};
	}
	const latestWithMessage = items.filter((item) => item.message).pop();
	const message = latestWithMessage
		? `${taskCount} tasks: ${latestWithMessage.message}`
		: `${taskCount} tasks running`;
	return {
		message,
		avgProgress,
		taskCount,
	};
}
function updateStatusBarDisplay() {
	const bar = $statusBar;
	if (!bar) return;
	const { message, avgProgress, taskCount } = buildAggregatedStatus();
	if (taskCount === 0) {
		hideStatusBar();
		return;
	}
	const $title = bar.querySelector(".lsp-status-title");
	const $message = bar.querySelector(".lsp-status-message");
	const $progressText = bar.querySelector(".lsp-status-progress-text");
	const $progressContainer = bar.querySelector(".lsp-status-progress");
	const $icon = bar.querySelector(".lsp-status-icon");
	if ($title) $title.textContent = currentServerLabel || "";
	if ($message) $message.textContent = message;
	if (avgProgress !== null && $progressText && $progressContainer) {
		$progressText.textContent = `${avgProgress}%`;
		$progressContainer.style.display = "";
	} else if ($progressContainer) {
		$progressContainer.style.display = "none";
	}
	if ($icon) {
		$icon.className = "lsp-status-icon icon autorenew";
	}
	bar.className = "lsp-status info";
	bar.classList.remove("hiding");
}
function hideStatusBar() {
	if (hideTimeout) {
		clearTimeout(hideTimeout);
		hideTimeout = null;
	}
	if ($statusBar) {
		$statusBar.classList.add("hiding");
		setTimeout(() => {
			if ($statusBar) {
				$statusBar.remove();
				$statusBar = null;
			}
		}, 300);
	}
}
export function showLspStatus(options) {
	const {
		message,
		icon = "autorenew",
		type = "info",
		duration = 0,
		showProgress = false,
		progress,
		title,
		id,
	} = options;
	if (hideTimeout) {
		clearTimeout(hideTimeout);
		hideTimeout = null;
	}
	if (id && id.includes("-progress-")) {
		const serverMatch = id.match(/^(.+?)-progress-/);
		if (serverMatch) {
			currentServerId = serverMatch[1];
			currentServerLabel = title || currentServerId;
		}
		activeProgress.set(id, {
			title: title || "",
			message: message || "",
			percentage: progress,
		});
		ensureStatusBar();
		updateStatusBarDisplay();
		return id;
	}
	const bar = ensureStatusBar();
	const $title = bar.querySelector(".lsp-status-title");
	const $message = bar.querySelector(".lsp-status-message");
	const $progressText = bar.querySelector(".lsp-status-progress-text");
	const $progressContainer = bar.querySelector(".lsp-status-progress");
	const $icon = bar.querySelector(".lsp-status-icon");
	if ($title) $title.textContent = title || "";
	if ($message) $message.textContent = message;
	const hasProgress = showProgress && typeof progress === "number";
	if (hasProgress && $progressText && $progressContainer) {
		$progressText.textContent = `${Math.round(progress)}%`;
		$progressContainer.style.display = "";
	} else if ($progressContainer) {
		$progressContainer.style.display = "none";
	}
	if ($icon) {
		$icon.className = `lsp-status-icon icon ${icon}`;
	}
	bar.className = `lsp-status ${type}`;
	bar.classList.remove("hiding");
	if (duration !== false) {
		const ms = duration || 5000;
		hideTimeout = window.setTimeout(() => {
			if (activeProgress.size === 0) {
				hideStatusBar();
			}
		}, ms);
	}
	return id;
}
export function hideStatus(id) {
	if (activeProgress.has(id)) {
		activeProgress.delete(id);
		if (activeProgress.size === 0) {
			hideTimeout = window.setTimeout(() => {
				hideStatusBar();
			}, 500);
		} else {
			updateStatusBarDisplay();
		}
	}
}
export function hideLspStatus() {
	activeProgress.clear();
	hideStatusBar();
}
export function updateLspStatus(options) {
	const { id, message, progress } = options;
	if (!id || !activeProgress.has(id)) {
		return null;
	}
	const item = activeProgress.get(id);
	if (item) {
		if (message !== undefined) item.message = message;
		if (progress !== undefined) item.percentage = progress;
		activeProgress.set(id, item);
		updateStatusBarDisplay();
	}
	return id;
}
export function isLspStatusVisible() {
	return $statusBar !== null && document.body.contains($statusBar);
}
export function getActiveStatusCount() {
	return activeProgress.size;
}
export function hasStatus(id) {
	return activeProgress.has(id);
}
export default {
	show: showLspStatus,
	hide: hideLspStatus,
	hideById: hideStatus,
	update: updateLspStatus,
	isVisible: isLspStatusVisible,
	getActiveCount: getActiveStatusCount,
	has: hasStatus,
};
