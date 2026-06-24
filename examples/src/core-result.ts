import { Result, type ResultType } from '@codeva-dev/typed-result';

interface Todo {
	readonly id: string;
	readonly title: string;
}

const TodoNotFound = Result.defineTaggedFailure<'TodoNotFound', { readonly todoId: string }>('TodoNotFound');

function loadTodo(todoId: string): ResultType<Todo, ReturnType<typeof TodoNotFound.make>> {
	if (todoId !== 'todo-1') {
		return Result.Failure(TodoNotFound, { todoId });
	}

	return Result.Success({
		id: todoId,
		title: 'Write examples',
	});
}

export const todoTitle = Result.match(loadTodo('todo-1'), {
	onSuccess: (todo) => todo.title,
	onFailure: (failure) => `Missing todo ${failure.todoId}`,
});
