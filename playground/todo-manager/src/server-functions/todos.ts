import { createServerFn } from '@tanstack/react-start'
import { Result, type ResultType, type TaggedFailure } from '@codeva-dev/typed-result'

export type Todo = {
  readonly id: string
  readonly title: string
  readonly completed: boolean
  readonly createdAt: string
}

export type TodoValidationFailure = TaggedFailure<'TodoValidationFailure'> & {
  readonly message: string
}

export type TodoNotFoundFailure = TaggedFailure<'TodoNotFound'> & {
  readonly message: string
  readonly todoId: string
}

export type TodoStorageFailure = TaggedFailure<'TodoStorageFailure'> & {
  readonly message: string
}

export type TodoFailure =
  | TodoValidationFailure
  | TodoNotFoundFailure
  | TodoStorageFailure

const todos = new Map<string, Todo>([
  [
    'todo-1',
    {
      id: 'todo-1',
      title: 'Try typed-result with TanStack Query',
      completed: false,
      createdAt: new Date('2026-05-27T10:00:00.000Z').toISOString(),
    },
  ],
  [
    'todo-2',
    {
      id: 'todo-2',
      title: 'Render failures with MatchFailureTags',
      completed: true,
      createdAt: new Date('2026-05-27T10:10:00.000Z').toISOString(),
    },
  ],
])

const listTodosResult = (): ResultType<ReadonlyArray<Todo>, TodoFailure> => {
  return Result.Success(
    [...todos.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  )
}

const validateTitle = (title: string): ResultType<string, TodoValidationFailure> => {
  const trimmed = title.trim()

  if (trimmed.length === 0) {
    return Result.Failure('TodoValidationFailure', {
      message: 'Todo title is required',
    })
  }

  if (trimmed.length > 80) {
    return Result.Failure('TodoValidationFailure', {
      message: 'Todo title must be 80 characters or less',
    })
  }

  return Result.Success(trimmed)
}

const findTodo = (id: string): ResultType<Todo, TodoNotFoundFailure> => {
  const todo = todos.get(id)

  if (!todo) {
    return Result.Failure('TodoNotFound', {
      message: `Todo ${id} was not found`,
      todoId: id,
    })
  }

  return Result.Success(todo)
}

export const listTodos = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ResultType<ReadonlyArray<Todo>, TodoFailure>> => {
    return listTodosResult()
  },
)

export const createTodo = createServerFn({ method: 'POST' })
  .inputValidator((data: { readonly title: string }) => data)
  .handler(async ({ data }): Promise<ResultType<Todo, TodoFailure>> => {
    return Result.handle(validateTitle(data.title))
      .onSuccess((title) => {
        const todo: Todo = {
          id: `todo-${Date.now()}`,
          title,
          completed: false,
          createdAt: new Date().toISOString(),
        }

        todos.set(todo.id, todo)

        return Result.Success(todo)
      })
      .result()
  })

export const toggleTodo = createServerFn({ method: 'POST' })
  .inputValidator((data: { readonly id: string }) => data)
  .handler(async ({ data }): Promise<ResultType<Todo, TodoFailure>> => {
    return Result.handle(findTodo(data.id))
      .onSuccess((todo) => {
        const updated: Todo = {
          ...todo,
          completed: !todo.completed,
        }

        todos.set(updated.id, updated)

        return Result.Success(updated)
      })
      .result()
  })

export const deleteTodo = createServerFn({ method: 'POST' })
  .inputValidator((data: { readonly id: string }) => data)
  .handler(async ({ data }): Promise<ResultType<true, TodoFailure>> => {
    return Result.handle(findTodo(data.id))
      .onSuccess((todo) => {
        todos.delete(todo.id)

        return Result.Success(true as const)
      })
      .result()
  })
