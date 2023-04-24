import * as assert from 'assert';
import { IncrementalStringGenerator } from '../../extension';

suite('IncrementalStringGenerator Test Suite', () => {
	const alphabet = 'abc';

	test('IncrementalStringGenerator WHEN we need 3 placeholders', () => {
		const placeholderGenerator = new IncrementalStringGenerator(3, alphabet);
		assert.strictEqual(placeholderGenerator.next(), 'a');
		assert.strictEqual(placeholderGenerator.next(), 'b');
		assert.strictEqual(placeholderGenerator.next(), 'c');
	});

	test('IncrementalStringGenerator WHEN we need 6 placeholders', () => {
		const placeholderGenerator = new IncrementalStringGenerator(6, alphabet);
		assert.strictEqual(placeholderGenerator.next(), 'aa');
		assert.strictEqual(placeholderGenerator.next(), 'ab');
		assert.strictEqual(placeholderGenerator.next(), 'ac');
		assert.strictEqual(placeholderGenerator.next(), 'ba');
		assert.strictEqual(placeholderGenerator.next(), 'bb');
		assert.strictEqual(placeholderGenerator.next(), 'bc');
	});

	test('IncrementalStringGenerator WHEN we need 10 placeholders', () => {
		const placeholderGenerator = new IncrementalStringGenerator(10, alphabet);
		assert.strictEqual(placeholderGenerator.next(), 'aaa');
		assert.strictEqual(placeholderGenerator.next(), 'aab');
		assert.strictEqual(placeholderGenerator.next(), 'aac');
		assert.strictEqual(placeholderGenerator.next(), 'aba');
		assert.strictEqual(placeholderGenerator.next(), 'abb');
		assert.strictEqual(placeholderGenerator.next(), 'abc');
		assert.strictEqual(placeholderGenerator.next(), 'aca');
		assert.strictEqual(placeholderGenerator.next(), 'acb');
		assert.strictEqual(placeholderGenerator.next(), 'acc');
		assert.strictEqual(placeholderGenerator.next(), 'baa');
	});
});
