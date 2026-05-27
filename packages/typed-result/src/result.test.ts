import { describe, expect, expectTypeOf, it } from 'vitest';
import { Failure, Success, isFailure, isResult, isSuccess, type Failure as FailureBranch, type Result, type Success as SuccessBranch, type TaggedFailure } from './result.js';

type TaggedF1 = TaggedFailure<'TaggedF1'> & {
	readonly message: 'Lorem ipsum dolor sit amet';
	readonly code: 400;
};

type TaggedF2 = TaggedFailure<'TaggedF2'> & {
	readonly message: 'Consectetur adipiscing elit';
	readonly code: 500;
};

const taggedF1: TaggedF1 = {
	_tag: 'TaggedF1',
	message: 'Lorem ipsum dolor sit amet',
	code: 400,
};

const taggedF2: TaggedF2 = {
	_tag: 'TaggedF2',
	message: 'Consectetur adipiscing elit',
	code: 500,
};

describe('Result runtime behavior', () => {
	it('creates success values as plain serializable objects', () => {
		const result = Success({ id: 1, name: 'John' });

		expect(result).toEqual({
			_kind: 'Success',
			value: {
				id: 1,
				name: 'John',
			},
		});
	});

	it('creates failure values as plain serializable objects', () => {
		const result = Failure(taggedF1);

		expect(result).toEqual({
			_kind: 'Failure',
			_tag: 'TaggedF1',
			failure: taggedF1,
		});
	});

	it('detects valid result envelopes and rejects invalid envelopes', () => {
		expect(isResult(Success(1))).toBe(true);
		expect(isResult(Failure(taggedF1))).toBe(true);

		expect(isResult(null)).toBe(false);
		expect(isResult(undefined)).toBe(false);
		expect(isResult('Success')).toBe(false);
		expect(isResult({ _kind: 'Success' })).toBe(false);
		expect(isResult({ _kind: 'Failure', _tag: 'TaggedF1' })).toBe(false);
		expect(isResult({ _kind: 'Failure', failure: { _tag: 'TaggedF1' } })).toBe(false);
		expect(isResult({ _kind: 'Failure', _tag: 1, failure: { _tag: 'TaggedF1' } })).toBe(false);
		expect(isResult({ _kind: 'Failure', _tag: 'TaggedF1', failure: null })).toBe(false);
		expect(isResult({ _kind: 'Failure', _tag: 'TaggedF1', failure: { _tag: 'TaggedF2' } })).toBe(false);
		expect(isResult({ _kind: 'Unknown', value: 1 })).toBe(false);
	});
});

describe('Result type behavior', () => {
	it('preserves success and failure branch types from constructors', () => {
		const success = Success(1);
		const failure = Failure(taggedF1);

		expectTypeOf(success).toEqualTypeOf<SuccessBranch<number>>();
		expectTypeOf(failure).toEqualTypeOf<FailureBranch<TaggedF1>>();
		expectTypeOf(failure._tag).toEqualTypeOf<'TaggedF1'>();
	});

	it('narrows success and failure result unions', () => {
		const result: Result<1, TaggedF1 | TaggedF2> =
			Math.random() > 0.5 ? Success(1) : Math.random() > 0.5 ? Failure(taggedF1) : Failure(taggedF2);

		if (isSuccess(result)) {
			expectTypeOf(result).toEqualTypeOf<SuccessBranch<1>>();
			expectTypeOf(result.value).toEqualTypeOf<1>();
			// @ts-expect-error success results do not expose failure payloads
			result.failure;
		}

		if (isFailure(result)) {
			expectTypeOf(result.failure).toEqualTypeOf<TaggedF1 | TaggedF2>();
			expectTypeOf(result.failure.code).toEqualTypeOf<400 | 500>();
			// @ts-expect-error failure results do not expose success values
			result.value;
		}
	});

	it('supports exhaustive switching over failure tags after narrowing', () => {
		const result: Result<1, TaggedF1 | TaggedF2> =
			Math.random() > 0.5 ? Success(1) : Math.random() > 0.5 ? Failure(taggedF1) : Failure(taggedF2);

		if (isFailure(result)) {
			switch (result.failure._tag) {
				case 'TaggedF1':
					expectTypeOf(result.failure.code).toEqualTypeOf<400>();
					break;
				case 'TaggedF2':
					expectTypeOf(result.failure.code).toEqualTypeOf<500>();
					break;
				default: {
					const exhaustive: never = result.failure;
					expectTypeOf(exhaustive).toEqualTypeOf<never>();
				}
			}
		}
	});
});
