import git from "isomorphic-git";
import localProfile from "lib/localProfile";
import operationQueue from "modules/operationQueue";
import createCordovaGitFs from "./cordovaFs";

const dir = "/repo";
export function createGitCommitService(rootUri) {
	const fs = createCordovaGitFs(rootUri);
	const options = { fs, dir, gitdir: `${dir}/.git` };
	return {
		async isRepository() {
			try {
				await git.resolveRef({ ...options, ref: "HEAD" });
				return true;
			} catch {
				return false;
			}
		},
		async init(defaultBranch = "main") {
			await git.init({ ...options, defaultBranch });
		},
		async branch() {
			return (
				(await git.currentBranch({ ...options, fullname: false })) || "main"
			);
		},
		async status() {
			const matrix = await git.statusMatrix(options);
			return matrix.map(([filepath, head, workdir, stage]) => ({
				filepath,
				head,
				workdir,
				stage,
			}));
		},
		async stage(filepath) {
			await git.add({ ...options, filepath });
		},
		async unstage(filepath) {
			await git.resetIndex({ ...options, filepath });
		},
		async commit(message) {
			const profile = localProfile.read();
			const author = {
				name: profile.name || "LuckyBox User",
				email: `${slug(profile.name || "user")}@luckybox.local`,
			};
			return operationQueue.enqueue(
				async ({ report }) => {
					report({ progress: 0.2, message: "Reading staged files" });
					const oid = await git.commit({ ...options, message, author });
					report({ progress: 1, message: `Committed ${oid.slice(0, 7)}` });
					return oid;
				},
				{ type: "git", title: "Git commit", description: message },
			);
		},
		async log(depth = 20) {
			try {
				return await git.log({ ...options, depth });
			} catch {
				return [];
			}
		},
	};
}
function slug(value) {
	return (
		String(value)
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, ".")
			.replace(/^\.|\.$/g, "") || "user"
	);
}
