import "./style.scss";
import Sidebar from "components/sidebar";
import operationQueue from "modules/operationQueue";

let container;
let list;
let unsubscribe = () => {};
export default ["cached", "activity", "Activity", initApp, false, render];
function initApp(element) {
	container = element;
	container.classList.add("activity-sidebar");
	container.content = (
		<>
			<div className="header">
				<div className="title">Activity</div>
				<button className="icon-button" type="button" onclick={clearFinished}>
					<span className="icon clearclose"></span>
				</button>
			</div>
			<div className="activity-summary"></div>
		</>
	);
	list = <div className="activity-list scroll"></div>;
	container.append(list);
	unsubscribe();
	unsubscribe = operationQueue.onChange(render);
	Sidebar.on("show", render);
	render();
}
function clearFinished() {
	operationQueue.clearCompleted();
	render();
}
function render() {
	if (!container || !list) return;
	const tasks = operationQueue.list();
	const active = tasks.filter((task) =>
		["queued", "running", "paused"].includes(task.state),
	);
	container.get(".activity-summary").textContent = active.length
		? `${active.length} active operation${active.length === 1 ? "" : "s"}`
		: "No active operations";
	list.replaceChildren(...tasks.map(renderTask));
	list.toggleAttribute("data-empty", tasks.length === 0);
}
function renderTask(task) {
	const percent = Math.round((task.progress || 0) * 100);
	const canPause = task.state === "running" || task.state === "queued";
	const canResume = task.state === "paused";
	const canCancel = !["completed", "failed", "cancelled"].includes(task.state);
	return (
		<article className={`activity-task state-${task.state}`}>
			<div className="activity-task-head">
				<span className="icon cached"></span>
				<div>
					<strong>{task.title}</strong>
					<small>{task.message || task.description || task.type}</small>
				</div>
				<span className="activity-state">{task.state}</span>
			</div>
			<div className="activity-progress">
				<span style={{ width: `${percent}%` }}></span>
			</div>
			<div className="activity-task-foot">
				<span>{percent}%</span>
				<div>
					{canPause && (
						<button onclick={() => operationQueue.pause(task.id)}>Pause</button>
					)}
					{canResume && (
						<button onclick={() => operationQueue.resume(task.id)}>
							Resume
						</button>
					)}
					{canCancel && (
						<button onclick={() => operationQueue.cancel(task.id)}>
							Cancel
						</button>
					)}
				</div>
			</div>
		</article>
	);
}
