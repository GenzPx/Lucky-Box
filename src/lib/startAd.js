export const BANNER_SUPPRESSION_REASON = Object.freeze({
	PRO: "pro",
	PAGE: "page",
	KEYBOARD: "keyboard",
	REWARD: "reward",
});
export const adUnitIdBanner = "";
export const adUnitIdInterstitial = "";
export const adUnitIdRewarded = "";
export const initialized = false;
export const bannerAd = null;
export const interstitialAd = null;
export default async function startAd() {}
export function getPrivacyState() {
	return {
		available: false,
		required: false,
	};
}
export function subscribePrivacyState(listener) {
	if (typeof listener === "function") listener(getPrivacyState());
	return () => {};
}
export async function showPrivacyOptions() {
	return getPrivacyState();
}
export function setBannerSuppressed() {}
export function requestBannerForPage() {
	return () => {};
}
export function setBannerKeyboardVisible() {}
