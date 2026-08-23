import settingsPage from "components/settingsPage";
import config from "lib/config";
export default function help() {
	const items = [
		{
			key: "docs",
			text: strings.documentation,
			info: "LuckyBox documentation in the repository",
			icon: "description",
			link: config.DOCS_URL,
			chevron: true,
		},
		{
			key: "help",
			text: strings.help,
			info: "Questions and community support",
			icon: "help",
			link: config.HELP_URL,
			chevron: true,
		},
		{
			key: "faqs",
			text: strings.faqs,
			info: "Frequently asked questions",
			icon: "question_answer",
			link: config.FAQ_URL,
			chevron: true,
		},
		{
			key: "bug_report",
			text: strings.bug_report,
			info: "Open a structured bug report",
			icon: "bug_report",
			link: config.BUG_REPORT_URL,
			chevron: true,
		},
	];
	const page = settingsPage(strings.help, items, () => {}, "separate", {
		preserveOrder: true,
		pageClassName: "detail-settings-page",
		listClassName: "detail-settings-list",
		groupByDefault: true,
	});
	page.show();
}
