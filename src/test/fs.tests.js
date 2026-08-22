import fsOperation from "fileSystem";
import Url from "utils/Url";
import { TestRunner } from "./tester";
export async function runFsTests(writeOutput) {
	const runner = new TestRunner("Filesystem API Tests");
	const testDir = window.CACHE_STORAGE || "file:///sdcard/AcodeCache";
	runner.test("CACHE_STORAGE is defined", (test) => {
		test.assert(
			typeof window.CACHE_STORAGE === "string",
			"CACHE_STORAGE should be a string path",
		);
	});
	runner.test("fsOperation returns a FileSystem object", (test) => {
		const fs = fsOperation(testDir);
		test.assert(fs !== null, "fsOperation should return filesystem handler");
		test.assert(
			typeof fs.createFile === "function",
			"createFile should be a function",
		);
		test.assert(typeof fs.exists === "function", "exists should be a function");
	});
	runner.test(
		"createFile, exists, writeFile, readFile, delete",
		async (test) => {
			const fs = fsOperation(testDir);
			const filename = `__fs_test_${Date.now()}__.txt`;
			const fileUrl = Url.join(testDir, filename);
			try {
				const createdUrl = await fs.createFile(filename, "initial content");
				test.assertEqual(
					createdUrl,
					fileUrl,
					"Created file URL should match expected path",
				);
				const fileFs = fsOperation(createdUrl);
				const exists = await fileFs.exists();
				test.assertEqual(exists, true, "Created file should exist");
				const content = await fileFs.readFile("utf-8");
				test.assertEqual(
					content,
					"initial content",
					"Read content should match initial content",
				);
				await fileFs.writeFile("updated content");
				const updatedContent = await fileFs.readFile("utf-8");
				test.assertEqual(
					updatedContent,
					"updated content",
					"Read content should match updated content",
				);
				const stat = await fileFs.stat();
				test.assert(stat !== null, "Stat should not be null");
				test.assertEqual(stat.isFile, true, "Stat should show isFile true");
				test.assertEqual(
					stat.isDirectory,
					false,
					"Stat should show isDirectory false",
				);
				await fileFs.delete();
				const existsAfterDelete = await fileFs.exists();
				test.assertEqual(
					existsAfterDelete,
					false,
					"File should not exist after deletion",
				);
			} catch (error) {
				try {
					const fileFs = fsOperation(fileUrl);
					if (await fileFs.exists()) {
						await fileFs.delete();
					}
				} catch (_) {}
				throw error;
			}
		},
	);
	runner.test("createDirectory, lsDir, delete directory", async (test) => {
		const fs = fsOperation(testDir);
		const dirname = `__fs_dir_test_${Date.now()}__`;
		const dirUrl = Url.join(testDir, dirname);
		try {
			const createdDirUrl = await fs.createDirectory(dirname);
			test.assertEqual(
				createdDirUrl,
				dirUrl,
				"Created directory URL should match expected path",
			);
			const dirFs = fsOperation(createdDirUrl);
			const exists = await dirFs.exists();
			test.assertEqual(exists, true, "Created directory should exist");
			const stat = await dirFs.stat();
			test.assertEqual(
				stat.isDirectory,
				true,
				"Stat should show isDirectory true",
			);
			test.assertEqual(stat.isFile, false, "Stat should show isFile false");
			const fileUrl = await dirFs.createFile("child.txt", "child content");
			const list = await dirFs.lsDir();
			const child = list.find((item) => item.name === "child.txt");
			test.assert(
				child !== undefined,
				"lsDir should list the created child file",
			);
			test.assertEqual(child.isFile, true, "child item should be a file");
			const childFs = fsOperation(fileUrl);
			await childFs.delete();
			await dirFs.delete();
			const dirExistsAfterDelete = await dirFs.exists();
			test.assertEqual(
				dirExistsAfterDelete,
				false,
				"Directory should not exist after deletion",
			);
		} catch (error) {
			try {
				const dirFs = fsOperation(dirUrl);
				if (await dirFs.exists()) {
					await dirFs.delete();
				}
			} catch (_) {}
			throw error;
		}
	});
	runner.test("read/write with explicit encodings", async (test) => {
		const fs = fsOperation(testDir);
		const utf8Filename = `__fs_utf8_test_${Date.now()}__.txt`;
		const gbkFilename = `__fs_gbk_test_${Date.now()}__.txt`;
		const utf8FileUrl = Url.join(testDir, utf8Filename);
		const gbkFileUrl = Url.join(testDir, gbkFilename);
		try {
			const utf8Url = await fs.createFile(utf8Filename, "");
			const utf8Fs = fsOperation(utf8Url);
			await utf8Fs.writeFile("Hello 世界 (UTF-8)", "utf-8");
			const utf8Content = await utf8Fs.readFile("utf-8");
			test.assertEqual(
				utf8Content,
				"Hello 世界 (UTF-8)",
				"UTF-8 read/write should match",
			);
			const gbkUrl = await fs.createFile(gbkFilename, "");
			const gbkFs = fsOperation(gbkUrl);
			await gbkFs.writeFile("Hello 世界 (GBK)", "gbk");
			const gbkContent = await gbkFs.readFile("gbk");
			test.assertEqual(
				gbkContent,
				"Hello 世界 (GBK)",
				"GBK read/write should match",
			);
			await utf8Fs.delete();
			await gbkFs.delete();
		} catch (error) {
			try {
				await fsOperation(utf8FileUrl).delete();
			} catch (_) {}
			try {
				await fsOperation(gbkFileUrl).delete();
			} catch (_) {}
			throw error;
		}
	});
	return await runner.run(writeOutput);
}
