import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { Failure, Success, type FailureType, type ResultType, type TaggedFailure } from '../core';
import { type ResultDecoder } from './index';
import { useResultMutation, useResultQuery } from './react';

const { useMutationMock, useQueryMock } = vi.hoisted(() => ({
	useMutationMock: vi.fn(),
	useQueryMock: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
	useMutation: useMutationMock,
	useQuery: useQueryMock,
}));

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

const todo = {
	id: 'todo-1',
	title: 'Write hook tests',
} satisfies Todo;

const todoNotFound = {
	_tag: 'TodoNotFound',
	message: 'Todo does not exist',
	todoId: 'todo-1',
} satisfies TodoNotFound;

const schema: ResultDecoder<ResultType<Todo, TodoNotFound>> = {
	decode: (value) => value as ResultType<Todo, TodoNotFound>,
};

describe('useResultQuery', () => {
	beforeEach(() => {
		useMutationMock.mockReset();
		useQueryMock.mockReset();
	});

	it('returns the TanStack query state with a normalized Result.Success', () => {
		useQueryMock.mockReturnValue({
			data: todo,
			error: null,
			isError: false,
			isFetching: false,
			isPending: false,
			isSuccess: true,
		});

		const query = useResultQuery({
			queryKey: ['todo', todo.id],
			queryFn: () => Promise.resolve(todo),
			schema,
		});

		expect(query.query).toMatchObject({
			data: todo,
			isSuccess: true,
		});
		expect(query).toMatchObject({
			channel: 'success',
			data: todo,
			hasResult: true,
			isPending: false,
			isSuccess: true,
			result: Success(todo),
			state: 'success',
		});
		expect(useQueryMock).toHaveBeenCalledWith(
			{
				queryKey: ['todo', todo.id],
				queryFn: expect.any(Function),
			},
			undefined,
		);
		expectTypeOf(query.result).toEqualTypeOf<ResultType<Todo, TodoNotFound> | undefined>();
		expectTypeOf(query.query.data).toMatchTypeOf<Todo | undefined>();
		expectTypeOf(query.query.error).toMatchTypeOf<Error | null>();
		if (query.state === 'success') {
			expectTypeOf(query.channel).toEqualTypeOf<'success'>();
			expectTypeOf(query.data).toEqualTypeOf<Todo>();
			expectTypeOf(query.failure).toEqualTypeOf<undefined>();
			expectTypeOf(query.failureTag).toEqualTypeOf<undefined>();
			expectTypeOf(query.result).toEqualTypeOf<ReturnType<typeof Success<Todo>>>();
		}
	});

	it('returns Result.Failure state only from successful query data', () => {
		useQueryMock.mockReturnValue({
			data: Failure(todoNotFound),
			error: null,
			isError: false,
			isFetching: false,
			isPending: false,
			isSuccess: true,
		});

		const query = useResultQuery({
			queryKey: ['todo', todo.id],
			queryFn: () => Promise.resolve(todo),
			schema,
		});

		expect(query).toMatchObject({
			channel: 'failure',
			failure: todoNotFound,
			hasResult: true,
			isError: false,
			isFailure: true,
			isSuccess: false,
			result: Failure(todoNotFound),
			state: 'failure',
		});
		if (query.hasResult) {
			expectTypeOf(query.result).toEqualTypeOf<ResultType<Todo, TodoNotFound>>();
		}
		if (query.state === 'failure') {
			expectTypeOf(query.channel).toEqualTypeOf<'failure'>();
			expectTypeOf(query.data).toEqualTypeOf<undefined>();
			expectTypeOf(query.failure).toEqualTypeOf<TodoNotFound>();
			expectTypeOf(query.failureTag).toEqualTypeOf<'TodoNotFound'>();
			expectTypeOf(query.result).toEqualTypeOf<FailureType<TodoNotFound>>();
		}
	});

	it('returns pending state before a query has a result or operational error', () => {
		useQueryMock.mockReturnValue({
			data: undefined,
			error: null,
			isError: false,
			isFetching: true,
			isPending: true,
			isSuccess: false,
		});

		const query = useResultQuery({
			queryKey: ['todo', todo.id],
			queryFn: () => Promise.resolve(todo),
			schema,
		});

		expect(query).toMatchObject({
			channel: undefined,
			data: undefined,
			failure: undefined,
			hasResult: false,
			isFailure: false,
			isPending: true,
			isSuccess: false,
			result: undefined,
			state: 'pending',
		});
	});

	it('returns operational error state from failed queries', () => {
		const error = new Error('network failed');
		useQueryMock.mockReturnValue({
			data: undefined,
			error,
			isError: true,
			isFetching: false,
			isPending: false,
			isSuccess: false,
		});

		const query = useResultQuery({
			queryKey: ['todo', todo.id],
			queryFn: () => Promise.resolve(todo),
			schema,
		});

		expect(query).toMatchObject({
			error,
			hasResult: false,
			isError: true,
			isFailure: false,
			isSuccess: false,
			result: undefined,
			state: 'error',
		});
		if (query.state === 'error') {
			expectTypeOf(query.isError).toEqualTypeOf<true>();
			expectTypeOf(query.error).toEqualTypeOf<Error>();
			expectTypeOf(query.result).toEqualTypeOf<undefined>();
		}
	});
});

describe('useResultMutation', () => {
	beforeEach(() => {
		useMutationMock.mockReset();
		useQueryMock.mockReset();
	});

	it('returns the TanStack mutation state with a normalized Result.Success', () => {
		const mutate = vi.fn();
		useMutationMock.mockReturnValue({
			data: todo,
			error: null,
			isError: false,
			isPending: false,
			isSuccess: true,
			mutate,
			mutateAsync: vi.fn(),
		});

		const mutation = useResultMutation({
			mutationFn: () => Promise.resolve(todo),
			schema,
		});

		expect(mutation.mutation).toMatchObject({
			data: todo,
			isSuccess: true,
		});
		expect(mutation).toMatchObject({
			channel: 'success',
			data: todo,
			hasResult: true,
			isPending: false,
			isSuccess: true,
			result: Success(todo),
			state: 'success',
		});
		expect(mutation.mutate).toBe(mutate);
		expect(useMutationMock).toHaveBeenCalledWith(
			{
				mutationFn: expect.any(Function),
			},
			undefined,
		);
		expectTypeOf(mutation.result).toEqualTypeOf<ResultType<Todo, TodoNotFound> | undefined>();
		expectTypeOf(mutation.mutation.data).toMatchTypeOf<Todo | undefined>();
		expectTypeOf(mutation.mutation.error).toMatchTypeOf<Error | null>();
		if (mutation.state === 'success') {
			expectTypeOf(mutation.channel).toEqualTypeOf<'success'>();
			expectTypeOf(mutation.data).toEqualTypeOf<Todo>();
			expectTypeOf(mutation.failure).toEqualTypeOf<undefined>();
			expectTypeOf(mutation.failureTag).toEqualTypeOf<undefined>();
			expectTypeOf(mutation.result).toEqualTypeOf<ReturnType<typeof Success<Todo>>>();
		}
	});

	it('returns Result.Failure state only from successful mutation data', () => {
		useMutationMock.mockReturnValue({
			data: Failure(todoNotFound),
			error: null,
			isError: false,
			isPending: false,
			isSuccess: true,
			mutate: vi.fn(),
			mutateAsync: vi.fn(),
		});

		const mutation = useResultMutation({
			mutationFn: () => Promise.resolve(todo),
			schema,
		});

		expect(mutation).toMatchObject({
			channel: 'failure',
			failure: todoNotFound,
			hasResult: true,
			isError: false,
			isFailure: true,
			isSuccess: false,
			result: Failure(todoNotFound),
			state: 'failure',
		});
	});

	it('returns operational error state from failed mutations', () => {
		const error = new Error('mutation failed');
		useMutationMock.mockReturnValue({
			data: undefined,
			error,
			isError: true,
			isPending: false,
			isSuccess: false,
			mutate: vi.fn(),
			mutateAsync: vi.fn(),
		});

		const mutation = useResultMutation({
			mutationFn: () => Promise.resolve(todo),
			schema,
		});

		expect(mutation).toMatchObject({
			error,
			hasResult: false,
			isError: true,
			isFailure: false,
			isSuccess: false,
			result: undefined,
			state: 'error',
		});
		if (mutation.state === 'error') {
			expectTypeOf(mutation.isError).toEqualTypeOf<true>();
			expectTypeOf(mutation.error).toEqualTypeOf<Error>();
			expectTypeOf(mutation.result).toEqualTypeOf<undefined>();
		}
	});
});
