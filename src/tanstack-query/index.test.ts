import { Schema as EffectSchema } from 'effect';
import { describe, expect, expectTypeOf, it } from 'vitest';
import z4 from 'zod/v4';
import { Failure, Success, isFailure, isSuccess, type ResultType, type TaggedFailure } from '../core';
import { unsafe_Schema as EffectResultSchema } from '../schema/effect';
import { unsafe_Schema as ZodResultSchema } from '../schema/zod';
import {
	chainExtractors,
	createResultAdapter,
	dataPropertyResultExtractor,
	resultErrorExtractor,
	resultFromMutationState,
	resultFromQueryState,
	resultFromTanStackState,
	type ResultDecoder,
} from './index';

type Todo = {
	readonly id: string;
	readonly title: string;
};

type TodoNotFound = TaggedFailure<
	'TodoNotFound',
	{
		readonly message: string;
		readonly todoId: string;
	}
>;

const TodoNotFound = {
	_tag: 'TodoNotFound',
	make: (fields: Omit<TodoNotFound, '_tag'>): TodoNotFound => ({ _tag: 'TodoNotFound', ...fields }),
};

const todo = {
	id: 'todo-1',
	title: 'Write tests',
} satisfies Todo;

const todoNotFound = TodoNotFound.make({
	message: 'Todo does not exist',
	todoId: 'todo-1',
});

function createCoreDecoder(): ResultDecoder<ResultType<Todo, TodoNotFound>> {
	return {
		decode: (value) => {
			if (
				typeof value === 'object' &&
				value !== null &&
				'_kind' in value &&
				(value._kind === 'Success' || value._kind === 'Failure')
			) {
				return value as ResultType<Todo, TodoNotFound>;
			}

			throw new TypeError('Invalid result');
		},
	};
}

describe('resultFromTanStackState', () => {
	const schema = createCoreDecoder();

	it('wraps plain data channel payloads in Result.Success', () => {
		const result = resultFromTanStackState({
			data: todo,
			schema,
		});

		expect(result).toEqual(Success(todo));
		expectTypeOf(result).toEqualTypeOf<ResultType<Todo, TodoNotFound> | undefined>();
	});

	it('treats null error state as no error and still uses data', () => {
		const result = resultFromTanStackState({
			data: todo,
			error: null,
			schema,
		});

		expect(result).toEqual(Success(todo));
	});

	it('returns undefined while no data or error is available', () => {
		const result = resultFromTanStackState({
			schema,
		});

		expect(result).toBeUndefined();
	});

	it('returns already-created Result.Success values from the data channel after decoding', () => {
		const result = resultFromTanStackState({
			data: Success(todo),
			schema,
		});

		expect(result).toEqual(Success(todo));
	});

	it('returns already-created Result.Failure values from the data channel after decoding', () => {
		const result = resultFromTanStackState({
			data: Failure(todoNotFound),
			schema,
		});

		expect(result).toEqual(Failure(todoNotFound));
	});
});

describe('error result extraction', () => {
	const schema = createCoreDecoder();

	it('returns Result.Failure thrown directly through the error channel', () => {
		const result = resultFromTanStackState({
			error: Failure(todoNotFound),
			schema,
		});

		expect(result).toEqual(Failure(todoNotFound));
	});

	it('returns Result.Failure from error.data', () => {
		const result = resultFromTanStackState({
			error: {
				data: Failure(todoNotFound),
			},
			schema,
		});

		expect(result).toEqual(Failure(todoNotFound));
	});

	it('returns Result.Failure from any Error object with a data Result payload', () => {
		class DataError extends Error {
			constructor(readonly data: unknown) {
				super('application failure');
			}
		}

		const result = resultFromTanStackState({
			error: new DataError(Failure(todoNotFound)),
			schema,
		});

		expect(result).toEqual(Failure(todoNotFound));
	});

	it('throws unknown errors instead of converting them to Result.Failure', () => {
		const error = new Error('network failed');

		expect(() =>
			resultFromTanStackState({
				error,
				schema,
			}),
		).toThrow(error);
	});

	it('throws decode errors when extracted Result-like payloads do not match the schema', () => {
		const strictSchema: ResultDecoder<ResultType<Todo, TodoNotFound>> = {
			decode: (value) => {
				if (
					typeof value === 'object' &&
					value !== null &&
					'_kind' in value &&
					value._kind === 'Failure' &&
					'_tag' in value &&
					value._tag === 'TodoNotFound'
				) {
					return value as ResultType<Todo, TodoNotFound>;
				}

				throw new TypeError('schema mismatch');
			},
		};

		expect(() =>
			resultFromTanStackState({
				error: Failure({ _tag: 'OtherFailure', message: 'Wrong failure' }),
				schema: strictSchema,
			}),
		).toThrow('schema mismatch');
	});
});

describe('extractors', () => {
	it('extracts direct Result errors', () => {
		expect(resultErrorExtractor(Failure(todoNotFound))).toEqual(Failure(todoNotFound));
		expect(resultErrorExtractor(new Error('boom'))).toBeUndefined();
	});

	it('extracts Result values from a data property', () => {
		expect(dataPropertyResultExtractor({ data: Failure(todoNotFound) })).toEqual(Failure(todoNotFound));
		expect(dataPropertyResultExtractor({ data: { _kind: 'Failure' } })).toBeUndefined();
	});

	it('chains extractors in order', () => {
		const extractor = chainExtractors(
			() => undefined,
			(error) => (error === 'match' ? Failure(todoNotFound) : undefined),
		);

		expect(extractor('match')).toEqual(Failure(todoNotFound));
		expect(extractor('miss')).toBeUndefined();
	});
});

describe('adapters and aliases', () => {
	const schema = createCoreDecoder();

	it('creates a reusable adapter with the same normalization semantics', () => {
		const adapter = createResultAdapter({ schema });

		expect(adapter.fromState({ data: todo })).toEqual(Success(todo));
		expect(adapter.fromQueryState({ data: Success(todo) })).toEqual(Success(todo));
		expect(adapter.fromMutationState({ error: Failure(todoNotFound) })).toEqual(Failure(todoNotFound));
	});

	it('keeps query and mutation helpers as explicit aliases over the same core behavior', () => {
		expect(resultFromQueryState({ data: todo, schema })).toEqual(Success(todo));
		expect(resultFromMutationState({ data: todo, schema })).toEqual(Success(todo));
	});
});

describe('schema adapters', () => {
	it('works with typed-result Zod Result schemas', () => {
		const Todo = z4.object({
			id: z4.string(),
			title: z4.string(),
		});
		const TodoNotFound = ZodResultSchema.TaggedFailure('TodoNotFound', {
			message: z4.string(),
			todoId: z4.string(),
		});
		const TodoResult = ZodResultSchema.Result({
			Success: Todo,
			Failure: [TodoNotFound],
		});

		const success = resultFromTanStackState({
			data: todo,
			schema: TodoResult,
		});
		const failure = resultFromTanStackState({
			error: Failure(todoNotFound),
			schema: TodoResult,
		});

		expect(isSuccess(success)).toBe(true);
		expect(isFailure(failure)).toBe(true);
	});

	it('works with typed-result Effect Schema Result schemas', () => {
		const Todo = EffectSchema.Struct({
			id: EffectSchema.String,
			title: EffectSchema.String,
		});
		const TodoNotFound = EffectResultSchema.TaggedFailure('TodoNotFound', {
			message: EffectSchema.String,
			todoId: EffectSchema.String,
		});
		const TodoResult = EffectResultSchema.Result({
			Success: Todo,
			Failure: [TodoNotFound],
		});

		const success = resultFromTanStackState({
			data: todo,
			schema: TodoResult,
		});
		const failure = resultFromTanStackState({
			error: Failure(todoNotFound),
			schema: TodoResult,
		});

		expect(isSuccess(success)).toBe(true);
		expect(isFailure(failure)).toBe(true);
	});
});
