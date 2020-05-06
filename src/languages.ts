'use strict';

import * as vscode from 'vscode';

let languages: string[] = [];
for (let language of ['objective-c', 'objective-cpp', 'logos']) {
	let confKey = `language.${language}.enable`;

	if (vscode.workspace.getConfiguration('logos-vscode').get(confKey)) {
		languages.push(language);
	}
}

export const MODES: vscode.DocumentFilter[] = languages.map((language) => ({
	language, scheme: 'file'
}));
