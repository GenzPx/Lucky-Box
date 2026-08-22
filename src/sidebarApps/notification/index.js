import "./style.scss";
import Sidebar from "components/sidebar";
import notificationManager from "lib/notificationManager";

let container;
let $notificationContainer = null;
export default [
	"notifications",
	"notification",
	strings["notifications"],
	initApp,
	false,
	onSelected,
];
const $header = (
	<div className="header">
		<div className="title">
			{strings["notifications"]}
			<button
				type="button"
				className="icon-button"
				onclick={() => notificationManager.clearAll()}
			>
				<span data-action="clear" className="icon clearclose"></span>
			</button>
		</div>
	</div>
);
function initApp(el) {
	container = el;
	container.classList.add("notifications");
	container.content = $header;
	$notificationContainer = (
		<div className="notifications-container scroll"></div>
	);
	container.append($notificationContainer);
	Sidebar.on("show", onSelected);
}
function onSelected(el) {
	const $scrollableLists = container.getAll(":scope .scroll[data-scroll-top]");
	$scrollableLists.forEach(($el) => {
		$el.scrollTop = $el.dataset.scrollTop;
	});
}
