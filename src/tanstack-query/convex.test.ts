import { describe, expect, it } from 'vitest';
import { Failure, type ResultType, type TaggedFailure } from '../core';
import { convexErrorResultExtractor } from './convex';
import { createResultAdapter, type ResultDecoder } from './index';

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

const todoNotFound: TodoNotFound = {
	_tag: 'TodoNotFound',
	message: 'Todo does not exist',
	todoId: 'todo-1',
};

const schema: ResultDecoder<ResultType<Todo, TodoNotFound>> = {
	decode: (value) => value as ResultType<Todo, TodoNotFound>,
};

class ConvexErrorLike {
	constructor(readonly data: unknown) {}
}

describe('convexErrorResultExtractor', () => {
	it('extracts Result.Failure values from ConvexError data payloads', () => {
		const error = new ConvexErrorLike(Failure(todoNotFound));

		expect(convexErrorResultExtractor(error)).toEqual(Failure(todoNotFound));
	});

	it('can be used as an explicit adapter extractor for Convex TanStack integration wrappers', () => {
		const adapter = createResultAdapter({
			schema,
			extractErrorResult: convexErrorResultExtractor,
		});

		const result = adapter.fromMutationState({
			error: new ConvexErrorLike(Failure(todoNotFound)),
		});

		expect(result).toEqual(Failure(todoNotFound));
	});
});
