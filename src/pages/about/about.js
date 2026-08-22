import "./about.scss";
import Logo from "components/logo";
import Page from "components/page";
import Reactive from "html-tag-js/reactive";
import actionStack from "lib/actionStack";
import config from "lib/config";
export default function AboutInclude() {
	const page = Page("About & Credits");
	const webviewVersion = Reactive("N/A");
	const webviewPackage = Reactive("N/A");
	page.classList.add("about-us");
	page.body = (
		<main id="about-page" className="main scroll">
			<Logo />
			<div className="version-info">
				<h1 className="version-title">LuckyBox</h1>
				<div className="version-number">
					Version {BuildInfo.version} ({BuildInfo.versionCode})
				</div>
				<p>Mobile code editor and Web DevTools.</p>
			</div>

			<section className="info-section">
				<div className="info-item">
					<div className="info-item-icon">
						<span className="icon smartphone"></span>
					</div>
					<div className="info-item-text">
						Package
						<div className="info-item-subtext">{BuildInfo.packageName}</div>
					</div>
				</div>
				<div className="info-item">
					<div className="info-item-icon">
						<span className="icon public"></span>
					</div>
					<div className="info-item-text">
						Android System WebView {webviewVersion}
						<div className="info-item-subtext">{webviewPackage}</div>
					</div>
				</div>
			</section>

			<section className="info-section">
				<div className="info-item">
					<div className="info-item-icon">
						<span className="icon verified_user"></span>
					</div>
					<div className="info-item-text">
						Privacy
						<div className="info-item-subtext">
							No ads, billing, Google Services, or telemetry. DevTools captures
							stay local and are cleared with the session unless exported
							manually.
						</div>
					</div>
				</div>
			</section>

			<section className="info-section">
				<a href="https://github.com/GenzPx" className="info-item">
					<div className="info-item-icon">
						<span className="icon github"></span>
					</div>
					<div className="info-item-text">
						Created by GenzPx
						<div className="info-item-subtext">github.com/GenzPx</div>
					</div>
				</a>
				<a href={config.GITHUB_URL} className="info-item">
					<div className="info-item-icon">
						<span className="icon github"></span>
					</div>
					<div className="info-item-text">
						Upstream credit
						<div className="info-item-subtext">
							LuckyBox is based on the MIT-licensed Acode v1.13.1 project by
							Foxdebug and Acode Foundation contributors.
						</div>
					</div>
				</a>
				<div className="info-item">
					<div className="info-item-icon">
						<span className="icon description"></span>
					</div>
					<div className="info-item-text">
						Open-source licenses
						<div className="info-item-subtext">
							MIT and third-party notices are included with the LuckyBox source
							and distribution.
						</div>
					</div>
				</div>
			</section>
		</main>
	);
	system.getWebviewInfo((result) => {
		webviewPackage.value = result?.packageName || "N/A";
		webviewVersion.value = result?.versionName || "N/A";
	});
	actionStack.push({
		id: "about",
		action: page.hide,
	});
	page.onhide = () => actionStack.remove("about");
	app.append(page);
}
