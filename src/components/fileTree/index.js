import "./style.scss";
import tile from "components/tile";
import VirtualList from "components/virtualList";
import tag from "html-tag-js";
import helpers from "utils/helpers";
import Path from "utils/Path";

const VIRTUALIZATION_THRESHOLD = Number.POSITIVE_INFINITY;
const ITEM_HEIGHT = 30;
export default class FileTree {
	constructor(container, options = {}) {
		this.container = container;
		this.container.classList.add("file-tree");
		this.options = options;
		this.virtualList = null;
		this.entries = [];
		this.isLoading = false;
		this.childTrees = new Map();
		this.depth = options._depth || 0;
	}
	async load(url) {
		if (this.isLoading) return;
		this.isLoading = true;
		this.currentUrl = url;
		try {
			this.clear();
			const entries = await this.options.getEntries(url);
			this.entries = helpers.sortDir(entries, {
				sortByName: true,
				showHiddenFiles: true,
			});
			if (this.entries.length > VIRTUALIZATION_THRESHOLD) {
				this.renderVirtualized();
			} else {
				this.renderWithFragment();
			}
		} finally {
			this.isLoading = false;
		}
	}
	renderWithFragment() {
		const fragment = document.createDocumentFragment();
		for (const entry of this.entries) {
			const $el = this.createEntryElement(entry);
			fragment.appendChild($el);
		}
		this.container.appendChild(fragment);
	}
	renderVirtualized() {
		this.container.classList.add("virtual-scroll");
		this.virtualList = new VirtualList(this.container, {
			itemHeight: ITEM_HEIGHT,
			buffer: 15,
			renderItem: (entry, recycledEl) =>
				this.createEntryElement(entry, recycledEl),
		});
		this.virtualList.setItems(this.entries);
	}
	createEntryElement(entry, recycledEl) {
		const name = entry.name || Path.basename(entry.url);
		if (entry.isDirectory) {
			return this.createFolderElement(name, entry.url, recycledEl);
		} else {
			return this.createFileElement(name, entry.url, recycledEl);
		}
	}
	createFolderElement(name, url, recycledEl) {
		if (recycledEl && recycledEl.classList.contains("collapsible")) {
			const $title = recycledEl.$title;
			if ($title) {
				$title.dataset.url = url;
				$title.dataset.name = name;
				const textEl = $title.querySelector(".text");
				if (textEl) textEl.textContent = name;
				if (!recycledEl.classList.contains("hidden")) {
					recycledEl.classList.add("hidden");
					const childTree = this.childTrees.get(recycledEl._folderUrl);
					if (childTree) {
						childTree.destroy();
						this.childTrees.delete(recycledEl._folderUrl);
					}
					recycledEl.$ul.innerHTML = "";
				}
				recycledEl._folderUrl = url;
				return recycledEl;
			}
		}
		const $wrapper = tag("div", {
			className: "list collapsible hidden",
		});
		$wrapper._folderUrl = url;
		const $indicator = tag("span", {
			className: "icon folder",
		});
		const $title = tile({
			lead: $indicator,
			type: "div",
			text: name,
		});
		$title.classList.add("light");
		$title.dataset.url = url;
		$title.dataset.name = name;
		$title.dataset.type = "dir";
		const $content = tag("ul", {
			className: "scroll folder-content",
		});
		$wrapper.append($title, $content);
		let childTree = null;
		$content._fileTree = null;
		const toggle = async () => {
			const isExpanded = !$wrapper.classList.contains("hidden");
			if (isExpanded) {
				$wrapper.classList.add("hidden");
				if (childTree) {
					childTree.destroy();
					this.childTrees.delete(url);
					childTree = null;
					$content._fileTree = null;
				}
				this.options.onExpandedChange?.(url, false);
			} else {
				$wrapper.classList.remove("hidden");
				$title.classList.add("loading");
				childTree = new FileTree($content, {
					...this.options,
					_depth: this.depth + 1,
				});
				this.childTrees.set(url, childTree);
				$content._fileTree = childTree;
				try {
					await childTree.load(url);
				} finally {
					$title.classList.remove("loading");
				}
				this.options.onExpandedChange?.(url, true);
			}
		};
		$title.addEventListener("click", (e) => {
			e.stopPropagation();
			toggle();
		});
		$title.addEventListener("contextmenu", (e) => {
			e.stopPropagation();
			this.options.onContextMenu?.("dir", url, name, $title);
		});
		if (this.options.expandedState?.[url]) {
			queueMicrotask(() => toggle());
		}
		const defineCollapsibleAccessors = ($el, { includeTitle = true } = {}) => {
			const properties = {
				collapsed: {
					get: () => $wrapper.classList.contains("hidden"),
				},
				expanded: {
					get: () => !$wrapper.classList.contains("hidden"),
				},
				unclasped: {
					get: () => !$wrapper.classList.contains("hidden"),
				},
				$ul: {
					get: () => $content,
				},
				fileTree: {
					get: () => childTree,
				},
				refresh: {
					value: () => childTree?.refresh(),
				},
				expand: {
					value: () => !$wrapper.classList.contains("hidden") || toggle(),
				},
				collapse: {
					value: () => $wrapper.classList.contains("hidden") || toggle(),
				},
			};
			if (includeTitle) {
				properties.$title = {
					get: () => $title,
				};
			}
			Object.defineProperties($el, properties);
		};
		defineCollapsibleAccessors($wrapper);
		defineCollapsibleAccessors($title, {
			includeTitle: false,
		});
		return $wrapper;
	}
	createFileElement(name, url, recycledEl) {
		const iconClass = helpers.getIconForFile(name);
		if (recycledEl && recycledEl.dataset.type === "file") {
			recycledEl.dataset.url = url;
			recycledEl.dataset.name = name;
			const textEl = recycledEl.querySelector(".text");
			const iconEl = recycledEl.querySelector("span:first-child");
			if (textEl) textEl.textContent = name;
			if (iconEl) iconEl.className = iconClass;
			return recycledEl;
		}
		const $tile = tile({
			lead: tag("span", {
				className: iconClass,
			}),
			text: name,
		});
		$tile.dataset.url = url;
		$tile.dataset.name = name;
		$tile.dataset.type = "file";
		$tile.addEventListener("click", (e) => {
			e.stopPropagation();
			this.options.onFileClick?.(url, name);
		});
		$tile.addEventListener("contextmenu", (e) => {
			e.stopPropagation();
			this.options.onContextMenu?.("file", url, name, $tile);
		});
		return $tile;
	}
	clear() {
		this.destroyChildTrees();
		if (this.virtualList) {
			this.virtualList.destroy();
			this.virtualList = null;
		}
		this.container.innerHTML = "";
		this.container.classList.remove("virtual-scroll");
		this.entries = [];
	}
	destroy() {
		this.clear();
		this.container.classList.remove("file-tree");
	}
	findElement(url) {
		return this.container.querySelector(`[data-url="${CSS.escape(url)}"]`);
	}
	async refresh() {
		if (this.currentUrl) {
			await this.load(this.currentUrl);
		}
	}
	async refreshFolder(url, isSameUrl = (a, b) => a === b) {
		if (this.currentUrl && isSameUrl(this.currentUrl, url)) {
			await this.refresh();
			return true;
		}
		for (const childTree of this.childTrees.values()) {
			if (await childTree.refreshFolder(url, isSameUrl)) {
				return true;
			}
		}
		return false;
	}
	destroyChildTrees() {
		for (const childTree of this.childTrees.values()) {
			childTree.destroy();
		}
		this.childTrees.clear();
	}
	appendEntry(name, url, isDirectory) {
		if (this.entries.some((entry) => entry.url === url)) return;
		const entry = {
			name,
			url,
			isDirectory,
			isFile: !isDirectory,
		};
		if (isDirectory) {
			const insertIndex = this.entries.findIndex((e) => !e.isDirectory);
			if (insertIndex === -1) {
				this.entries.push(entry);
			} else {
				this.entries.splice(insertIndex, 0, entry);
			}
		} else {
			this.entries.push(entry);
		}
		this.entries = helpers.sortDir(this.entries, {
			sortByName: true,
			showHiddenFiles: true,
		});
		if (this.virtualList) {
			this.virtualList.setItems(this.entries);
		} else {
			const index = this.entries.findIndex((item) => item.url === url);
			const $el = this.createEntryElement(entry);
			const $next = this.container.children[index];
			this.container.insertBefore($el, $next || null);
		}
	}
	removeEntry(url) {
		const index = this.entries.findIndex((e) => e.url === url);
		if (index === -1) return;
		const entry = this.entries[index];
		if (entry.isDirectory && this.childTrees.has(url)) {
			this.childTrees.get(url).destroy();
			this.childTrees.delete(url);
		}
		this.entries.splice(index, 1);
		if (this.virtualList) {
			this.virtualList.setItems(this.entries);
		} else {
			const $el = this.findElement(url);
			if ($el) {
				if ($el.dataset.type === "dir") {
					$el.closest(".list.collapsible")?.remove();
				} else {
					$el.remove();
				}
			}
		}
	}
}
