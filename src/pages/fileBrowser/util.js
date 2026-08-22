import multiPrompt from "dialogs/multiPrompt";
import helpers from "utils/helpers";
export default {
	pushFolder(list, name, url, extra = {}) {
		list.push({
			url: url,
			name: name,
			isDirectory: true,
			parent: true,
			type: "dir",
			...extra,
		});
	},
	async addPath(name, uuid) {
		const res = await multiPrompt(
			strings["add path"],
			[
				{
					id: "uri",
					placeholder: strings["select folder"],
					type: "text",
					required: true,
					readOnly: true,
					onclick() {
						sdcard.getStorageAccessPermission(
							uuid,
							(res) => {
								const $name = tag.get("#name");
								if (!$name.value && res) {
									const name = window
										.decodeURIComponent(res)
										?.split(":")
										.pop()
										?.split("/")
										.pop();
									$name.value = name ?? "";
								}
								this.value = res;
							},
							(err) => {
								helpers.error(err);
							},
						);
					},
				},
				{
					id: "name",
					placeholder: strings["folder name"],
					type: "text",
					required: true,
					value: name ?? "",
				},
			],
			undefined,
		);
		if (!res) return;
		return {
			name: res.name,
			uri: res.uri,
			uuid: helpers.uuid(),
		};
	},
};
