import WCPage from "./WebComponents/wcPage";

function Page(title, options = {}) {
	let page = <wc-page />;
	page.append = page.appendBody;
	page.initializeIfNotAlreadyInitialized();
	page.settitle(title);
	if (options.tail) {
		page.header.append(options.tail);
	}
	if (options.lead) {
		page.lead = options.lead;
	}
	return page;
}
export default Page;
