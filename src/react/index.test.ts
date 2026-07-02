import { describe, expect, expectTypeOf, it } from 'vitest';
import { Failure, Success, type ResultType, type TaggedFailure } from '../core/index';
import { Match, useResult, type MatchProps } from './index';

type TodoNotFound = TaggedFailure<'TodoNotFound', { readonly message: string }>;

const TodoNotFound: TodoNotFound = {
	_tag: 'TodoNotFound',
	message: 'Todo does not exist',
};

describe('React Match', () => {
	it('does not require onFailure for success-only results', () => {
		const result = Success({ id: 'todo-1' });

		const rendered = Match({
			result,
			onSuccess: (todo) => todo.id,
		});

		expect(rendered).toBe('todo-1');

		type Props = MatchProps<typeof result>;
		expectTypeOf<Props>().toMatchTypeOf<{
			readonly result: typeof result;
			readonly onSuccess: (success: { readonly id: string }) => unknown;
		}>();
	});

	it('requires onFailure when the result type can fail', () => {
		const result: ResultType<{ readonly id: string }, TodoNotFound> =
			Math.random() > 0.5 ? Success({ id: 'todo-1' }) : Failure(TodoNotFound);

		Match({
			result,
			onSuccess: (todo) => todo.id,
			onFailure: (failure) => failure.message,
		});

		if (false) {
			// @ts-expect-error failure-capable results must provide onFailure
			Match({
				result,
				onSuccess: (todo) => todo.id,
			});
		}
	});

	it('throws if a failure reaches Match without an onFailure handler', () => {
		expect(() =>
			Match({
				result: Failure(TodoNotFound),
				onSuccess: () => null,
			} as never),
		).toThrow('Result.Match requires onFailure when result is Failure');
	});

	it('does not require onSuccess for failure-only results', () => {
		const result = Failure(TodoNotFound);

		const rendered = Match({
			result,
			onFailure: (failure) => failure.message,
		});

		expect(rendered).toBe('Todo does not exist');

		if (false) {
			Match({
				result,
				// @ts-expect-error failure-only results cannot provide onSuccess
				onSuccess: () => null,
				onFailure: (failure) => failure.message,
			});
		}
	});
});

describe('useResult', () => {
	it('returns only the success branch for success-only results', () => {
		const state = useResult(Success({ id: 'todo-1' }));

		expect(state.isSuccess).toBe(true);
		expect(state.data).toEqual({ id: 'todo-1' });
		expectTypeOf(state.channel).toEqualTypeOf<'success'>();
	});

	it('returns only the failure branch for failure-only results', () => {
		const state = useResult(Failure(TodoNotFound));

		expect(state.isFailure).toBe(true);
		expect(state.failure).toEqual(TodoNotFound);
		expectTypeOf(state.channel).toEqualTypeOf<'failure'>();
	});

	it('returns undefined for pending result values', () => {
		const state = useResult(undefined);

		expect(state).toBeUndefined();
		expectTypeOf(state).toEqualTypeOf<undefined>();
	});
});
