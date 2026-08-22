import type { Extension } from "@codemirror/state";
export type LanguageExtensionProvider = () => Extension | Promise<Extension>;
export interface AddModeOptions {
  aliases?: string[];
  filenameMatchers?: RegExp[];
}
export interface ModesByName {
  [name: string]: Mode;
}
const modesByName: ModesByName = {};
const modes: Mode[] = [];
function normalizeModeKey(value: string): string {
  return String(value ?? "").trim().toLowerCase();
}
function normalizeAliases(aliases: string[] = [], name: string): string[] {
  const normalized = new Set<string>();
  for (const alias of aliases) {
    const key = normalizeModeKey(alias);
    if (!key || key === name) continue;
    normalized.add(key);
  }
  return [...normalized];
}
function escapeRegExp(value: string): string {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export function initModes(): void {}
export function addMode(name: string, extensions: string | string[], caption?: string, languageExtension: LanguageExtensionProvider | null = null, options: AddModeOptions = {}): void {
  const filename = normalizeModeKey(name);
  const mode = new Mode(filename, caption, extensions, languageExtension, options);
  modesByName[filename] = mode;
  mode.aliases.forEach(alias => {
    if (!modesByName[alias]) {
      modesByName[alias] = mode;
    }
  });
  modes.push(mode);
}
export function removeMode(name: string): void {
  const filename = normalizeModeKey(name);
  const mode = modesByName[filename];
  if (!mode) return;
  delete modesByName[mode.name];
  mode.aliases.forEach(alias => {
    if (modesByName[alias] === mode) {
      delete modesByName[alias];
    }
  });
  const modeIndex = modes.findIndex(registeredMode => registeredMode === mode);
  if (modeIndex >= 0) {
    modes.splice(modeIndex, 1);
  }
}
export function getModeForPath(path: string): Mode {
  let mode = modesByName.text;
  const fileName = path.split(/[/\\]/).pop() || "";
  const sortedModes = [...modes].sort((a, b) => {
    const scoreDiff = getModeSpecificityScore(b) - getModeSpecificityScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return modes.indexOf(b) - modes.indexOf(a);
  });
  for (const iMode of sortedModes) {
    if (iMode.supportsFile?.(fileName)) {
      mode = iMode;
      break;
    }
  }
  return mode;
}
function getModeSpecificityScore(modeInstance: Mode): number {
  if (modeInstance.name.toLowerCase() === "text") {
    return 0;
  }
  const extensionsStr = modeInstance.extensions;
  let maxScore = 0;
  if (extensionsStr) {
    const patterns = extensionsStr.split("|");
    for (const pattern of patterns) {
      let currentScore = 0;
      if (pattern.startsWith("^")) {
        currentScore = 1000 + (pattern.length - 1);
      } else {
        currentScore = pattern.length;
      }
      if (currentScore > maxScore) {
        maxScore = currentScore;
      }
    }
  }
  for (const matcher of modeInstance.filenameMatchers) {
    const score = 1000 + matcher.source.length;
    if (score > maxScore) {
      maxScore = score;
    }
  }
  return maxScore;
}
export function getModesByName(): ModesByName {
  return modesByName;
}
export function getModes(): Mode[] {
  return modes;
}
export function getMode(name: string): Mode | null {
  return modesByName[normalizeModeKey(name)] || null;
}
export class Mode {
  extensions: string;
  caption: string;
  name: string;
  mode: string;
  aliases: string[];
  extRe: RegExp | null;
  filenameMatchers: RegExp[];
  languageExtension: LanguageExtensionProvider | null;
  constructor(name: string, caption: string | undefined, extensions: string | string[], languageExtension: LanguageExtensionProvider | null = null, options: AddModeOptions = {}) {
    if (Array.isArray(extensions)) {
      extensions = extensions.join("|");
    }
    this.name = name;
    this.mode = name;
    this.extensions = extensions;
    this.caption = caption || this.name.replace(/_/g, " ");
    this.aliases = normalizeAliases(options.aliases, this.name);
    this.filenameMatchers = Array.isArray(options.filenameMatchers) ? options.filenameMatchers.filter(matcher => matcher instanceof RegExp) : [];
    this.languageExtension = languageExtension;
    let re = "";
    if (!extensions) {
      this.extRe = null;
      return;
    }
    const patterns = extensions.split("|").map(pattern => pattern.trim()).filter(Boolean);
    const filenamePatterns = patterns.filter(pattern => pattern.startsWith("^")).map(pattern => `^${escapeRegExp(pattern.slice(1))}$`);
    const extensionPatterns = patterns.filter(pattern => !pattern.startsWith("^")).map(pattern => escapeRegExp(pattern));
    const regexParts: string[] = [];
    if (extensionPatterns.length) {
      regexParts.push(`^.*?\\.(${extensionPatterns.join("|")})$`);
    }
    regexParts.push(...filenamePatterns);
    if (!regexParts.length) {
      this.extRe = null;
      return;
    }
    re = regexParts.length === 1 ? regexParts[0] : `(?:${regexParts.join("|")})`;
    this.extRe = new RegExp(re, "i");
  }
  supportsFile(filename: string): boolean {
    if (this.extRe?.test(filename)) return true;
    return this.filenameMatchers.some(matcher => {
      matcher.lastIndex = 0;
      return matcher.test(filename);
    });
  }
  getExtension(): LanguageExtensionProvider | null {
    return this.languageExtension;
  }
  isAvailable(): boolean {
    return this.languageExtension !== null;
  }
}
