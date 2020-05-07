import cp = require('child_process');
import path = require('path');
import sax = require('sax');
import * as vscode from 'vscode';

import { getBinaryPath } from './clangpath';
import { MODES } from './languages';

export let outputChannel = vscode.window.createOutputChannel('logos-vscode');

function getPlatformString() {
	switch (process.platform) {
		case 'win32':
			return 'windows';
		case 'linux':
			return 'linux';
		case 'darwin':
			return 'osx';
	}

	return 'unknown';
}

export class ClangDocumentFormattingEditProvider
	implements
		vscode.DocumentFormattingEditProvider,
		vscode.DocumentRangeFormattingEditProvider {
	private defaults = {
		executable: 'clang-format',
		style: 'file',
		fallbackStyle: 'LLVM',
		assumeFilename: '',
	};

	public provideDocumentFormattingEdits(
		document: vscode.TextDocument,
		options: vscode.FormattingOptions,
		token: vscode.CancellationToken
	): Thenable<vscode.TextEdit[]> {
		return this.doFormatDocument(document, null, token);
	}

	public provideDocumentRangeFormattingEdits(
		document: vscode.TextDocument,
		range: vscode.Range,
		options: vscode.FormattingOptions,
		token: vscode.CancellationToken
	): Thenable<vscode.TextEdit[]> {
		return this.doFormatDocument(document, range, token);
	}

	private getEdits(
		document: vscode.TextDocument,
		xml: string,
		codeContent: string
	): Thenable<vscode.TextEdit[]> {
		return new Promise((resolve, reject) => {
			let options = {
				trim: false,
				normalize: false,
				loose: true,
			};
			let parser = sax.parser(true, options);

			let edits: vscode.TextEdit[] = [];
			let currentEdit: { length: number; offset: number; text: string };

			let codeBuffer = new Buffer(codeContent);
			// encoding position cache
			let codeByteOffsetCache = {
				byte: 0,
				offset: 0,
			};
			let byteToOffset = function (editInfo: {
				length: number;
				offset: number;
			}) {
				let offset = editInfo.offset;
				let length = editInfo.length;

				if (offset >= codeByteOffsetCache.byte) {
					editInfo.offset =
						codeByteOffsetCache.offset +
						codeBuffer
							.slice(codeByteOffsetCache.byte, offset)
							.toString('utf8').length;
					codeByteOffsetCache.byte = offset;
					codeByteOffsetCache.offset = editInfo.offset;
				} else {
					editInfo.offset = codeBuffer
						.slice(0, offset)
						.toString('utf8').length;
					codeByteOffsetCache.byte = offset;
					codeByteOffsetCache.offset = editInfo.offset;
				}

				editInfo.length = codeBuffer
					.slice(offset, offset + length)
					.toString('utf8').length;

				return editInfo;
			};

			parser.onerror = (err) => {
				reject(err.message);
			};

			parser.onopentag = (tag) => {
				if (currentEdit) {
					reject('Malformed output');
				}

				switch (tag.name) {
					case 'replacements':
						return;

					case 'replacement':
						currentEdit = {
							length: parseInt(
								tag.attributes['length'].toString()
							),
							offset: parseInt(
								tag.attributes['offset'].toString()
							),
							text: '',
						};
						byteToOffset(currentEdit);
						break;

					default:
						reject(`Unexpected tag ${tag.name}`);
				}
			};

			parser.ontext = (text) => {
				if (!currentEdit) {
					return;
				}

				currentEdit.text = text;
			};

			parser.onclosetag = () => {
				if (!currentEdit) {
					return;
				}

				let start = document.positionAt(currentEdit.offset);
				let end = document.positionAt(
					currentEdit.offset + currentEdit.length
				);

				let editRange = new vscode.Range(start, end);

				edits.push(new vscode.TextEdit(editRange, currentEdit.text));
				currentEdit = null;
			};

			parser.onend = () => {
				resolve(edits);
			};

			parser.write(xml);
			parser.end();
		});
	}

	/// Get execute name in logos-vscode.executable, if not found, use default value
	/// If configure has changed, it will get the new value
	private getExecutablePath() {
		let platform = getPlatformString();
		let config = vscode.workspace.getConfiguration('logos-vscode');

		let platformExecPath = config.get<string>('executable.' + platform);
		let defaultExecPath = config.get<string>('executable');
		let execPath = platformExecPath || defaultExecPath;

		if (!execPath) {
			return this.defaults.executable;
		}

		// replace placeholders, if present
		return execPath
			.replace(/\${workspaceRoot}/g, vscode.workspace.rootPath)
			.replace(/\${workspaceFolder}/g, this.getWorkspaceFolder())
			.replace(/\${cwd}/g, process.cwd())
			.replace(/\${env\.([^}]+)}/g, (sub: string, envName: string) => {
				return process.env[envName];
			});
	}

	private getStyle() {
		let ret = vscode.workspace
			.getConfiguration('logos-vscode')
			.get<string>('style');
		if (ret && ret.trim()) {
			return ret.trim();
		} else {
			return this.defaults.style;
		}
	}

	private getFallbackStyle() {
		let strConf = vscode.workspace
			.getConfiguration('logos-vscode')
			.get<string>('fallbackStyle');
		if (strConf && strConf.trim()) {
			return strConf;
		}

		return this.defaults.style;
	}

	private getAssumedFilename(document: vscode.TextDocument) {
		let assumedFilename = vscode.workspace
			.getConfiguration('logos-vscode')
			.get<string>('assumeFilename');
		if (assumedFilename === '') {
			return document.fileName;
		}
		let parsedPath = path.parse(document.fileName);
		let fileNoExtension = path.join(parsedPath.dir, parsedPath.name);
		return assumedFilename
			.replace(/\${file}/g, document.fileName)
			.replace(/\${fileNoExtension}/g, fileNoExtension)
			.replace(/\${fileBasename}/g, parsedPath.base)
			.replace(/\${fileBasenameNoExtension}/g, parsedPath.name)
			.replace(/\${fileExtname}/g, parsedPath.ext);
	}

	private getWorkspaceFolder(): string | undefined {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage(
				'Unable to get the location of logos-vscode executable - no active workspace selected'
			);
			return undefined;
		}

		if (!vscode.workspace.workspaceFolders) {
			vscode.window.showErrorMessage(
				'Unable to get the location of logos-vscode executable - no workspaces available'
			);
			return undefined;
		}

		const currentDocumentUri = editor.document.uri;
		let workspacePath = vscode.workspace.getWorkspaceFolder(
			currentDocumentUri
		);
		if (!workspacePath) {
			const fallbackWorkspace = vscode.workspace.workspaceFolders[0];
			vscode.window.showWarningMessage(
				`Unable to deduce the location of logos-vscode executable for file outside the workspace - expanding \${workspaceFolder} to '${fallbackWorkspace.name}' path`
			);
			workspacePath = fallbackWorkspace;
		}
		return workspacePath.uri.path;
	}

	private doFormatDocument(
		document: vscode.TextDocument,
		range?: vscode.Range,
		token?: vscode.CancellationToken
	): Thenable<vscode.TextEdit[]> {
		return new Promise((resolve, reject) => {
			let formatCommandBinPath = getBinaryPath(this.getExecutablePath());
			let codeContent = document.getText();

			let formatArgs = [
				'-output-replacements-xml',
				`-style=${this.getStyle()}`,
				`-fallback-style=${this.getFallbackStyle()}`,
				`-assume-filename=${this.getAssumedFilename(document)}`,
			];

			if (range) {
				let offset = document.offsetAt(range.start);
				let length = document.offsetAt(range.end) - offset;

				// fix charater length to byte length
				length = Buffer.byteLength(
					codeContent.substr(offset, length),
					'utf8'
				);
				// fix charater offset to byte offset
				offset = Buffer.byteLength(
					codeContent.substr(0, offset),
					'utf8'
				);

				formatArgs.push(`-offset=${offset}`, `-length=${length}`);
			}

			let workingPath = vscode.workspace.rootPath;
			if (!document.isUntitled) {
				workingPath = path.dirname(document.fileName);
			}

			let stdout = '';
			let stderr = '';
			let child = cp.spawn(formatCommandBinPath, formatArgs, {
				cwd: workingPath,
			});
			child.stdin.end(codeContent);
			child.stdout.on('data', (chunk) => (stdout += chunk));
			child.stderr.on('data', (chunk) => (stderr += chunk));
			child.on('error', (err) => {
				if (err && (<any>err).code === 'ENOENT') {
					vscode.window.showInformationMessage(
						"The '" +
							formatCommandBinPath +
							"' command is not available.  Please check your logos-vscode.executable user setting and ensure it is installed."
					);
					return resolve(null);
				}
				return reject(err);
			});
			child.on('close', (code) => {
				try {
					if (stderr.length !== 0) {
						outputChannel.show();
						outputChannel.clear();
						outputChannel.appendLine(stderr);
						return reject('Cannot format due to syntax errors.');
					}

					if (code !== 0) {
						return reject();
					}

					return resolve(
						this.getEdits(document, stdout, codeContent)
					);
				} catch (e) {
					reject(e);
				}
			});

			if (token) {
				token.onCancellationRequested(() => {
					child.kill();
					reject('Cancelation requested');
				});
			}
		});
	}

	public formatDocument(
		document: vscode.TextDocument
	): Thenable<vscode.TextEdit[]> {
		return this.doFormatDocument(document);
	}
}

export function activate(ctx: vscode.ExtensionContext): void {
	let formatter = new ClangDocumentFormattingEditProvider();
	let availableLanguages = {};

	MODES.forEach((mode) => {
		ctx.subscriptions.push(
			vscode.languages.registerDocumentRangeFormattingEditProvider(
				mode,
				formatter
			)
		);
		ctx.subscriptions.push(
			vscode.languages.registerDocumentFormattingEditProvider(
				mode,
				formatter
			)
		);
		availableLanguages[mode.language] = true;
	});
}
