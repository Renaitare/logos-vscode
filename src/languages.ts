'use strict';

import * as vscode from 'vscode';
const languages = ['objective-c', 'objective-cpp', 'logos'];
export const MODES: vscode.DocumentFilter[] = languages.map((language) => ({
	language,
	scheme: 'file',
}));
