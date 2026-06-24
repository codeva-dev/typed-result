import { describe, expect, expectTypeOf, it } from 'vitest';
import { Failure, Success, type Result, type TaggedFailure } from '../result';
import { flatMapFailureTag, flatMapFailureTags } from './flat-map';
import { mapFailureTag, mapFailureTags } from './map';
import { match } from './match';

type F1 = TaggedFailure<'F1'> & { readonly message: 'f1' };
type F2 = TaggedFailure<'F2'> & { readonly message: 'f2' };
type F3 = TaggedFailure<'F3'> & { readonly message: 'f3' };
type F4 = TaggedFailure<'F4'> & { readonly message: 'f4' };

const F1: F1 = { _tag: 'F1', message: 'f1' };
const F2: F2 = { _tag: 'F2', message: 'f2' };
const F3: F3 = { _tag: 'F3', message: 'f3' };
const F4: F4 = { _tag: 'F4', message: 'f4' };

describe('tagged failure combinators', () => {
	it('maps a matching failure tag', () => {
		const result: Result<number, F1 | F2> = Failure(F1);

		const mapped = mapFailureTag(result, 'F1', () => F3);

		expect(mapped).toEqual(Failure(F3));
		expectTypeOf(mapped).toMatchTypeOf<Result<number, F2 | F3>>();
	});

	it('maps matching failure tags', () => {
		const result: Result<number, F1 | F2 | F4> = Failure(F2);

		const mapped = mapFailureTags(result, ['F1', 'F2'] as const, () => F3);

		expect(mapped).toEqual(Failure(F3));
		expectTypeOf(mapped).toMatchTypeOf<Result<number, F3 | F4>>();
	});

	it('preserves unmatched failure tags', () => {
		const result: Result<number, F1 | F2> = Failure(F2);

		const mapped = mapFailureTag(result, 'F1', () => F3);

		expect(mapped).toEqual(Failure(F2));
		expectTypeOf(mapped).toMatchTypeOf<Result<number, F2 | F3>>();
	});

	it('flat maps a matching failure tag to success', () => {
		const result: Result<number, F1 | F2> = Failure(F1);

		const mapped = flatMapFailureTag(result, 'F1', () => Success('recovered'));

		expect(mapped).toEqual(Success('recovered'));
		expectTypeOf(mapped).toMatchTypeOf<Result<number | string, F2>>();
	});

	it('flat maps matching failure tags to another failure', () => {
		const result: Result<number, F1 | F2 | F4> = Failure(F2);

		const mapped = flatMapFailureTags(result, ['F1', 'F2'] as const, () => Failure(F3));

		expect(mapped).toEqual(Failure(F3));
		expectTypeOf(mapped).toMatchTypeOf<Result<number, F3 | F4>>();
	});
});

describe('match', () => {
	it('does not require onFailure for success-only results', () => {
		const value = match(Success(1), {
			onSuccess: (success) => success + 1,
		});

		expect(value).toBe(2);
		expectTypeOf(value).toEqualTypeOf<number>();
	});

	it('does not require onSuccess for failure-only results', () => {
		const value = match(Failure(F1), {
			onFailure: (failure) => failure.message,
		});

		expect(value).toBe('f1');
		expectTypeOf(value).toEqualTypeOf<'f1'>();
	});

	it('requires both handlers when both branches are possible', () => {
		const result: Result<number, F1> = Math.random() > 0.5 ? Success(1) : Failure(F1);

		const value = match(result, {
			onSuccess: (success) => success,
			onFailure: (failure) => failure.message,
		});

		expectTypeOf(value).toEqualTypeOf<number | 'f1'>();

		if (false) {
			// @ts-expect-error failure-capable results must provide onFailure
			match(result, {
				onSuccess: (success) => success,
			});

			// @ts-expect-error success-capable results must provide onSuccess
			match(result, {
				onFailure: (failure) => failure.message,
			});
		}
	});
});
