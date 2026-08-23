import OperationQueue from "./OperationQueue";

const operationQueue = new OperationQueue({
	concurrency: 2,
	historyLimit: 100,
});

export { OperationQueue };
export default operationQueue;
