import { describe, expect, it } from 'vitest';
import { Result, TypedResultDecodeError, z } from './zod';

const Todo = Result.defineSuccess(
	z.object({
		id: z.string(),
		title: z.string(),
	}),
);

const TodoSummary = Result.defineSuccess(
	z.object({
		id: z.string(),
	}),
);

const TodoNotFound = Result.defineFailure('TodoNotFound', {
	todoId: z.string(),
	message: z.string(),
});

const TodoValidationFailed = Result.defineFailure('TodoValidationFailed', {
	message: z.string(),
});

const TodoResult = Result.defineSchema({
	success: Todo,
	failure: [TodoNotFound, TodoValidationFailed],
});

const TodoUnionResult = Result.defineSchema({
	success: [Todo, TodoSummary],
	failure: [TodoNotFound, TodoValidationFailed],
});

describe('zod adapter', () => {
	it('creates schema validated success results', () => {
		const result = TodoResult.Success({
			id: 'todo-1',
			title: 'Ship it',
		});

		expect(result).toEqual({
			_kind: 'Success',
			value: {
				id: 'todo-1',
				title: 'Ship it',
			},
		});
	});

	it('creates schema validated failure results by tag', () => {
		const result = TodoResult.Failure('TodoNotFound', {
			todoId: 'todo-1',
			message: 'Missing',
		});

		expect(result).toEqual({
			_kind: 'Failure',
			_tag: 'TodoNotFound',
			failure: {
				_tag: 'TodoNotFound',
				todoId: 'todo-1',
				message: 'Missing',
			},
		});
	});

	it('keeps core Result.Failure compatible with failure schema make', () => {
		const failure = TodoNotFound.make({
			todoId: 'todo-1',
			message: 'Missing',
		});

		const result = Result.Failure(failure);

		expect(result._tag).toBe('TodoNotFound');
		expect(result.failure.todoId).toBe('todo-1');
	});

	it('decodes success and failure envelopes', () => {
		const success = TodoUnionResult.decode({
			_kind: 'Success',
			value: {
				id: 'todo-1',
				title: 'Ship it',
			},
		});

		const failure = TodoResult.decode({
			_kind: 'Failure',
			_tag: 'TodoValidationFailed',
			failure: {
				_tag: 'TodoValidationFailed',
				message: 'Invalid',
			},
		});

		expect(Result.isSuccess(success)).toBe(true);
		expect(Result.isFailure(failure)).toBe(true);
	});

	it('throws package decode errors for invalid payloads', () => {
		expect(() =>
			TodoResult.decode({
				_kind: 'Failure',
				_tag: 'TodoNotFound',
				failure: {
					_tag: 'TodoValidationFailed',
					message: 'Invalid',
				},
			}),
		).toThrow(TypedResultDecodeError);
	});

	it('can map invalid payloads to explicit domain failures', () => {
		const InvalidPayload = Result.defineFailure('InvalidPayload', {
			message: z.string(),
		});
		const RecoverableResult = Result.defineSchema({
			success: Todo,
			failure: [TodoNotFound, InvalidPayload],
		});

		const result = RecoverableResult.decode(
			{
				_kind: 'Success',
				value: {
					id: 1,
				},
			},
			{
				onInvalid: 'failure',
				failure: (error) =>
					RecoverableResult.Failure('InvalidPayload', {
						message: error.message,
					}),
			},
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result._tag).toBe('InvalidPayload');
		}
	});
});
