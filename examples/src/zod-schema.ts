import { Result, unsafe_Schema as Schema } from '@codeva-dev/typed-result/zod';
import { z } from 'zod';

const Todo = z.object({
	id: z.string(),
	title: z.string(),
});

const TodoNotFound = Schema.TaggedFailure('TodoNotFound', {
	todoId: z.string(),
});

const TodoResult = Schema.Result({
	Success: Todo,
	Failure: [TodoNotFound],
});

export const decoded = TodoResult.decode({
	_kind: 'Failure',
	_tag: 'TodoNotFound',
	failure: {
		_tag: 'TodoNotFound',
		todoId: 'todo-1',
	},
});

export const rendered = Result.match(decoded, {
	onSuccess: (todo) => todo.title,
	onFailure: (failure) => `Missing ${failure.todoId}`,
});
