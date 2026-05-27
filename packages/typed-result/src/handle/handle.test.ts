import { describe, expect, expectTypeOf, it } from 'vitest';
import { Failure, Success, isFailure, type Result, type TaggedFailure } from '../result';
import { handle } from './index';

type F1 = TaggedFailure<'F1'>;
type F2 = TaggedFailure<'F2'>;
type F3 = TaggedFailure<'F3'>;

const F1: F1 = { _tag: 'F1' };
const F2: F2 = { _tag: 'F2' };
const F3: F3 = { _tag: 'F3' };

describe('handle', () => {
	it('maps success branch through onSuccess and unwraps the final value', () => {
		const result = handle(Success(1))
			.onSuccess((value) => Success(value + 1))
			.onSuccess((value) => Success(String(value)))
			.result();

		expect(result).toEqual(Success('2'));
		expectTypeOf(result).toEqualTypeOf<Result<string, never>>();
		expect(handle(result).unwrap()).toBe('2');
	});

	it('can turn success into failure through onSuccess', () => {
		const result = handle(Success(1))
			.onSuccess(() => Failure(F1))
			.result();

		expect(result).toEqual(Failure(F1));
		expectTypeOf(result).toEqualTypeOf<Result<never, F1>>();
	});

	it('does not run onSuccess for an existing failure', () => {
		const result = handle(Failure(F1))
			.onSuccess(() => Failure(F2))
			.result();

		expect(result).toEqual(Failure(F1));
		expectTypeOf(result).toEqualTypeOf<Result<never, F1 | F2>>();
	});

	it('can recover from failure through onFailure', () => {
		const result = handle(Failure(F1))
			.onFailure(() => Success('fallback'))
			.result();

		expect(result).toEqual(Success('fallback'));
		expectTypeOf(result).toEqualTypeOf<Result<string, never>>();
	});

	it('can transform failure through onFailure', () => {
		const result = handle(Failure(F1))
			.onFailure(() => Failure(F2))
			.result();

		expect(result).toEqual(Failure(F2));
		expectTypeOf(result).toEqualTypeOf<Result<never, F2>>();
	});

	it('preserves multi-failure unions across success handling', () => {
		const source: Result<number, F1 | F2> =
			Math.random() > 0.5 ? Success(1) : Math.random() > 0.5 ? Failure(F1) : Failure(F2);

		const result = handle(source)
			.onSuccess((value) => (value > 0 ? Success(String(value)) : Failure(F3)))
			.result();

		expectTypeOf(result).toEqualTypeOf<Result<string, F1 | F2 | F3>>();

		if (isFailure(result)) {
			switch (result.failure._tag) {
				case 'F1':
				case 'F2':
				case 'F3':
					break;
				default: {
					const exhaustive: never = result.failure;
					expectTypeOf(exhaustive).toEqualTypeOf<never>();
				}
			}
		}
	});

	it('runs tap handlers without changing the result', () => {
		const seen: Array<string> = [];

		const success = handle(Success(1))
			.tap((result) => {
				seen.push(result._kind);
			})
			.tapSuccess((value) => {
				seen.push(String(value));
			})
			.tapFailure(() => {
				seen.push('unexpected failure');
			})
			.result();

		const failure = handle(Failure(F1))
			.tap((result) => {
				seen.push(result._kind);
			})
			.tapSuccess(() => {
				seen.push('unexpected success');
			})
			.tapFailure((failure) => {
				seen.push(failure._tag);
			})
			.result();

		expect(success).toEqual(Success(1));
		expect(failure).toEqual(Failure(F1));
		expect(seen).toEqual(['Success', '1', 'Failure', 'F1']);
	});

	it('throws when unwrap is called on a failure handle', () => {
		expect(() => handle(Failure(F1)).unwrap()).toThrow('Expected Success');
	});

	it('unwraps with null and undefined fallbacks', () => {
		expect(handle(Success(1)).unwrapOrNull()).toBe(1);
		expect(handle(Failure(F1)).unwrapOrNull()).toBeNull();
		expect(handle(Success(1)).unwrapOrUndefined()).toBe(1);
		expect(handle(Failure(F1)).unwrapOrUndefined()).toBeUndefined();
	});

	it('matches a failure by tag from handle', () => {
		const result: Result<number, F1 | F2> = Failure(F1);

		const value = handle(result).matchFailureTag('F1', {
			onMatch: (failure) => failure._tag as 'F1',
			orElse: () => 'fallback' as const,
		});

		expect(value).toBe('F1');
		expectTypeOf(value).toEqualTypeOf<'F1' | 'fallback'>();
	});

	it('falls back when handle failure tag does not match', () => {
		const result: Result<number, F1 | F2> = Math.random() > 0.5 ? Failure(F1) : Failure(F2);

		const value = handle(result).matchFailureTag('F1', {
			onMatch: (failure) => failure._tag as 'F1',
			orElse: (result) => result._kind as 'Success' | 'Failure',
		});

		expect(['F1', 'Failure']).toContain(value);
		expectTypeOf(value).toEqualTypeOf<'F1' | 'Success' | 'Failure'>();
	});

	it('matches multiple failure tags from handle', () => {
		const result: Result<number, F1 | F2 | F3> = Failure(F2);

		const value = handle(result).matchFailureTags(['F1', 'F2'] as const, {
			onMatch: (failure) => failure._tag as 'F1' | 'F2',
			orElse: () => 'fallback' as const,
		});

		expect(value).toBe('F2');
		expectTypeOf(value).toEqualTypeOf<'F1' | 'F2' | 'fallback'>();
	});
});
