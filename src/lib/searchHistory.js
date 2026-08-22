const HISTORY_KEY = "acode.searchreplace.history";
const MAX_HISTORY_ITEMS = 20;
class SearchHistory {
	constructor() {
		this.history = this.loadHistory(HISTORY_KEY);
		this.searchIndex = -1;
		this.replaceIndex = -1;
		this.tempSearchValue = "";
		this.tempReplaceValue = "";
	}
	loadHistory(key) {
		try {
			const stored = localStorage.getItem(key);
			return stored ? JSON.parse(stored) : [];
		} catch (error) {
			console.warn("Failed to load search history:", error);
			return [];
		}
	}
	saveHistory() {
		try {
			localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
		} catch (error) {
			console.warn("Failed to save search history:", error);
		}
	}
	addToHistory(item) {
		if (!item || typeof item !== "string" || item.trim().length === 0) {
			return;
		}
		const trimmedItem = item.trim();
		this.history = this.history.filter((h) => h !== trimmedItem);
		this.history.unshift(trimmedItem);
		this.history = this.history.slice(0, MAX_HISTORY_ITEMS);
		this.saveHistory();
	}
	getHistory() {
		return [...this.history];
	}
	clearHistory() {
		this.history = [];
		this.saveHistory();
	}
	navigateSearchUp(currentValue) {
		if (this.history.length === 0) return currentValue;
		if (this.searchIndex === -1) {
			this.tempSearchValue = currentValue;
			this.searchIndex = this.history.length - 1;
		} else if (this.searchIndex > 0) {
			this.searchIndex--;
		}
		return this.history[this.searchIndex] || currentValue;
	}
	navigateSearchDown(currentValue) {
		if (this.history.length === 0 || this.searchIndex === -1) {
			return currentValue;
		}
		this.searchIndex++;
		if (this.searchIndex >= this.history.length) {
			this.searchIndex = -1;
			return this.tempSearchValue;
		}
		return this.history[this.searchIndex];
	}
	navigateReplaceUp(currentValue) {
		if (this.history.length === 0) return currentValue;
		if (this.replaceIndex === -1) {
			this.tempReplaceValue = currentValue;
			this.replaceIndex = this.history.length - 1;
		} else if (this.replaceIndex > 0) {
			this.replaceIndex--;
		}
		return this.history[this.replaceIndex] || currentValue;
	}
	navigateReplaceDown(currentValue) {
		if (this.history.length === 0 || this.replaceIndex === -1) {
			return currentValue;
		}
		this.replaceIndex++;
		if (this.replaceIndex >= this.history.length) {
			this.replaceIndex = -1;
			return this.tempReplaceValue;
		}
		return this.history[this.replaceIndex];
	}
	resetSearchNavigation() {
		this.searchIndex = -1;
		this.tempSearchValue = "";
	}
	resetReplaceNavigation() {
		this.replaceIndex = -1;
		this.tempReplaceValue = "";
	}
	resetAllNavigation() {
		this.resetSearchNavigation();
		this.resetReplaceNavigation();
	}
}
export default new SearchHistory();
