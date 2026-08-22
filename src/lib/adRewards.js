const EMPTY_STATE = Object.freeze({
	isActive: false,
	remainingMs: 0,
	canRedeem: false,
});
export default {
	async init() {},
	handleResume() {},
	canShowAds: () => false,
	isRewardedSupported: () => false,
	isWatchingReward: () => false,
	getRewardedUnavailableReason: () => "LuckyBox does not include advertising.",
	getState: () => ({
		...EMPTY_STATE,
	}),
	getOffers: () => [],
	getRemainingLabel: () => "",
	getExpiryLabel: () => "",
	canRedeemNow: () => ({
		ok: false,
		reason: "Advertising is disabled.",
	}),
	onChange: () => () => {},
	async watchOffer() {
		throw new Error("LuckyBox does not include advertising.");
	},
};
