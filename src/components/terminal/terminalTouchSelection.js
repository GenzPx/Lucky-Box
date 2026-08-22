import "./terminalTouchSelection.css";
import select from "dialogs/select";

const DEFAULT_MORE_OPTION_ID = "__acode_terminal_select_all__";
const terminalMoreOptions = new Map();
let terminalMoreOptionCounter = 0;
const HANDLE_EDGE_FLIP_MARGIN = 4;
const HANDLE_EDGE_RESTORE_MARGIN = 12;
function ensureDefaultMoreOption() {
	if (terminalMoreOptions.has(DEFAULT_MORE_OPTION_ID)) return;
	terminalMoreOptions.set(DEFAULT_MORE_OPTION_ID, {
		id: DEFAULT_MORE_OPTION_ID,
		label: () => strings["select all"] || "Select all",
		icon: "text_format",
		action: ({ touchSelection }) => touchSelection.selectAllText(),
	});
}
function normalizeMoreOption(option) {
	if (!option || typeof option !== "object" || Array.isArray(option)) {
		console.warn(
			"[TerminalTouchSelection] addMoreOption expects an option object.",
		);
		return null;
	}
	const id =
		option.id != null && option.id !== ""
			? String(option.id)
			: `terminal_more_option_${++terminalMoreOptionCounter}`;
	const label = option.label ?? option.text ?? option.title;
	const action = option.action || option.onselect || option.onclick;
	if (!label) {
		console.warn(
			`[TerminalTouchSelection] More option '${id}' must provide a label/text/title.`,
		);
		return null;
	}
	if (typeof action !== "function") {
		console.warn(
			`[TerminalTouchSelection] More option '${id}' must provide an action function.`,
		);
		return null;
	}
	return {
		id,
		label,
		icon: option.icon || null,
		enabled: option.enabled,
		action,
	};
}
function resolveMoreOptionLabel(option, context) {
	try {
		const value =
			typeof option.label === "function" ? option.label(context) : option.label;
		return value == null ? "" : String(value);
	} catch (error) {
		console.warn(
			`[TerminalTouchSelection] Failed to resolve label for option '${option.id}'.`,
			error,
		);
		return "";
	}
}
function isMoreOptionEnabled(option, context) {
	try {
		if (typeof option.enabled === "function") {
			return option.enabled(context) !== false;
		}
		if (option.enabled === undefined) return true;
		return option.enabled !== false;
	} catch (error) {
		console.warn(
			`[TerminalTouchSelection] Failed to resolve enabled state for option '${option.id}'.`,
			error,
		);
		return true;
	}
}
export default class TerminalTouchSelection {
	static addMoreOption(option) {
		ensureDefaultMoreOption();
		const normalized = normalizeMoreOption(option);
		if (!normalized) return null;
		terminalMoreOptions.set(normalized.id, normalized);
		return normalized.id;
	}
	static removeMoreOption(id) {
		ensureDefaultMoreOption();
		if (id == null || id === "") return false;
		return terminalMoreOptions.delete(String(id));
	}
	static getMoreOptions() {
		ensureDefaultMoreOption();
		return [...terminalMoreOptions.values()].map((option) => ({
			...option,
		}));
	}
	constructor(terminal, container, options = {}) {
		ensureDefaultMoreOption();
		this.terminal = terminal;
		this.container = container;
		this.options = {
			tapHoldDuration: 400,
			moveThreshold: 8,
			handleSize: 24,
			hapticFeedback: true,
			showContextMenu: true,
			fingerOffset: 40,
			...options,
		};
		this.isSelecting = false;
		this.isHandleDragging = false;
		this.selectionStart = null;
		this.selectionEnd = null;
		this.currentSelection = null;
		this.touchStartTime = 0;
		this.touchStartPos = {
			x: 0,
			y: 0,
		};
		this.initialTouchPos = {
			x: 0,
			y: 0,
		};
		this.tapHoldTimeout = null;
		this.dragHandle = null;
		this.isSelectionTouchActive = false;
		this.pendingSelectionClearTouch = null;
		this.pinchStartDistance = 0;
		this.lastPinchDistance = 0;
		this.isPinching = false;
		this.initialFontSize = 0;
		this.lastZoomTime = 0;
		this.zoomThrottle = 50;
		this.selectionOverlay = null;
		this.startHandle = null;
		this.endHandle = null;
		this.contextMenu = null;
		this.cellDimensions = {
			width: 0,
			height: 0,
		};
		this.boundHandlers = {};
		this.wasFocusedBeforeSelection = false;
		this.contextMenuShouldStayVisible = false;
		this.selectionProtected = false;
		this.protectionTimeout = null;
		this.terminalScrollDisposable = null;
		this.isTerminalScrolling = false;
		this.scrollEndTimeout = null;
		this.scrollEndDelay = 100;
		this.selectionRenderFrame = null;
		this.selectionResizeTimeout = null;
		this.orientationResizeTimeout = null;
		this.resizeSettleDelay = 150;
		this.init();
	}
	init() {
		this.createSelectionOverlay();
		this.createHandles();
		this.attachEventListeners();
		this.updateCellDimensions();
	}
	createSelectionOverlay() {
		this.selectionOverlay = document.createElement("div");
		this.selectionOverlay.className = "terminal-selection-overlay";
		this.selectionOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 100;
      overflow: hidden;
    `;
		this.container.appendChild(this.selectionOverlay);
	}
	createHandles() {
		this.startHandle = this.createHandle("start");
		this.startHandle.style.cssText += `
      border-radius: 50% 50% 50% 0;
    `;
		this.setHandleOrientation(this.startHandle, "start");
		this.endHandle = this.createHandle("end");
		this.endHandle.style.cssText += `
      border-radius: 50% 50% 50% 0;
    `;
		this.setHandleOrientation(this.endHandle, "end");
		this.selectionOverlay.appendChild(this.startHandle);
		this.selectionOverlay.appendChild(this.endHandle);
	}
	createHandle(type) {
		const handle = document.createElement("div");
		handle.className = `terminal-selection-handle terminal-selection-handle-${type}`;
		handle.style.cssText = `
      position: absolute;
      width: ${this.options.handleSize}px;
      height: ${this.options.handleSize}px;
      background: #2196F3;
      border: 2px solid #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: none;
      pointer-events: auto;
      touch-action: none;
      z-index: 101;
      cursor: grab;
    `;
		handle.dataset.handleType = type;
		return handle;
	}
	attachEventListeners() {
		this.boundHandlers.terminalTouchStart =
			this.onTerminalTouchStart.bind(this);
		this.boundHandlers.terminalTouchMove = this.onTerminalTouchMove.bind(this);
		this.boundHandlers.terminalTouchEnd = this.onTerminalTouchEnd.bind(this);
		this.terminal.element.addEventListener(
			"touchstart",
			this.boundHandlers.terminalTouchStart,
			{
				passive: false,
			},
		);
		this.terminal.element.addEventListener(
			"touchmove",
			this.boundHandlers.terminalTouchMove,
			{
				passive: false,
			},
		);
		this.terminal.element.addEventListener(
			"touchend",
			this.boundHandlers.terminalTouchEnd,
			{
				passive: false,
			},
		);
		this.boundHandlers.handleTouchStart = this.onHandleTouchStart.bind(this);
		this.boundHandlers.handleTouchMove = this.onHandleTouchMove.bind(this);
		this.boundHandlers.handleTouchEnd = this.onHandleTouchEnd.bind(this);
		this.startHandle.addEventListener(
			"touchstart",
			this.boundHandlers.handleTouchStart,
			{
				passive: false,
			},
		);
		this.startHandle.addEventListener(
			"touchmove",
			this.boundHandlers.handleTouchMove,
			{
				passive: false,
			},
		);
		this.startHandle.addEventListener(
			"touchend",
			this.boundHandlers.handleTouchEnd,
			{
				passive: false,
			},
		);
		this.endHandle.addEventListener(
			"touchstart",
			this.boundHandlers.handleTouchStart,
			{
				passive: false,
			},
		);
		this.endHandle.addEventListener(
			"touchmove",
			this.boundHandlers.handleTouchMove,
			{
				passive: false,
			},
		);
		this.endHandle.addEventListener(
			"touchend",
			this.boundHandlers.handleTouchEnd,
			{
				passive: false,
			},
		);
		this.boundHandlers.selectionChange = this.onSelectionChange.bind(this);
		this.terminal.onSelectionChange(this.boundHandlers.selectionChange);
		this.boundHandlers.orientationChange = this.onOrientationChange.bind(this);
		window.addEventListener(
			"orientationchange",
			this.boundHandlers.orientationChange,
		);
		window.addEventListener("resize", this.boundHandlers.orientationChange);
		this.boundHandlers.terminalScroll = this.onTerminalScroll.bind(this);
		this.terminalScrollDisposable = this.terminal.onScroll(
			this.boundHandlers.terminalScroll,
		);
		this.boundHandlers.terminalResize = this.onTerminalResize.bind(this);
		this.terminal.onResize(this.boundHandlers.terminalResize);
	}
	onTerminalTouchStart(event) {
		if (event.touches.length === 2) {
			event.preventDefault();
			this.startPinchZoom(event);
			return;
		}
		if (event.touches.length !== 1) return;
		const touch = event.touches[0];
		this.touchStartTime = Date.now();
		this.touchStartPos = {
			x: touch.clientX,
			y: touch.clientY,
		};
		this.initialTouchPos = {
			x: touch.clientX,
			y: touch.clientY,
		};
		if (this.isSelecting) {
			this.isSelectionTouchActive = false;
			this.pendingSelectionClearTouch = {
				x: touch.clientX,
				y: touch.clientY,
				moved: false,
			};
			this.hideContextMenu(true);
			return;
		}
		if (this.isEdgeGesture(touch)) {
			return;
		}
		if (this.tapHoldTimeout) {
			clearTimeout(this.tapHoldTimeout);
		}
		this.pendingSelectionClearTouch = null;
		this.isSelectionTouchActive = false;
		this.tapHoldTimeout = setTimeout(() => {
			if (!this.isSelecting && !this.isPinching) {
				this.startSelection(touch);
			}
		}, this.options.tapHoldDuration);
	}
	onTerminalTouchMove(event) {
		if (event.touches.length === 2) {
			event.preventDefault();
			this.handlePinchZoom(event);
			return;
		}
		if (event.touches.length !== 1) return;
		if (this.isPinching) return;
		const touch = event.touches[0];
		const deltaX = Math.abs(touch.clientX - this.touchStartPos.x);
		const deltaY = Math.abs(touch.clientY - this.touchStartPos.y);
		const horizontalDelta = touch.clientX - this.touchStartPos.x;
		const clearTouch = this.pendingSelectionClearTouch;
		if (clearTouch) {
			const clearDeltaX = Math.abs(touch.clientX - clearTouch.x);
			const clearDeltaY = Math.abs(touch.clientY - clearTouch.y);
			if (
				clearDeltaX > this.options.moveThreshold ||
				clearDeltaY > this.options.moveThreshold
			) {
				clearTouch.moved = true;
			}
		}
		if (
			this.isEdgeGesture(this.initialTouchPos) &&
			Math.abs(horizontalDelta) > deltaY &&
			deltaX > this.options.moveThreshold
		) {
			if (this.tapHoldTimeout) {
				clearTimeout(this.tapHoldTimeout);
				this.tapHoldTimeout = null;
			}
			return;
		}
		if (
			deltaX > this.options.moveThreshold ||
			deltaY > this.options.moveThreshold
		) {
			if (this.tapHoldTimeout) {
				clearTimeout(this.tapHoldTimeout);
				this.tapHoldTimeout = null;
			}
			if (
				this.isSelecting &&
				!this.isHandleDragging &&
				this.isSelectionTouchActive
			) {
				event.preventDefault();
				this.extendSelection(touch);
			}
		}
	}
	onTerminalTouchEnd(event) {
		if (this.isPinching) {
			this.endPinchZoom();
			return;
		}
		if (this.isSelecting && event.cancelable) {
			event.preventDefault();
		}
		if (this.tapHoldTimeout) {
			clearTimeout(this.tapHoldTimeout);
			this.tapHoldTimeout = null;
		}
		const shouldClearSelectionByTap =
			this.isSelecting &&
			!this.isHandleDragging &&
			this.pendingSelectionClearTouch &&
			!this.pendingSelectionClearTouch.moved &&
			!this.isTerminalScrolling &&
			!this.selectionProtected;
		this.pendingSelectionClearTouch = null;
		this.isSelectionTouchActive = false;
		if (shouldClearSelectionByTap) {
			this.clearSelection();
			return;
		}
		if (this.isSelecting && !this.isHandleDragging) {
			if (this.isTerminalScrolling) return;
			this.finalizeSelection();
		} else if (!this.isSelecting) {
			const currentlyFocused = this.isTerminalFocused();
			if (currentlyFocused) {
				this.terminal.focus();
			}
		}
	}
	onHandleTouchStart(event) {
		event.preventDefault();
		event.stopPropagation();
		if (event.touches.length !== 1) return;
		let handleType = event.target.dataset.handleType;
		if (!handleType) {
			if (
				event.target === this.startHandle ||
				this.startHandle.contains(event.target)
			) {
				handleType = "start";
			} else if (
				event.target === this.endHandle ||
				this.endHandle.contains(event.target)
			) {
				handleType = "end";
			}
		}
		if (!handleType) {
			console.warn("Could not determine handle type for drag");
			return;
		}
		this.isHandleDragging = true;
		this.dragHandle = handleType;
		this.isSelectionTouchActive = false;
		this.pendingSelectionClearTouch = null;
		const touch = event.touches[0];
		this.initialTouchPos = {
			x: touch.clientX,
			y: touch.clientY,
		};
		const targetHandle =
			handleType === "start" ? this.startHandle : this.endHandle;
		targetHandle.style.cursor = "grabbing";
		this.startHandle.style.transition = "none";
		this.endHandle.style.transition = "none";
		if (!targetHandle.style.transform.includes("scale")) {
			targetHandle.style.transform += " scale(1.2)";
		}
	}
	onHandleTouchMove(event) {
		if (!this.isHandleDragging || event.touches.length !== 1) return;
		event.preventDefault();
		event.stopPropagation();
		const touch = event.touches[0];
		const deltaX = Math.abs(touch.clientX - this.initialTouchPos.x);
		const deltaY = Math.abs(touch.clientY - this.initialTouchPos.y);
		if (
			deltaX < this.options.moveThreshold &&
			deltaY < this.options.moveThreshold
		) {
			return;
		}
		const adjustedTouch = {
			clientX: touch.clientX,
			clientY: touch.clientY - this.options.fingerOffset,
		};
		const coords = this.touchToTerminalCoords(adjustedTouch);
		if (coords) {
			if (this.dragHandle === "start") {
				this.selectionStart = coords;
				if (
					this.selectionEnd &&
					(coords.row > this.selectionEnd.row ||
						(coords.row === this.selectionEnd.row &&
							coords.col > this.selectionEnd.col))
				) {
					const temp = this.selectionStart;
					this.selectionStart = this.selectionEnd;
					this.selectionEnd = temp;
					this.dragHandle = "end";
				}
			} else {
				this.selectionEnd = coords;
				if (
					this.selectionStart &&
					(coords.row < this.selectionStart.row ||
						(coords.row === this.selectionStart.row &&
							coords.col < this.selectionStart.col))
				) {
					const temp = this.selectionEnd;
					this.selectionEnd = this.selectionStart;
					this.selectionStart = temp;
					this.dragHandle = "start";
				}
			}
			this.updateSelection();
		}
	}
	onHandleTouchEnd(event) {
		if (!this.isHandleDragging) return;
		event.preventDefault();
		event.stopPropagation();
		this.isHandleDragging = false;
		this.dragHandle = null;
		const handles = [this.startHandle, this.endHandle];
		handles.forEach((handle) => {
			handle.style.cursor = "grab";
			handle.style.transition = "";
			handle.style.transform = handle.style.transform
				.replace(/\s*scale\([^)]*\)/g, "")
				.trim();
		});
		this.finalizeSelection();
	}
	onSelectionChange() {
		if (!this.isSelecting) return;
		const selection = this.terminal.getSelection();
		if (selection && selection.length > 0) {
			this.currentSelection = selection;
			this.updateHandlePositions();
		}
	}
	onOrientationChange() {
		if (this.orientationResizeTimeout) {
			clearTimeout(this.orientationResizeTimeout);
		}
		this.orientationResizeTimeout = setTimeout(() => {
			this.orientationResizeTimeout = null;
			this.updateCellDimensions();
			if (
				this.isSelecting &&
				!this.selectionResizeTimeout &&
				this.terminal.hasSelection()
			) {
				this.updateHandlePositions();
			}
		}, this.resizeSettleDelay);
	}
	onTerminalScroll() {
		if (!this.isSelecting || this.isHandleDragging) return;
		this.isTerminalScrolling = true;
		this.hideHandles();
		this.hideContextMenu(true);
		if (this.scrollEndTimeout) {
			clearTimeout(this.scrollEndTimeout);
		}
		this.scrollEndTimeout = setTimeout(() => {
			this.onTerminalScrollEnd();
		}, this.scrollEndDelay);
	}
	onTerminalScrollEnd() {
		this.scrollEndTimeout = null;
		this.isTerminalScrolling = false;
		if (!this.isSelecting || this.isHandleDragging) return;
		this.updateHandlePositions();
		if (this.contextMenuShouldStayVisible && this.options.showContextMenu) {
			this.showContextMenu();
		}
	}
	onTerminalResize() {
		if (this.isSelecting) {
			this.hideHandles();
			this.hideContextMenu(true);
			if (this.selectionRenderFrame) {
				cancelAnimationFrame(this.selectionRenderFrame);
				this.selectionRenderFrame = null;
			}
		}
		if (this.selectionResizeTimeout) {
			clearTimeout(this.selectionResizeTimeout);
		}
		this.selectionResizeTimeout = setTimeout(() => {
			this.selectionResizeTimeout = null;
			this.updateCellDimensions();
			if (!this.isSelecting) return;
			const start = this.selectionStart;
			const end = this.selectionEnd;
			const buffer = this.terminal.buffer.active;
			if (
				!start ||
				!end ||
				start.row < 0 ||
				end.row < 0 ||
				start.row >= buffer.length ||
				end.row >= buffer.length ||
				!buffer.getLine(start.row) ||
				!buffer.getLine(end.row)
			) {
				this.forceClearSelection();
				return;
			}
			const lastColumn = Math.max(0, this.terminal.cols - 1);
			start.col = Math.min(start.col, lastColumn);
			end.col = Math.min(end.col, lastColumn);
			this.hideContextMenu(true);
			this.finalizeSelection();
		}, this.resizeSettleDelay);
	}
	startSelection(touch) {
		const coords = this.touchToTerminalCoords(touch);
		if (!coords) return;
		this.wasFocusedBeforeSelection = this.isTerminalFocused();
		this.selectionProtected = true;
		if (this.protectionTimeout) {
			clearTimeout(this.protectionTimeout);
		}
		this.protectionTimeout = setTimeout(() => {
			this.selectionProtected = false;
		}, 1000);
		this.isSelecting = true;
		this.isSelectionTouchActive = true;
		this.pendingSelectionClearTouch = null;
		const wordBounds = this.getWordBoundsAt(coords);
		if (wordBounds) {
			this.selectionStart = wordBounds.start;
			this.selectionEnd = wordBounds.end;
		} else {
			this.selectionStart = coords;
			this.selectionEnd = coords;
		}
		this.terminal.clearSelection();
		this.updateSelection();
		this.currentSelection = this.terminal.getSelection();
		this.showHandles();
		if (this.options.showContextMenu) {
			this.showContextMenu();
		}
		if (this.options.hapticFeedback && navigator.vibrate) {
			navigator.vibrate(50);
		}
	}
	extendSelection(touch) {
		const coords = this.touchToTerminalCoords(touch);
		if (!coords) return;
		this.selectionEnd = coords;
		this.updateSelection();
	}
	updateSelection() {
		if (!this.selectionStart || !this.selectionEnd) return;
		const start = this.selectionStart;
		const end = this.selectionEnd;
		let startRow = start.row;
		let startCol = start.col;
		let endRow = end.row;
		let endCol = end.col;
		if (startRow > endRow || (startRow === endRow && startCol > endCol)) {
			[startRow, startCol, endRow, endCol] = [
				endRow,
				endCol,
				startRow,
				startCol,
			];
		}
		const length = this.calculateSelectionLength(
			startRow,
			startCol,
			endRow,
			endCol,
		);
		this.terminal.clearSelection();
		this.terminal.select(startCol, startRow, length);
		this.updateHandlePositions();
		if (this.contextMenuShouldStayVisible && this.options.showContextMenu) {
			this.showContextMenu();
		}
	}
	calculateSelectionLength(startRow, startCol, endRow, endCol) {
		if (startRow === endRow) {
			return endCol - startCol + 1;
		}
		const cols = this.terminal.cols;
		let length = cols - startCol;
		length += (endRow - startRow - 1) * cols;
		length += endCol + 1;
		return length;
	}
	finalizeSelection() {
		if (!this.isSelecting) return;
		this.updateSelection();
		this.currentSelection = this.terminal.getSelection();
		if (this.selectionRenderFrame) {
			cancelAnimationFrame(this.selectionRenderFrame);
		}
		this.selectionRenderFrame = requestAnimationFrame(() => {
			this.selectionRenderFrame = null;
			if (!this.isSelecting || !this.terminal) return;
			this.updateSelection();
			this.currentSelection = this.terminal.getSelection();
			if (this.options.showContextMenu && this.currentSelection) {
				this.showContextMenu();
			}
		});
	}
	showHandles() {
		this.startHandle.style.display = "block";
		this.endHandle.style.display = "block";
		this.updateHandlePositions();
	}
	hideHandles() {
		this.startHandle.style.display = "none";
		this.endHandle.style.display = "none";
	}
	getHandleBaseTransform(orientation) {
		if (orientation === "start") {
			return "rotate(180deg) translateX(87%)";
		}
		return "rotate(90deg) translateY(-13%)";
	}
	setHandleOrientation(handle, orientation) {
		if (!handle) return;
		if (handle.dataset.orientation === orientation) return;
		const baseTransform = this.getHandleBaseTransform(orientation);
		const hasScale = /\bscale\(/.test(handle.style.transform || "");
		handle.dataset.orientation = orientation;
		handle.style.transform = hasScale
			? `${baseTransform} scale(1.2)`
			: baseTransform;
	}
	getHandleAnchorX(handle) {
		const left = Number.parseFloat(handle.style.left || "0");
		return Number.isFinite(left) ? left : 0;
	}
	updateHandleOrientationForViewportEdges() {
		const overlayWidth =
			this.selectionOverlay.clientWidth || this.container.clientWidth;
		const handleSize = this.options.handleSize;
		if (this.startHandle.style.display !== "none") {
			const anchorX = this.getHandleAnchorX(this.startHandle);
			const orientation = this.startHandle.dataset.orientation || "start";
			if (
				orientation === "start" &&
				anchorX < handleSize + HANDLE_EDGE_FLIP_MARGIN
			) {
				this.setHandleOrientation(this.startHandle, "end");
			} else if (
				orientation === "end" &&
				anchorX > handleSize + HANDLE_EDGE_RESTORE_MARGIN
			) {
				this.setHandleOrientation(this.startHandle, "start");
			}
		}
		if (this.endHandle.style.display !== "none") {
			const anchorX = this.getHandleAnchorX(this.endHandle);
			const orientation = this.endHandle.dataset.orientation || "end";
			if (
				orientation === "end" &&
				anchorX > overlayWidth - handleSize - HANDLE_EDGE_FLIP_MARGIN
			) {
				this.setHandleOrientation(this.endHandle, "start");
			} else if (
				orientation === "start" &&
				anchorX < overlayWidth - handleSize - HANDLE_EDGE_RESTORE_MARGIN
			) {
				this.setHandleOrientation(this.endHandle, "end");
			}
		}
	}
	updateHandlePositions() {
		if (!this.selectionStart || !this.selectionEnd) return;
		let logicalStart, logicalEnd;
		if (
			this.selectionStart.row < this.selectionEnd.row ||
			(this.selectionStart.row === this.selectionEnd.row &&
				this.selectionStart.col <= this.selectionEnd.col)
		) {
			logicalStart = this.selectionStart;
			logicalEnd = this.selectionEnd;
		} else {
			logicalStart = this.selectionEnd;
			logicalEnd = this.selectionStart;
		}
		const startPos = this.terminalCoordsToPixels(logicalStart);
		const endPos = this.terminalCoordsToPixels(logicalEnd);
		if (startPos) {
			this.startHandle.style.display = "block";
			this.startHandle.style.left = `${startPos.x}px`;
			this.startHandle.style.top = `${startPos.y + this.cellDimensions.height + 4}px`;
		} else {
			this.startHandle.style.display = "none";
		}
		if (endPos) {
			this.endHandle.style.display = "block";
			this.endHandle.style.left = `${endPos.x + this.cellDimensions.width}px`;
			this.endHandle.style.top = `${endPos.y + this.cellDimensions.height + 4}px`;
		} else {
			this.endHandle.style.display = "none";
		}
		this.updateHandleOrientationForViewportEdges();
	}
	showContextMenu() {
		if (!this.contextMenu) {
			this.createContextMenu();
		}
		this.contextMenuShouldStayVisible = true;
		const startPos = this.selectionStart
			? this.terminalCoordsToPixels(this.selectionStart)
			: null;
		const endPos = this.selectionEnd
			? this.terminalCoordsToPixels(this.selectionEnd)
			: null;
		const menuWidth = this.contextMenu.offsetWidth || 200;
		const menuHeight = this.contextMenu.offsetHeight || 50;
		const containerRect = this.container.getBoundingClientRect();
		let menuX;
		let menuY;
		if (startPos || endPos) {
			let centerX;
			let baseY;
			if (startPos && endPos) {
				centerX = (startPos.x + endPos.x) / 2;
				baseY = Math.max(startPos.y, endPos.y);
			} else if (startPos) {
				centerX = startPos.x;
				baseY = startPos.y;
			} else {
				centerX = endPos.x;
				baseY = endPos.y;
			}
			menuX = centerX - menuWidth / 2;
			menuY = baseY + this.cellDimensions.height + 40;
			const maxY = containerRect.height - menuHeight - 10;
			if (menuY > maxY) {
				const topY =
					startPos && endPos ? Math.min(startPos.y, endPos.y) : baseY;
				menuY = topY - menuHeight - 10;
			}
		} else {
			menuX = (containerRect.width - menuWidth) / 2;
			menuY = containerRect.height - menuHeight - 20;
		}
		const minX = 10;
		const maxX = containerRect.width - menuWidth - 10;
		menuX = Math.max(minX, Math.min(menuX, maxX));
		const minY = 10;
		const maxY = containerRect.height - menuHeight - 10;
		menuY = Math.max(minY, Math.min(menuY, maxY));
		this.contextMenu.style.left = `${menuX}px`;
		this.contextMenu.style.top = `${menuY}px`;
		this.contextMenu.style.display = "flex";
	}
	createContextMenu() {
		this.contextMenu = document.createElement("div");
		this.contextMenu.className = "terminal-context-menu";
		const menuItems = [
			{
				label: strings["copy"],
				action: this.copySelection.bind(this),
			},
			{
				label: strings["paste"],
				action: this.pasteFromClipboard.bind(this),
			},
			{
				label: `${strings["more"] || "More"}...`,
				action: this.showMoreOptions.bind(this),
			},
		];
		menuItems.forEach((item) => {
			const button = document.createElement("button");
			button.textContent = item.label;
			let actionExecuted = false;
			button.addEventListener("touchstart", (e) => {
				e.preventDefault();
				e.stopPropagation();
				actionExecuted = false;
			});
			button.addEventListener("touchend", (e) => {
				e.preventDefault();
				e.stopPropagation();
				if (!actionExecuted) {
					actionExecuted = true;
					item.action();
				}
			});
			button.addEventListener("mousedown", (e) => {
				e.preventDefault();
				e.stopPropagation();
				actionExecuted = false;
			});
			button.addEventListener("mouseup", (e) => {
				e.preventDefault();
				e.stopPropagation();
				if (!actionExecuted) {
					actionExecuted = true;
					item.action();
				}
			});
			button.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
			});
			this.contextMenu.appendChild(button);
		});
		this.selectionOverlay.appendChild(this.contextMenu);
	}
	hideContextMenu(force = false) {
		if (this.contextMenu && (force || !this.contextMenuShouldStayVisible)) {
			this.contextMenu.style.display = "none";
		}
	}
	forceHideContextMenu() {
		if (this.contextMenu) {
			this.contextMenu.style.display = "none";
			this.contextMenuShouldStayVisible = false;
		}
	}
	copySelection() {
		const selectionText = this.currentSelection || this.terminal.getSelection();
		if (selectionText && cordova?.plugins?.clipboard) {
			cordova.plugins.clipboard.copy(selectionText);
		}
		this.forceClearSelection();
	}
	pasteFromClipboard() {
		if (cordova?.plugins?.clipboard) {
			cordova.plugins.clipboard.paste((text) => {
				this.terminal.paste(text);
				this.forceClearSelection();
			});
		}
	}
	selectAllText() {
		if (!this.terminal?.selectAll) return;
		this.terminal.selectAll();
		this.currentSelection = this.terminal.getSelection();
		this.isSelecting = !!this.currentSelection;
		this.selectionStart = null;
		this.selectionEnd = null;
		this.hideHandles();
		if (this.options.showContextMenu && this.currentSelection) {
			this.showContextMenu();
		}
	}
	getMoreOptionsContext() {
		return {
			terminal: this.terminal,
			touchSelection: this,
			selection: this.currentSelection || this.terminal.getSelection(),
			clearSelection: () => this.forceClearSelection(),
			copySelection: () => this.copySelection(),
			pasteFromClipboard: () => this.pasteFromClipboard(),
			selectAll: () => this.selectAllText(),
		};
	}
	getResolvedMoreOptions() {
		ensureDefaultMoreOption();
		const context = this.getMoreOptionsContext();
		return [...terminalMoreOptions.values()]
			.map((option) => {
				const label = resolveMoreOptionLabel(option, context);
				if (!label) return null;
				return {
					...option,
					label,
					disabled: !isMoreOptionEnabled(option, context),
				};
			})
			.filter(Boolean);
	}
	async executeMoreOption(option) {
		if (!option || typeof option.action !== "function" || option.disabled) {
			if (this.isSelecting && this.options.showContextMenu) {
				this.showContextMenu();
			}
			return;
		}
		try {
			await option.action(this.getMoreOptionsContext());
		} catch (error) {
			console.error(
				`[TerminalTouchSelection] Failed to execute more option '${option.id}'.`,
				error,
			);
			window.toast?.("Failed to execute action.");
		} finally {
			if (this.isSelecting && this.options.showContextMenu) {
				this.showContextMenu();
			}
		}
	}
	showMoreOptions() {
		const moreOptions = this.getResolvedMoreOptions();
		if (!moreOptions.length) return;
		const items = moreOptions.map((option) => ({
			value: option.id,
			text: option.label,
			icon: option.icon,
			disabled: option.disabled,
		}));
		this.hideContextMenu(true);
		select(strings["more"] || "More", items, true)
			.then((selectedId) => {
				const option = moreOptions.find((entry) => entry.id === selectedId);
				return this.executeMoreOption(option);
			})
			.catch(() => {
				if (this.isSelecting && this.options.showContextMenu) {
					this.showContextMenu();
				}
			});
	}
	clearSelection() {
		if (this.selectionProtected) {
			return;
		}
		const shouldRestoreFocus =
			this.wasFocusedBeforeSelection && this.isSelecting;
		this.isSelecting = false;
		this.isHandleDragging = false;
		this.selectionStart = null;
		this.selectionEnd = null;
		this.currentSelection = null;
		this.dragHandle = null;
		this.pendingSelectionClearTouch = null;
		this.isSelectionTouchActive = false;
		this.isTerminalScrolling = false;
		this.terminal.clearSelection();
		this.hideHandles();
		this.forceHideContextMenu();
		if (this.tapHoldTimeout) {
			clearTimeout(this.tapHoldTimeout);
			this.tapHoldTimeout = null;
		}
		if (this.scrollEndTimeout) {
			clearTimeout(this.scrollEndTimeout);
			this.scrollEndTimeout = null;
		}
		if (this.selectionRenderFrame) {
			cancelAnimationFrame(this.selectionRenderFrame);
			this.selectionRenderFrame = null;
		}
		if (this.selectionResizeTimeout) {
			clearTimeout(this.selectionResizeTimeout);
			this.selectionResizeTimeout = null;
		}
		if (this.orientationResizeTimeout) {
			clearTimeout(this.orientationResizeTimeout);
			this.orientationResizeTimeout = null;
		}
		if (this.protectionTimeout) {
			clearTimeout(this.protectionTimeout);
			this.protectionTimeout = null;
		}
		this.selectionProtected = false;
		if (shouldRestoreFocus && !this.isTerminalFocused()) {
			setTimeout(() => {
				if (!this.isSelecting) {
					this.terminal.focus();
				}
			}, 150);
		}
		this.wasFocusedBeforeSelection = false;
	}
	forceClearSelection() {
		this.selectionProtected = false;
		this.clearSelection();
	}
	touchToTerminalCoords(touch) {
		const rect = this.terminal.element.getBoundingClientRect();
		const x = touch.clientX - rect.left;
		const y = touch.clientY - rect.top;
		if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
			return null;
		}
		const col = Math.floor(x / this.cellDimensions.width);
		const row =
			Math.floor(y / this.cellDimensions.height) +
			this.terminal.buffer.active.viewportY;
		return {
			col: Math.max(0, Math.min(col, this.terminal.cols - 1)),
			row: Math.max(0, row),
		};
	}
	terminalCoordsToPixels(coords) {
		const rect = this.terminal.element.getBoundingClientRect();
		const containerRect = this.container.getBoundingClientRect();
		const x =
			coords.col * this.cellDimensions.width + (rect.left - containerRect.left);
		const y =
			(coords.row - this.terminal.buffer.active.viewportY) *
				this.cellDimensions.height +
			(rect.top - containerRect.top);
		const isVisible =
			coords.row >= this.terminal.buffer.active.viewportY &&
			coords.row < this.terminal.buffer.active.viewportY + this.terminal.rows;
		return isVisible
			? {
					x,
					y,
				}
			: null;
	}
	updateCellDimensions() {
		if (this.terminal._core && this.terminal._core._renderService) {
			const dimensions = this.terminal._core._renderService.dimensions;
			if (dimensions && dimensions.css && dimensions.css.cell) {
				this.cellDimensions = {
					width: dimensions.css.cell.width,
					height: dimensions.css.cell.height,
				};
			}
		}
	}
	isTerminalFocused() {
		try {
			return (
				document.activeElement === this.terminal.element ||
				this.terminal.element.contains(document.activeElement) ||
				(this.terminal._core && this.terminal._core._hasFocus)
			);
		} catch (error) {
			return false;
		}
	}
	getWordBoundsAt(coords) {
		try {
			const buffer = this.terminal.buffer.active;
			const line = buffer.getLine(coords.row);
			if (!line) return null;
			const lineText = line.translateToString(false);
			if (!lineText || coords.col >= lineText.length) return null;
			const char = lineText[coords.col];
			if (!this.isWordCharacter(char)) return null;
			let startCol = coords.col;
			while (startCol > 0 && this.isWordCharacter(lineText[startCol - 1])) {
				startCol--;
			}
			let endCol = coords.col;
			while (
				endCol < lineText.length - 1 &&
				this.isWordCharacter(lineText[endCol + 1])
			) {
				endCol++;
			}
			if (endCol > startCol) {
				return {
					start: {
						row: coords.row,
						col: startCol,
					},
					end: {
						row: coords.row,
						col: endCol,
					},
				};
			}
			return null;
		} catch (error) {
			console.warn("Error finding word bounds:", error);
			return null;
		}
	}
	isWordCharacter(char) {
		if (!char) return false;
		return /[a-zA-Z0-9_\-.]/.test(char);
	}
	startPinchZoom(event) {
		if (event.touches.length !== 2) return;
		this.isPinching = true;
		this.initialFontSize = this.terminal.options.fontSize;
		const touch1 = event.touches[0];
		const touch2 = event.touches[1];
		this.pinchStartDistance = this.getDistance(touch1, touch2);
		this.lastPinchDistance = this.pinchStartDistance;
		if (this.tapHoldTimeout) {
			clearTimeout(this.tapHoldTimeout);
			this.tapHoldTimeout = null;
		}
	}
	handlePinchZoom(event) {
		if (!this.isPinching || event.touches.length !== 2) return;
		const now = Date.now();
		if (now - this.lastZoomTime < this.zoomThrottle) return;
		this.lastZoomTime = now;
		const touch1 = event.touches[0];
		const touch2 = event.touches[1];
		const currentDistance = this.getDistance(touch1, touch2);
		const scale = currentDistance / this.pinchStartDistance;
		const newFontSize = Math.round(this.initialFontSize * scale);
		const minFontSize = 8;
		const maxFontSize = 24;
		const clampedFontSize = Math.max(
			minFontSize,
			Math.min(maxFontSize, newFontSize),
		);
		if (clampedFontSize !== this.terminal.options.fontSize) {
			this.options.onFontSizeChange(clampedFontSize);
		}
	}
	endPinchZoom() {
		this.isPinching = false;
		this.pinchStartDistance = 0;
		this.lastPinchDistance = 0;
		this.initialFontSize = 0;
	}
	getDistance(touch1, touch2) {
		const dx = touch2.clientX - touch1.clientX;
		const dy = touch2.clientY - touch1.clientY;
		return Math.sqrt(dx * dx + dy * dy);
	}
	isEdgeGesture(touch) {
		const edgeThreshold = 30;
		const screenWidth = window.innerWidth;
		if (touch.clientX <= edgeThreshold) {
			return true;
		}
		if (touch.clientX >= screenWidth - edgeThreshold) {
			return true;
		}
		return false;
	}
	destroy() {
		this.forceClearSelection();
		this.terminal.element.removeEventListener(
			"touchstart",
			this.boundHandlers.terminalTouchStart,
		);
		this.terminal.element.removeEventListener(
			"touchmove",
			this.boundHandlers.terminalTouchMove,
		);
		this.terminal.element.removeEventListener(
			"touchend",
			this.boundHandlers.terminalTouchEnd,
		);
		this.startHandle.removeEventListener(
			"touchstart",
			this.boundHandlers.handleTouchStart,
		);
		this.startHandle.removeEventListener(
			"touchmove",
			this.boundHandlers.handleTouchMove,
		);
		this.startHandle.removeEventListener(
			"touchend",
			this.boundHandlers.handleTouchEnd,
		);
		this.endHandle.removeEventListener(
			"touchstart",
			this.boundHandlers.handleTouchStart,
		);
		this.endHandle.removeEventListener(
			"touchmove",
			this.boundHandlers.handleTouchMove,
		);
		this.endHandle.removeEventListener(
			"touchend",
			this.boundHandlers.handleTouchEnd,
		);
		this.terminalScrollDisposable?.dispose();
		this.terminalScrollDisposable = null;
		window.removeEventListener(
			"orientationchange",
			this.boundHandlers.orientationChange,
		);
		window.removeEventListener("resize", this.boundHandlers.orientationChange);
		if (this.scrollEndTimeout) {
			clearTimeout(this.scrollEndTimeout);
			this.scrollEndTimeout = null;
		}
		if (this.terminal.onSelectionChange) {
			this.terminal.onSelectionChange(null);
		}
		if (this.selectionOverlay && this.selectionOverlay.parentNode) {
			this.selectionOverlay.parentNode.removeChild(this.selectionOverlay);
		}
	}
}
