import { Plugin } from 'obsidian';

import * as fsp from "fs/promises";
import * as path from "path";

export default class MyPlugin extends Plugin {
	workspacePath: string;
	initialMDate: Date;
	fileWatcher: AsyncIterable<fsp.FileChangeInfo<string>>;
	signalWatcher: AbortController;

	async onload() {
		const basePath = (this.app.vault.adapter as any).basePath;
		this.workspacePath = path.join(basePath, '.obsidian', 'workspace.json');

		this.initialMDate = (await fsp.stat(this.workspacePath)).mtime;

		console.log(`initiale modDate : ${this.initialMDate.toLocaleString()}`);
		// this.fileWatcher = fs.watch(this.workspacePath, this.resetModDate);

		this.signalWatcher = new AbortController();
		// Here we declare a function and call it instantly. This function declares a watcher on the workspace file
		// whenever the file is changed, it reverts the modification date to unSync it from NextCloud.
		(async (filePath: string, modDate: Date) => {
			try {
				this.fileWatcher = fsp.watch(this.workspacePath, this.signalWatcher);
				for await (const event of this.fileWatcher)  // For every event
				{
					if (event.eventType != `change`)
					{
						// If we encounter a not change modification, warn user
						console.warn(`unexpected changes to workspace file : ${event.eventType}`);
					}
					await fsp.utimes(filePath, new Date(), modDate);  // Not sure the await is necessary here
					console.log(`changed modDate of workspace back to ${this.initialMDate.toLocaleString()}`);
				}
			} catch (err) {
				if (err.name === 'AbortError')
					return;  // If we abort the function, stops
				throw err;  // Else we throw the error
			}
		})(this.workspacePath, this.initialMDate);
		console.log(`Watching over workspace file to unSync it to avoid conflict ${this.workspacePath}`);
	}

	onunload() {
		this.signalWatcher.abort(); // Closing the file watcher
	}
}
