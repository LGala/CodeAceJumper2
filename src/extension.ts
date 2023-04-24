import {
	Position,
	Selection,
	Disposable,
	ExtensionContext,
	Range,
	TextEditorDecorationType,
	commands,
	window,
} from 'vscode';

type Placeholder = { range: Range; decoration: TextEditorDecorationType; placeholder: string };
type Char = { char: string; absoluteIndex: number };
type SingleCharJumpStatus = 'init' | 'wait-to-jump-for-another-typing' | 'want-to-exit';

export class IncrementalStringGenerator {
	private alphabet: string;
	private alphabetIndexes: number[];

	constructor(placeholdersToGenerateCount: number, alphabet = 'abcdefghijklmnopqrstuvwxyz') {
		this.alphabetIndexes = [0];
		this.alphabet = alphabet;
		let combinationsCount = this.alphabet.length;

		while (placeholdersToGenerateCount > combinationsCount) {
			this.alphabetIndexes.push(0);
			combinationsCount *= combinationsCount;
		}
	}

	next() {
		const generatedStringAsList = [];
		for (const char of this.alphabetIndexes) {
			generatedStringAsList.unshift(this.alphabet[char]);
		}
		this.increment();
		return generatedStringAsList.join('');
	}

	private increment() {
		for (let i = 0; i < this.alphabetIndexes.length; i++) {
			if (++this.alphabetIndexes[i] >= this.alphabet.length) {
				this.alphabetIndexes[i] = 0;
			} else {
				return;
			}
		}
		this.alphabetIndexes.push(0);
	}

	*[Symbol.iterator]() {
		while (true) {
			yield this.next();
		}
	}
}

const jumpToPosition = (position: Position) => {
	if (position) {
		window.activeTextEditor!.selection = new Selection(position, position);
	}
};

const getDocument = () => window.activeTextEditor?.document!;

const getVisibleChars = () => getDocument().getText(window.activeTextEditor?.visibleRanges.at(0)!).split('');

const getOffset = () => getDocument().offsetAt(window.activeTextEditor?.visibleRanges.at(0)!.start!)!;

const getDecoration = (contentText: string) =>
	window.createTextEditorDecorationType({
		letterSpacing: '-16px',
		opacity: '0',
		after: {
			color: '#0f18b6',
			backgroundColor: '#f0e749',
			fontWeight: 'bolder',
			contentText,
		},
	});

const getPlaceholder = ({ absoluteIndex }: Char, placeholderGenerator: IncrementalStringGenerator): Placeholder => {
	const placeholder = placeholderGenerator.next();

	return {
		range: new Range(
			getDocument()!.positionAt(absoluteIndex + getOffset())!,
			getDocument()!.positionAt(absoluteIndex + 1 + getOffset())!,
		),
		decoration: getDecoration(placeholder),
		placeholder,
	};
};

const isCharJumpable = ({ char, absoluteIndex }: Char, tokens: string[], selectedChar: string): boolean =>
	char.toLowerCase() === selectedChar &&
	selectedChar !== '\n' &&
	(/[\p{P}\s\n]/gu.test(char) || /[\p{P}\s\n]/gu.test(tokens[absoluteIndex - 1]) || absoluteIndex === 0);

const getSingleJumpableCharsPlaceholders = (selectedChar: string): Placeholder[] => {
	const tokens = getVisibleChars();

	const jumpableChars: Char[] = tokens
		.map((char, absoluteIndex) => ({ char, absoluteIndex }))
		.filter(char => isCharJumpable(char, tokens, selectedChar));

	const placeholderGenerator = new IncrementalStringGenerator(jumpableChars.length);

	return jumpableChars.map(char => getPlaceholder(char, placeholderGenerator));
};

const unhighLightPlaceholders = (charsToUnhighLight: Placeholder[]) => {
	charsToUnhighLight.forEach(({ decoration }) => {
		window.activeTextEditor?.setDecorations(decoration, []);
	});
};

const putPlaceholdersOnJumpableChars = ({ range, decoration }: Placeholder) => {
	window.activeTextEditor?.setDecorations(decoration, [range]);
};

const getPlaceholdersWithPlaceholderRemoved = (
	placeholders: Placeholder[],
	placeholderSelectedSoFar: string,
): Placeholder[] => {
	return placeholders
		.filter(({ placeholder }) => placeholder.startsWith(placeholderSelectedSoFar))
		.map(({ placeholder, range }) => {
			const newPlaceholder = placeholder.replace(placeholderSelectedSoFar, '');
			return {
				range,
				decoration: getDecoration(newPlaceholder),
				placeholder: newPlaceholder,
			};
		});
};

const tryJumpToPlaceholder = (
	placeholders: Placeholder[],
	selctedChar: string,
): [SingleCharJumpStatus, Placeholder[]] => {
	if (placeholders.at(0)?.placeholder.length! > 1) {
		const nextPlaceHolders = getPlaceholdersWithPlaceholderRemoved(placeholders, selctedChar);
		unhighLightPlaceholders(placeholders);
		nextPlaceHolders.forEach(putPlaceholdersOnJumpableChars);

		if (nextPlaceHolders.length === 1) {
			jumpToPosition(nextPlaceHolders[0]!.range!.start!);
			return ['want-to-exit', nextPlaceHolders];
		}

		return ['wait-to-jump-for-another-typing', nextPlaceHolders];
	}

	const positionToJump = placeholders.find(({ placeholder }) => selctedChar === placeholder);

	jumpToPosition(positionToJump?.range.start!);

	return ['want-to-exit', placeholders];
};

const earlyJumpOrPutPlaceholders = (placeholders: Placeholder[]): SingleCharJumpStatus => {
	if (!placeholders.length) {
		return 'want-to-exit';
	}

	if (placeholders.length === 1) {
		jumpToPosition(placeholders[0]!.range!.start!);
		return 'want-to-exit';
	}

	placeholders.forEach(putPlaceholdersOnJumpableChars);
	return 'wait-to-jump-for-another-typing';
};

const checkForExit = (
	placeholders: Placeholder[],
	command: Disposable,
	selectedChar: string,
	status: SingleCharJumpStatus,
) => {
	if (selectedChar === '\n' || status === 'want-to-exit') {
		unhighLightPlaceholders(placeholders);
		command.dispose();
	}
};

const singleCharJump = () => {
	let status: SingleCharJumpStatus = 'init';
	let placeholders: Placeholder[];

	const command = commands.registerCommand('type', ({ text: selectedChar }: { text: string }) => {
		selectedChar = selectedChar.toLowerCase();
		placeholders ||= getSingleJumpableCharsPlaceholders(selectedChar);

		checkForExit(placeholders, command, selectedChar, status);

		if (status === 'init') {
			status = earlyJumpOrPutPlaceholders(placeholders);
		} else if (status === 'wait-to-jump-for-another-typing') {
			[status, placeholders] = tryJumpToPlaceholder(placeholders, selectedChar);
		}

		checkForExit(placeholders, command, selectedChar, status);
	});
};

export function activate(context: ExtensionContext) {
	context.subscriptions.push(commands.registerCommand('codeacejumper2.singlechar.jump', singleCharJump));
}
