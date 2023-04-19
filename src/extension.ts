import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('codeacejumper2.singlechar.jump', () => {});

	context.subscriptions.push(disposable);
}
