import "./style.scss";
import Sidebar from "components/sidebar";
import toast from "components/toast";
import operationQueue from "modules/operationQueue";

let container;
let service;
let rootUri;
let files;
let branchLabel;
let messageInput;
export default ["git", "git-commit", "Git Commit", initApp, false, refresh];
function initApp(element) {
	container = element;
	container.classList.add("git-commit-sidebar");
	container.content = (
		<>
			<div className="header">
				<div className="title">Git Commit</div>
				<button className="icon-button" type="button" onclick={refresh}>
					<span className="icon refresh"></span>
				</button>
			</div>
			<div className="git-repository"></div>
			<div className="git-branch"></div>
		</>
	);
	branchLabel = container.get(".git-branch");
	files = <div className="git-files scroll"></div>;
	messageInput = (
		<textarea className="git-message" placeholder="Commit message"></textarea>
	);
	container.append(
		files,
		messageInput,
		<button className="git-commit-button" onclick={commit}>
			Commit staged changes
		</button>,
	);
	Sidebar.on("show", refresh);
}
async function refresh() {
	if (!container) return;
	const folder = window.addedFolder?.[0];
	if (!folder?.url) {
		rootUri = null;
		service = null;
		container.get(".git-repository").textContent =
			"Open a project folder to use Git Commit.";
		branchLabel.textContent = "";
		files.replaceChildren();
		return;
	}
	if (rootUri !== folder.url) {
		rootUri = folder.url;
		const { createGitCommitService } = await import("modules/gitCommit");
		service = createGitCommitService(rootUri);
	}
	container.get(".git-repository").textContent = folder.name || rootUri;
	try {
		if (!(await service.isRepository())) {
			files.content = (
				<button className="git-init-button" onclick={initializeRepository}>
					Initialize Git repository
				</button>
			);
			branchLabel.textContent = "Not initialized";
			return;
		}
		branchLabel.textContent = await service.branch();
		const status = await service.status();
		files.replaceChildren(...status.map(renderFile));
		files.toggleAttribute("data-empty", status.length === 0);
	} catch (error) {
		console.error(error);
		toast(`Git error: ${error.message || error}`);
	}
}
async function initializeRepository() {
	try {
		await service.init("main");
		toast("Git repository initialized");
		await refresh();
	} catch (error) {
		toast(`Git init failed: ${error.message || error}`);
	}
}
function renderFile(entry) {
	const staged = entry.stage !== entry.head;
	const changed = entry.workdir !== entry.head;
	const label =
		entry.head === 0
			? "untracked"
			: staged
				? "staged"
				: changed
					? "modified"
					: "clean";
	return (
		<label className={`git-file state-${label}`}>
			<input
				type="checkbox"
				checked={staged}
				onchange={async (event) => {
					if (event.target.checked) await service.stage(entry.filepath);
					else await service.unstage(entry.filepath);
					await refresh();
				}}
			/>
			<span className="git-file-path">{entry.filepath}</span>
			<span className="git-file-state">{label}</span>
		</label>
	);
}
async function commit() {
	const message = messageInput.value.trim();
	if (!message) {
		toast("Enter a commit message");
		return;
	}
	try {
		const task = await service.commit(message);
		messageInput.value = "";
		const unsubscribe = operationQueue.onChange(({ task: changed }) => {
			if (
				changed?.id !== task.id ||
				!["completed", "failed", "cancelled"].includes(changed.state)
			)
				return;
			unsubscribe();
			if (changed.state === "completed") toast("Git commit created");
			else toast(`Git commit ${changed.state}`);
			refresh();
		});
	} catch (error) {
		toast(`Commit failed: ${error.message || error}`);
	}
}
