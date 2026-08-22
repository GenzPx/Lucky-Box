import "./style.scss";
import fsOperation from "fileSystem";
import toast from "components/toast";
import confirm from "dialogs/confirm";
import loader from "dialogs/loader";
import Ref from "html-tag-js/ref";
import actionStack from "lib/actionStack";
import auth, { loginEvents } from "lib/auth";
import config from "lib/config";
import helpers from "utils/helpers";
import Url from "utils/Url";

let $sidebar;
let preventSlideTests = [];
const events = {
	show: [],
	hide: [],
};
function create($container, $toggler) {
	let { innerWidth } = window;
	const START_THRESHOLD = config.SIDEBAR_SLIDE_START_THRESHOLD_PX;
	const MIN_WIDTH = 250;
	const MAX_WIDTH = () => innerWidth * 0.7;
	const resizeBar = Ref();
	const userAvatar = Ref();
	const userContextMenu = Ref();
	$container = $container || app;
	let mode = innerWidth > 750 ? "tab" : "phone";
	let width = +(localStorage.sideBarWidth || MIN_WIDTH);
	const eventOptions = {
		passive: false,
	};
	const $el = (
		<div id="sidebar" className={mode}>
			<div className="apps">
				<div className="app-icons-container"></div>
				<div
					ref={userAvatar}
					className="user-icon-container"
					onclick={handleUserIconClick}
				>
					<span className="icon account_circle"></span>
				</div>
			</div>
			<div className="container"></div>
			<div
				className="resize-bar w-resize"
				onmousedown={onresize}
				ontouchstart={onresize}
			></div>

			<div ref={userContextMenu} className="user-menu">
				<div className="user-menu-header">
					<div className="user-menu-name"></div>
					<div className="user-menu-email"></div>
				</div>
				{}
				<div className="user-menu-item" onclick={handleLogout}>
					<span className="icon logout"></span>
					{strings.logout}
				</div>
			</div>
		</div>
	);
	const mask = <span className="mask" onclick={hide}></span>;
	const touch = {
		startX: 0,
		totalX: 0,
		endX: 0,
		startY: 0,
		totalY: 0,
		endY: 0,
		target: null,
	};
	let openedFolders = [];
	let resizeTimeout = null;
	let setWidthTimeout = null;
	let hideTimeout = null;
	let wasOpenInTab = false;
	$toggler?.addEventListener("click", toggle);
	$container.addEventListener("touchstart", ontouchstart, eventOptions);
	window.addEventListener("resize", onWindowResize);
	if (mode === "tab" && localStorage.sidebarShown === "1") {
		show();
	}
	loginEvents.addListener(updateSidebarAvatar);
	async function handleUserIconClick(e) {
		try {
			loader.create(strings["login"], strings["loading..."]);
			let user = await auth.getLoggedInUser();
			if (!user) {
				const confirmation = await confirm(
					strings.confirm,
					strings["confirm-login"],
				);
				if (!confirmation) {
					return;
				}
				loader.show();
				await auth.login();
				user = await auth.getLoggedInUser();
				if (!user) {
					return;
				}
			}
			const menu = userContextMenu.el;
			const isActive = menu.classList.toggle("active");
			if (isActive) {
				const menuName = userContextMenu.el.querySelector(".user-menu-name");
				const menuEmail = userContextMenu.el.querySelector(".user-menu-email");
				if (menuName) {
					menuName.content = (
						<div
							style={{
								display: "flex",
							}}
						>
							{user.name}
							{Boolean(user.verified) && (
								<span className="icon verified badge"></span>
							)}
							{Boolean(user.acode_pro) && <span className="badge">Pro</span>}
						</div>
					);
				}
				if (menuEmail) {
					menuEmail.textContent = user.email || "";
				}
				setTimeout(() => {
					document.addEventListener("click", handleClickOutside);
				}, 10);
			} else {
				document.removeEventListener("click", handleClickOutside);
			}
		} catch (error) {
			console.error("Error checking login status:", error);
		} finally {
			loader.destroy();
		}
	}
	function handleClickOutside(e) {
		if (
			!userContextMenu.el.contains(e.target) &&
			e.target !== userAvatar.el &&
			!userAvatar.el.contains(e.target)
		) {
			userContextMenu.el.classList.remove("active");
			document.removeEventListener("click", handleClickOutside);
		}
	}
	async function handleLogout() {
		loader.create(strings["logout"], strings["loading..."]);
		loader.show();
		try {
			const user = await auth.getLoggedInUser();
			const success = await auth.logout();
			if (success) {
				userContextMenu.el.classList.remove("active");
				document.removeEventListener("click", handleClickOutside);
				updateSidebarAvatar();
				toast("Logged out successfully");
				try {
					const avatarFile = await getUserAvatar(user, false);
					if (avatarFile) {
						await fsOperation(avatarFile).delete();
					}
				} catch {}
			} else {
				toast("Failed to logout");
			}
		} catch (error) {
			console.error("Error during logout:", error);
		} finally {
			loader.destroy();
		}
	}
	async function updateSidebarAvatar() {
		const defaultAvatar = <span className="icon account_circle" />;
		const user = await auth.getLoggedInUser();
		userAvatar.content = defaultAvatar;
		if (!user) {
			return;
		}
		defaultAvatar.classList.add("avatar-loading");
		const img = <img alt="User avatar" className="avatar" />;
		const avatarFile = await getUserAvatar(user);
		img.src = avatarFile
			? await helpers.toInternalUri(avatarFile)
			: generateInitialsAvatar(user.name);
		img.onload = () => defaultAvatar.replaceWith(img);
	}
	async function getUserAvatar(user, download = true) {
		let avatarUrl = user.avatar_url;
		if (!avatarUrl) {
			if (!user.github) {
				return null;
			}
			avatarUrl = `https://avatars.githubusercontent.com/${user.github}`;
		}
		const hash = avatarUrl.hashCode();
		const cacheFileName = `user_avatar_${hash}`;
		const cacheFile = Url.join(CACHE_STORAGE, cacheFileName);
		if (!(await fsOperation(cacheFile).exists())) {
			if (!download) {
				return null;
			}
			const blob = await helpers.promisify(
				cordova.plugin.http.sendRequest,
				avatarUrl,
				{
					responseType: "blob",
				},
			);
			await fsOperation(CACHE_STORAGE).createFile(cacheFileName, blob.data);
		}
		return cacheFile;
	}
	function generateInitialsAvatar(name) {
		const nameParts = name.split(" ");
		const initials =
			nameParts.length >= 2
				? `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase()
				: nameParts[0][0].toUpperCase();
		const canvas = document.createElement("canvas");
		canvas.width = 100;
		canvas.height = 100;
		const ctx = canvas.getContext("2d");
		const colors = [
			"#2196F3",
			"#9C27B0",
			"#E91E63",
			"#009688",
			"#4CAF50",
			"#FF9800",
		];
		ctx.fillStyle =
			colors[
				name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
					colors.length
			];
		ctx.fillRect(0, 0, 100, 100);
		ctx.fillStyle = "#ffffff";
		ctx.font = "bold 40px Arial";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(initials, 50, 50);
		return canvas.toDataURL();
	}
	function onWindowResize() {
		clearTimeout(resizeTimeout);
		resizeTimeout = setTimeout(() => {
			const { innerWidth: currentWidth } = window;
			if (innerWidth === currentWidth) return;
			const wasActivated = $el.activated;
			const previousMode = mode;
			const shouldRestoreInTab =
				(previousMode === "tab" &&
					wasActivated &&
					localStorage.sidebarShown === "1") ||
				(previousMode === "phone" &&
					(wasOpenInTab ||
						(wasActivated && localStorage.sidebarShown === "1")));
			if (previousMode === "tab") {
				wasOpenInTab = wasActivated && localStorage.sidebarShown === "1";
			}
			if (wasActivated) {
				if (previousMode === "phone") {
					clearTimeout(hideTimeout);
					actionStack.remove("sidebar");
					$el.style.transform = null;
					$el.classList.remove("show");
					mask.remove();
					document.ontouchstart = null;
					resetState();
					$container.style.overflow = null;
					onhide();
					openedFolders.map(($) => ($.onscroll = null));
					openedFolders = [];
				} else {
					root.style.removeProperty("margin-left");
					root.style.removeProperty("width");
					$el.style.maxWidth = null;
					$el.style.transition = null;
				}
				$el.remove();
			} else {
				hide(true);
			}
			innerWidth = currentWidth;
			$el.classList.remove(mode);
			mode = innerWidth > 750 ? "tab" : "phone";
			$el.classList.add(mode);
			let shouldShow = false;
			if (mode === "tab") {
				shouldShow = shouldRestoreInTab || localStorage.sidebarShown === "1";
			} else {
				shouldShow = false;
			}
			if (shouldShow) {
				$el.style.animationDuration = "0s";
				show();
				setTimeout(() => {
					$el.style.animationDuration = null;
				}, 100);
			} else {
				$el.activated = false;
				localStorage.sidebarShown = 0;
			}
		}, 300);
	}
	function toggle() {
		if ($el.activated) return hide(true);
		show();
	}
	function show() {
		clearTimeout(hideTimeout);
		localStorage.sidebarShown = 1;
		$el.activated = true;
		$el.onclick = null;
		if (mode === "phone") {
			resizeBar.style.display = "none";
			$el.onshow();
			app.append($el, mask);
			$el.classList.add("show");
			document.ontouchstart = ontouchstart;
			actionStack.push({
				id: "sidebar",
				action: hideMaster,
			});
		} else {
			setWidth(width);
			resizeBar.style.display = "block";
			app.append($el);
			$el.onclick = () => {
				if (!$el.textContent) acode.exec("open-folder");
			};
		}
		onshow();
	}
	function hide(hideIfTab = false) {
		localStorage.sidebarShown = 0;
		wasOpenInTab = false;
		if (mode === "phone") {
			actionStack.remove("sidebar");
			hideMaster();
		} else if (hideIfTab) {
			$el.activated = false;
			root.style.removeProperty("margin-left");
			root.style.removeProperty("width");
			$el.style.maxWidth = null;
			$el.style.transition = null;
			$el.remove();
		}
	}
	function hideMaster() {
		$el.style.transform = null;
		$el.classList.remove("show");
		wasOpenInTab = false;
		clearTimeout(hideTimeout);
		hideTimeout = setTimeout(() => {
			$el.activated = false;
			mask.remove();
			$el.remove();
			$container.style.overflow = null;
			onhide();
		}, 300);
		document.ontouchstart = null;
		resetState();
		openedFolders.map(($) => ($.onscroll = null));
		openedFolders = [];
	}
	async function onshow() {
		hideEditorNativeSelectionHandles();
		if ($el.onshow) $el.onshow.call($el);
		events.show.forEach((fn) => fn());
	}
	function onhide() {
		if ($el.onhide) $el.onhide.call($el);
		events.hide.forEach((fn) => fn());
	}
	function hideEditorNativeSelectionHandles() {
		const editor = window.editorManager?.editor;
		if (!editor) return;
		try {
			editor.contentDOM?.blur();
		} catch (_) {}
		try {
			document.getSelection()?.removeAllRanges();
		} catch (error) {
			console.warn("Failed to clear native text selection.", error);
		}
	}
	function ontouchstart(e) {
		const { target } = e;
		const { clientX, clientY } = getClientCoords(e);
		if (preventSlideTests.find((test) => test(target))) return;
		if (mode === "tab") return;
		$el.style.transition = "none";
		touch.startX = clientX;
		touch.startY = clientY;
		touch.target = target;
		if ($el.activated && !$el.contains(target) && target !== mask) {
			return;
		} else if (
			(!$el.activated && touch.startX > START_THRESHOLD) ||
			target === $toggler
		) {
			return;
		}
		document.addEventListener("touchmove", ontouchmove, eventOptions);
		document.addEventListener("touchend", ontouchend, eventOptions);
	}
	function onresize(e) {
		const { clientX } = getClientCoords(e);
		let deltaX = 0;
		const onMove = (e) => {
			const { clientX: currentX } = getClientCoords(e);
			deltaX = currentX - clientX;
			resize(deltaX);
		};
		const onEnd = () => {
			const newWidth = width + deltaX;
			if (newWidth <= MIN_WIDTH) width = MIN_WIDTH;
			else if (newWidth >= MAX_WIDTH()) width = MAX_WIDTH();
			else width = newWidth;
			localStorage.sideBarWidth = width;
			document.removeEventListener("touchmove", onMove, eventOptions);
			document.removeEventListener("mousemove", onMove, eventOptions);
			document.removeEventListener("touchend", onEnd, eventOptions);
			document.removeEventListener("mouseup", onEnd, eventOptions);
			document.removeEventListener("mouseleave", onEnd, eventOptions);
			document.removeEventListener("touchcancel", onEnd, eventOptions);
		};
		document.addEventListener("touchmove", onMove, eventOptions);
		document.addEventListener("mousemove", onMove, eventOptions);
		document.addEventListener("touchend", onEnd, eventOptions);
		document.addEventListener("mouseup", onEnd, eventOptions);
		document.addEventListener("mouseleave", onEnd, eventOptions);
		document.addEventListener("touchcancel", onEnd, eventOptions);
		return;
	}
	function resize(deltaX) {
		const newWidth = width + deltaX;
		if (newWidth >= MAX_WIDTH()) return;
		if (newWidth <= MIN_WIDTH) return;
		setWidth(newWidth);
	}
	function ontouchmove(e) {
		e.preventDefault();
		const { clientX, clientY } = getClientCoords(e);
		touch.endX = clientX;
		touch.endY = clientY;
		touch.totalX = touch.endX - touch.startX;
		touch.totalY = touch.endY - touch.startY;
		let width = $el.getWidth();
		if (
			!$el.activated &&
			touch.totalX < width &&
			touch.startX < START_THRESHOLD
		) {
			if (!$el.isConnected) {
				app.append($el, mask);
				$container.style.overflow = "hidden";
			}
			$el.style.transform = `translate3d(${-(width - touch.totalX)}px, 0, 0)`;
		} else if (touch.totalX < 0 && $el.activated) {
			$el.style.transform = `translate3d(${touch.totalX}px, 0, 0)`;
		}
	}
	function ontouchend(e) {
		if (e.target !== mask && touch.totalX === 0) return resetState();
		else if (e.target === mask && touch.totalX === 0) return hide();
		e.preventDefault();
		const threshold = $el.getWidth() / 3;
		if (
			($el.activated && touch.totalX > -threshold) ||
			(!$el.activated && touch.totalX >= threshold)
		) {
			lclShow();
		} else if (
			(!$el.activated && touch.totalX < threshold) ||
			($el.activated && touch.totalX <= -threshold)
		) {
			hide();
		}
		function lclShow() {
			onshow();
			$el.activated = true;
			$el.style.transform = `translate3d(0, 0, 0)`;
			document.addEventListener("touchstart", ontouchstart, eventOptions);
			actionStack.remove("sidebar");
			actionStack.push({
				id: "sidebar",
				action: hideMaster,
			});
			resetState();
		}
	}
	function resetState() {
		touch.totalY = 0;
		touch.startY = 0;
		touch.endY = 0;
		touch.totalX = 0;
		touch.startX = 0;
		touch.endX = 0;
		touch.target = null;
		$el.style.transition = null;
		document.removeEventListener("touchmove", ontouchmove, eventOptions);
		document.removeEventListener("touchend", ontouchend, eventOptions);
	}
	function setWidth(width) {
		$el.style.transition = "none";
		$el.style.maxWidth = width + "px";
		root.style.marginLeft = width + "px";
		root.style.width = `calc(100% - ${width}px)`;
		clearTimeout(setWidthTimeout);
		setWidthTimeout = setTimeout(() => {
			const editor = editorManager?.editor;
			if (typeof editor?.resize === "function") {
				editor.resize(true);
			} else {
				editor?.requestMeasure?.();
			}
		}, 300);
	}
	function getClientCoords(e) {
		const { clientX, clientY } = (e.touches ?? [])[0] ?? e;
		return {
			clientX,
			clientY,
		};
	}
	$el.show = show;
	$el.hide = hide;
	$el.toggle = toggle;
	$el.onshow = () => {};
	$el.getWidth = function () {
		const width = innerWidth * 0.7;
		return mode === "phone" ? (width >= 350 ? 350 : width) : MIN_WIDTH;
	};
	return $el;
}
function Sidebar({ container, toggler }) {
	$sidebar = $sidebar ?? create(container, toggler);
	return $sidebar;
}
Sidebar.hide = () => $sidebar?.hide();
Sidebar.show = () => $sidebar?.show();
Sidebar.toggle = () => $sidebar?.toggle();
Sidebar.on = (event, callback) => {
	if (!events[event]) return;
	events[event].push(callback);
};
Sidebar.off = (event, callback) => {
	if (!events[event]) return;
	events[event] = events[event].filter((cb) => cb !== callback);
};
Sidebar.el = null;
Object.defineProperty(Sidebar, "el", {
	get() {
		return $sidebar;
	},
});
preventSlideTests.push((target) => {
	let lastEl;
	return testScrollable(target.closest(".scroll"));
	function testScrollable(container) {
		if (!container || container === lastEl) return false;
		const { scrollHeight, offsetHeight, scrollWidth, offsetWidth } = container;
		if (scrollHeight > offsetHeight) return true;
		if (scrollWidth > offsetWidth) return true;
		lastEl = container;
		return testScrollable(container.parentElement.closest(".scroll"));
	}
});
preventSlideTests.push((target) => {
	return (
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		target.contentEditable === "true"
	);
});
export default Sidebar;
export function preventSlide(test) {
	preventSlideTests.push(test);
}
