(function () {
	const _fetch = window.fetch;
	window.fetch = function (url, options) {
		if (typeof url === "string" && url.includes("acode.app/api")) {
			options = {
				...options,
				credentials: "include",
			};
		}
		return _fetch.call(this, url, options);
	};
})();
(function (arr) {
	arr.forEach(function (item) {
		if (item.hasOwnProperty("prepend")) {
			return;
		}
		Object.defineProperty(item, "prepend", {
			configurable: true,
			enumerable: true,
			writable: true,
			value: function prepend() {
				var argArr = Array.prototype.slice.call(arguments),
					docFrag = document.createDocumentFragment();
				argArr.forEach(function (argItem) {
					var node =
						argItem instanceof Node
							? argItem
							: document.createTextNode(String(argItem));
					docFrag.appendChild(node);
				});
				this.insertBefore(docFrag, this.firstChild);
			},
		});
	});
})([Element.prototype, Document.prototype, DocumentFragment.prototype]);
(function (arr) {
	arr.forEach(function (item) {
		if (item.hasOwnProperty("closest")) {
			return;
		}
		Object.defineProperty(item, "closest", {
			configurable: true,
			enumerable: true,
			writable: true,
			value: function closest(s) {
				var matches = (this.document || this.ownerDocument).querySelectorAll(s),
					i,
					el = this;
				do {
					i = matches.length;
					while (--i >= 0 && matches.item(i) !== el) {}
				} while (i < 0 && (el = el.parentElement));
				return el;
			},
		});
	});
})([Element.prototype]);
(function (arr) {
	arr.forEach(function (item) {
		if (item.hasOwnProperty("replaceWith")) {
			return;
		}
		Object.defineProperty(item, "replaceWith", {
			configurable: true,
			enumerable: true,
			writable: true,
			value: function replaceWith() {
				var parent = this.parentNode,
					i = arguments.length,
					currentNode;
				if (!parent) return;
				if (!i) parent.removeChild(this);
				while (i--) {
					currentNode = arguments[i];
					if (typeof currentNode !== "object") {
						currentNode = this.ownerDocument.createTextNode(currentNode);
					} else if (currentNode.parentNode) {
						currentNode.parentNode.removeChild(currentNode);
					}
					if (!i) parent.replaceChild(currentNode, this);
					else parent.insertBefore(this.previousSibling, currentNode);
				}
			},
		});
	});
})([Element.prototype, CharacterData.prototype, DocumentType.prototype]);
(function (arr) {
	arr.forEach(function (item) {
		if (item.hasOwnProperty("replaceChildren")) {
			return;
		}
		Object.defineProperty(item, "replaceChildren", {
			configurable: true,
			enumerable: false,
			writable: true,
			value: function replaceChildren() {
				while (this.firstChild) {
					this.removeChild(this.firstChild);
				}
				Array.prototype.forEach.call(
					arguments,
					function (value) {
						var node = value;
						if (typeof node !== "object") {
							node = this.ownerDocument.createTextNode(String(node));
						} else if (node.parentNode) {
							node.parentNode.removeChild(node);
						}
						this.appendChild(node);
					},
					this,
				);
			},
		});
	});
})([Element.prototype, Document.prototype, DocumentFragment.prototype]);
(function (arr) {
	arr.forEach(function (item) {
		if (item.hasOwnProperty("toggleAttribute")) {
			return;
		}
		Object.defineProperty(item, "toggleAttribute", {
			configurable: true,
			enumerable: true,
			writable: true,
			value: function toggleAttribute() {
				var attr = arguments[0];
				if (this.hasAttribute(attr)) {
					this.removeAttribute(attr);
				} else {
					this.setAttribute(attr, arguments[1] || "");
				}
			},
		});
	});
})([Element.prototype]);
(function () {
	if ("performance" in window === false) {
		window.performance = {};
	}
	Date.now =
		Date.now ||
		function () {
			return new Date().getTime();
		};
	if ("now" in window.performance === false) {
		var nowOffset = Date.now();
		if (performance.timing && performance.timing.navigationStart) {
			nowOffset = performance.timing.navigationStart;
		}
		window.performance.now = function now() {
			return Date.now() - nowOffset;
		};
	}
})();
