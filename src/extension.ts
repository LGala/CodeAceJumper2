import { Selection } from 'vscode';
import { Disposable, ExtensionContext, Range, TextDocument, TextEditorDecorationType, commands, window } from 'vscode';

type CharPlaceholderRange = { range: Range; decoration: TextEditorDecorationType; currentJumpPlaceholder: string };

const getDecoration = (contentText: string) =>
	window.createTextEditorDecorationType({
		letterSpacing: '-16px',
		opacity: '0',
		after: {
			color: '#000000',
			backgroundColor: '#8B8000',
			contentText,
		},
	});

const getCharPlaceholders = (
	jumpableChars: { char: string; absoluteIndex: number }[],
	document: TextDocument,
	offset: number,
) => {
	const charsToHighLight: CharPlaceholderRange[] = [];
	let currentJumpPlaceholderAsList = ['a'];
	let currentJumpPlaceholder = 'a';
	let lastJumpPlaceholderAsListPosition = 0;
	let lastUsedLetterIndex = 0;
	const allLetters = [
		'a',
		'b',
		'c',
		'd',
		'e',
		'f',
		'g',
		'h',
		'i',
		'j',
		'k',
		'l',
		'm',
		'n',
		'o',
		'p',
		'q',
		'r',
		's',
		't',
		'u',
		'v',
		'w',
		'x',
		'y',
		'z',
	];

	for (let i = 0; i < jumpableChars.length; i++) {
		if (lastUsedLetterIndex < allLetters.length - 1) {
			currentJumpPlaceholderAsList[lastJumpPlaceholderAsListPosition] = allLetters[lastUsedLetterIndex++];
			currentJumpPlaceholder = currentJumpPlaceholderAsList.join('');
		} else {
			currentJumpPlaceholderAsList.push('a');
			lastJumpPlaceholderAsListPosition++;
			lastUsedLetterIndex = 0;
		}

		charsToHighLight.push({
			range: new Range(
				document!.positionAt(jumpableChars[i].absoluteIndex + offset)!,
				document!.positionAt(jumpableChars[i].absoluteIndex + 1 + offset)!,
			),
			decoration: getDecoration(currentJumpPlaceholder),
			currentJumpPlaceholder,
		});
	}

	return charsToHighLight;
};

const getSingleJumpableCharsPlaceholders = (charToHighLight: string): CharPlaceholderRange[] => {
	const document = window.activeTextEditor?.document!;
	const visibleRange = window.activeTextEditor?.visibleRanges.at(0)!;
	const tokens = document.getText(visibleRange).split('');

	console.log(charToHighLight);

	const byJumpableChars = ({ char, absoluteIndex }: { char: string; absoluteIndex: number }): boolean =>
		char === charToHighLight &&
		charToHighLight !== '\n' &&
		(/[\p{P}\s\n]/gu.test(char) || /[\p{P}\s\n]/gu.test(tokens[absoluteIndex - 1]) || absoluteIndex === 0);

	const jumpableChars = tokens.map((char, absoluteIndex) => ({ char, absoluteIndex })).filter(byJumpableChars);

	return getCharPlaceholders(jumpableChars, document, document.offsetAt(visibleRange.start)!);
};

const exitFromCommand = (diposable: Disposable, charsToUnhighLight: CharPlaceholderRange[]): 'init' => {
	charsToUnhighLight.forEach(({ decoration }) => {
		window.activeTextEditor?.setDecorations(decoration, []);
	});
	diposable.dispose();
	return 'init';
};

const putPlaceholdersOnJumpableChars = ({ range: charToHighLightRange, decoration }: CharPlaceholderRange) => {
	window.activeTextEditor?.setDecorations(decoration, [charToHighLightRange]);
};

const singleCharJump = () => {
	let status: 'init' | 'single-char-jump-decided-char' = 'init';
	let charsToHighLight: CharPlaceholderRange[];

	const disposeOnCharPressed = commands.registerCommand('type', ({ text: selectedChar }: { text: string }) => {
		charsToHighLight ||= getSingleJumpableCharsPlaceholders(selectedChar);

		if (selectedChar === '\n') {
			status = exitFromCommand(disposeOnCharPressed, charsToHighLight);
		} else if (status === 'init') {
			if (charsToHighLight.length === 1) {
				const positionToJump = charsToHighLight.find(
					({ currentJumpPlaceholder }) => selectedChar === currentJumpPlaceholder,
				)?.range.start!;
				window.activeTextEditor!.selection = new Selection(positionToJump, positionToJump);
				exitFromCommand(disposeOnCharPressed, charsToHighLight);
			} else {
				charsToHighLight.forEach(putPlaceholdersOnJumpableChars);
				status = 'single-char-jump-decided-char';
			}
		} else if (status === 'single-char-jump-decided-char') {
			const positionToJump = charsToHighLight.find(
				({ currentJumpPlaceholder }) => selectedChar === currentJumpPlaceholder,
			)?.range.start!;
			window.activeTextEditor!.selection = new Selection(positionToJump, positionToJump);
			status = exitFromCommand(disposeOnCharPressed, charsToHighLight);
		}
	});
};

export function activate(context: ExtensionContext) {
	context.subscriptions.push(commands.registerCommand('codeacejumper2.singlechar.jump', singleCharJump));
}
