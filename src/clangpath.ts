'use strict';

import fs = require('fs');
import path = require('path');

let binPathCache: {
	[bin: string]: string;
} = {};

export function getBinaryPath(binary: string) {
	if (binPathCache[binary]) {
		return binPathCache[binary];
	}

	for (let binNameToSearch of correctBinaryName(binary)) {
		if (fs.existsSync(binNameToSearch)) {
			binPathCache[binary] = binNameToSearch;
			return binNameToSearch;
		}

		if (process.env['PATH']) {
			let pathparts = process.env['PATH'].split(path.delimiter);
			for (let i = 0; i < pathparts.length; i++) {
				let binpath = path.join(pathparts[i], binNameToSearch);

				if (fs.existsSync(binpath)) {
					binPathCache[binary] = binpath;
					return binpath;
				}
			}
		}
	}

	binPathCache[binary] = binary;
	return binary;
}

function correctBinaryName(binname: string): string[] {
	if (process.platform === 'win32') {
		return [binname + '.exe', binname + '.bat', binname + '.cmd', binname];
	} else {
		return [binname];
	}
}
