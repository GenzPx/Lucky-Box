import "./style.scss";
import Page from "components/page";
import DOMPurify from "dompurify";
import actionStack from "lib/actionStack";
import markdownIt from "markdown-it";
import markdownItFootnote from "markdown-it-footnote";
import markdownItTaskLists from "markdown-it-task-lists";
export default async function Changelog() {
	const page = Page("LuckyBox Changelog");
	const changelog = await import("../../../CHANGELOG.md");
	const renderer = markdownIt({
		html: false,
		linkify: true,
		typographer: true,
	})
		.use(markdownItFootnote)
		.use(markdownItTaskLists);
	const html = renderer.render(changelog.default);
	page.body = (
		<div
			className="md scroll"
			id="changelog"
			innerHTML={DOMPurify.sanitize(html)}
		/>
	);
	page.onhide = () => actionStack.remove("changelog");
	actionStack.push({
		id: "changelog",
		action: page.hide,
	});
	app.append(page);
}
