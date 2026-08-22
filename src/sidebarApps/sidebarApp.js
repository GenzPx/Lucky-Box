let $apps;
let $sidebar;
let $container;
export default class SidebarApp {
	#icon;
	#id;
	#init;
	#title;
	#active;
	#onselect;
	#cleanup = null;
	#container;
	constructor(icon, id, title, init, onselect) {
		const emptyFunc = () => {};
		this.#container = <div className="container"></div>;
		this.#icon = <Icon icon={icon} id={id} title={title} />;
		this.#id = id;
		this.#title = title;
		this.#init = init || emptyFunc;
		this.#onselect = onselect || emptyFunc;
		const cleanup = this.#init(this.#container);
		if (typeof cleanup === "function") {
			this.#cleanup = cleanup;
		}
	}
	install(prepend = false) {
		if (prepend) {
			$apps.prepend(this.#icon);
			return;
		}
		$apps.append(this.#icon);
	}
	static init($el, $el2) {
		$sidebar = $el;
		$apps = $el2;
	}
	get icon() {
		return this.#icon;
	}
	get id() {
		return this.#id;
	}
	get title() {
		return this.#title;
	}
	get active() {
		return !!this.#active;
	}
	set active(value) {
		const nextValue = !!value;
		if (this.#active === nextValue) return;
		this.#active = nextValue;
		this.#icon.classList.toggle("active", this.#active);
		if (this.#active) {
			const oldContainer = getContainer(this.#container);
			try {
				if (oldContainer && oldContainer.parentNode === $sidebar) {
					$sidebar.replaceChild($container, oldContainer);
				} else {
					const existingContainer = $sidebar.get(".container");
					if (existingContainer) {
						$sidebar.replaceChild($container, existingContainer);
					} else {
						$sidebar.appendChild($container);
					}
				}
			} catch (error) {
				console.warn("Error switching sidebar container:", error);
				const existingContainer = $sidebar.get(".container");
				if (existingContainer) {
					existingContainer.remove();
				}
				$sidebar.appendChild($container);
			}
			this.#onselect(this.#container);
		}
	}
	get container() {
		return this.#container;
	}
	get init() {
		return this.#init;
	}
	get onselect() {
		return this.#onselect;
	}
	remove() {
		this.#cleanup?.();
		this.#cleanup = null;
		if (this.#icon) {
			this.#icon.remove();
			this.#icon = null;
		}
		if (this.#container) {
			this.#container.remove();
			this.#container = null;
		}
	}
}
function Icon({ icon, id, title }) {
	const className = `icon ${icon}`;
	return (
		<span
			data-action="sidebar-app"
			data-id={id}
			title={title}
			className={className}
		></span>
	);
}
function getContainer($el) {
	const res = $container;
	if ($el) {
		$container = $el;
	}
	return res || $sidebar.get(".container");
}
