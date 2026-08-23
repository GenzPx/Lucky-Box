const REPOSITORY_URL = "https://github.com/GenzPx/Lucky-Box";
let hasPro = true;
const config = {
	BASE_URL: REPOSITORY_URL,
	API_BASE: "https://acode.app/api",
	REPOSITORY_URL,
	PROFILE_URL: "https://github.com/GenzPx",
	DOCS_URL: `${REPOSITORY_URL}/tree/main/docs`,
	HELP_URL: `${REPOSITORY_URL}/discussions`,
	FAQ_URL: `${REPOSITORY_URL}/blob/main/docs/FAQ.md`,
	BUG_REPORT_URL: `${REPOSITORY_URL}/issues/new?template=bug_report.yml`,
	PLAY_STORE_URL: `${REPOSITORY_URL}/releases`,
	GITHUB_URL: REPOSITORY_URL,
	UPSTREAM_URL: "https://github.com/Acode-Foundation/Acode",
	TELEGRAM_URL: "https://t.me/Ns4ux",
	WHATSAPP_URL: "https://whatsapp.com/channel/0029Vb5NMsa9Gv7QCAqh1T1z",
	YOUTUBE_URL: "https://www.youtube.com/@Gensnpi",
	FACEBOOK_URL: "https://www.facebook.com/profile.php?id=100088285309839",
	SUPPORTED_EDITOR: "cm",
	FILE_NAME_REGEX: /^((?![:<>"\\\|\?\*]).)*$/,
	FONT_SIZE: /^[0-9\.]{1,3}(px|rem|em|pt|mm|pc|in)$/,
	DEFAULT_FILE_SESSION: "default-session",
	DEFAULT_FILE_NAME: "untitled.txt",
	CONSOLE_PORT: 8159,
	SERVER_PORT: 8158,
	PREVIEW_PORT: 8158,
	VIBRATION_TIME: 30,
	VIBRATION_TIME_LONG: 150,
	SCROLL_SPEED_FAST_X2: "FAST_X2",
	SCROLL_SPEED_NORMAL: "NORMAL",
	SCROLL_SPEED_FAST: "FAST",
	SCROLL_SPEED_SLOW: "SLOW",
	SIDEBAR_SLIDE_START_THRESHOLD_PX: 20,
	CUSTOM_THEME: 'body[theme="custom"]',
	ERUDA_CDN: "https://cdn.jsdelivr.net/npm/eruda",
	LOG_FILE_NAME: "LuckyBox.log",
	get HAS_PRO() {
		return hasPro;
	},
	set HAS_PRO(value) {
		hasPro = Boolean(value);
	},
};
export default config;
