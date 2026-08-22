import { BANNER_SUPPRESSION_REASON } from "./bannerVisibilityController.mjs";
const DEFAULT_MAX_TIMEOUT = 2_147_483_647;
export function isRewardPassActive(state, now = Date.now()) {
  return Boolean(state?.isActive && Number(state.adFreeUntil) > Number(now));
}
export function syncRewardBannerSuppression(state, setBannerSuppressed, now = Date.now()) {
  if (typeof setBannerSuppressed !== "function") {
    throw new TypeError("A banner suppression updater is required.");
  }
  const active = isRewardPassActive(state, now);
  setBannerSuppressed(BANNER_SUPPRESSION_REASON.REWARDED_PASS, active);
  return active;
}
export function createRewardStateLifecycle({
  loadStatus,
  normalizeStatus,
  getCurrentState,
  setCurrentState,
  setBannerSuppressed,
  emitChange,
  onRefreshError = () => {},
  onListenerError = () => {},
  onExpiryNotice = () => {},
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  maxTimeout = DEFAULT_MAX_TIMEOUT
}) {
  let expiryTimer = null;
  let pendingRefresh = Promise.resolve();
  function clearExpiryTimer() {
    if (expiryTimer === null) return;
    clearTimer(expiryTimer);
    expiryTimer = null;
  }
  function scheduleExpiryCheck() {
    clearExpiryTimer();
    const currentState = getCurrentState();
    const currentTime = now();
    if (!isRewardPassActive(currentState, currentTime)) return;
    const remainingMs = Number(currentState.adFreeUntil) - currentTime;
    expiryTimer = setTimer(() => {
      expiryTimer = null;
      void startRefresh({
        notifyExpiry: true
      });
    }, Math.min(remainingMs, maxTimeout));
  }
  function applyNormalizedState(nextState) {
    setCurrentState(nextState);
    syncRewardBannerSuppression(nextState, setBannerSuppressed, now());
    try {
      emitChange(nextState);
    } catch (error) {
      onListenerError(error);
    }
    scheduleExpiryCheck();
    return nextState;
  }
  function applyStatus(status) {
    return applyNormalizedState(normalizeStatus(status));
  }
  async function refresh({
    notifyExpiry = false
  } = {}) {
    let nextState;
    try {
      nextState = normalizeStatus(await loadStatus());
    } catch (error) {
      onRefreshError(error);
      return {
        state: getCurrentState(),
        refreshed: false
      };
    }
    applyNormalizedState(nextState);
    if (notifyExpiry && nextState.hasPendingExpiryNotice) {
      try {
        onExpiryNotice(nextState);
      } catch (error) {
        onListenerError(error);
      }
    }
    return {
      state: nextState,
      refreshed: true
    };
  }
  function startRefresh(options) {
    const operation = refresh(options);
    pendingRefresh = operation.then(() => undefined, () => undefined);
    return operation;
  }
  return Object.freeze({
    applyStatus,
    dispose: clearExpiryTimer,
    initialize: () => startRefresh({
      notifyExpiry: false
    }),
    refresh: options => startRefresh(options),
    resume: () => startRefresh({
      notifyExpiry: true
    }),
    whenIdle: () => pendingRefresh
  });
}
