import { runAceCompatibilityTests } from "./ace.test";
import { runCodeMirrorTests } from "./editor.tests";
import { runExecutorTests } from "./exec.tests";
import { runFsTests } from "./fs.tests";
import { runLspTests } from "./lsp.tests";
import { runSanityTests } from "./sanity.tests";
import { runUrlTests } from "./url.tests";
export const testDefinitions = [
	runSanityTests,
	runExecutorTests,
	runUrlTests,
	runFsTests,
	runLspTests,
	runCodeMirrorTests,
	runAceCompatibilityTests,
];
