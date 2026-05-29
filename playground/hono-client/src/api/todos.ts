import { queryOptions } from '@tanstack/react-query'
import { Result, type ResultType, type TaggedFailure } from '@codeva-dev/typed-result'

const API_URL = 'http://localhost:8787'

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
  readonly todoId: string
  readonly message: string
}

export type TodoRequestFailure = TaggedFailure<'TodoRequestFailure'> & {
  readonly message: string
}

export type TodoFailure =
  | TodoValidationFailure
  | TodoNotFoundFailure
  | TodoRequestFailure

export const todosQueryOptions = queryOptions({
  queryKey: ['hono-todos'],
  queryFn: listTodos,
})

export async function listTodos(): Promise<ResultType<ReadonlyArray<Todo>, TodoFailure>> {
  const response = await fetch(`${API_URL}/api/todos`)

  if (!response.ok) {
    throw new Error(`Todo API request failed with status ${response.status}`)
  }

  return Result.Success(parseTodoList(await response.json()))
}

export async function createTodo(title: string): Promise<ResultType<Todo, TodoFailure>> {
  const response = await fetch(`${API_URL}/api/todos`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ title }),
  })

  const payload = await response.json()

  if (response.status === 400) {
    return Result.Failure('TodoValidationFailure', parseMessageBody(payload))
  }

  if (!response.ok) {
    throw new Error(`Todo API request failed with status ${response.status}`)
  }

  return Result.Success(parseTodo(payload))
}

export async function toggleTodo(todoId: string): Promise<ResultType<Todo, TodoFailure>> {
  const response = await fetch(`${API_URL}/api/todos/${todoId}/toggle`, {
    method: 'PATCH',
  })

  const payload = await response.json()

  if (response.status === 404) {
    return Result.Failure('TodoNotFound', parseTodoNotFoundBody(payload))
  }

  if (!response.ok) {
    throw new Error(`Todo API request failed with status ${response.status}`)
  }

  return Result.Success(parseTodo(payload))
}

export async function deleteTodo(todoId: string): Promise<ResultType<true, TodoFailure>> {
  const response = await fetch(`${API_URL}/api/todos/${todoId}`, {
    method: 'DELETE',
  })

  const payload = await response.json()

  if (response.status === 404) {
    return Result.Failure('TodoNotFound', parseTodoNotFoundBody(payload))
  }

  if (!response.ok) {
    throw new Error(`Todo API request failed with status ${response.status}`)
  }

  return Result.Success(true as const)
}

function parseTodoList(payload: unknown): ReadonlyArray<Todo> {
  if (!Array.isArray(payload)) {
    throw new Error('Expected todo list response')
  }

  return payload.map(parseTodo)
}

function parseTodo(payload: unknown): Todo {
  if (!isRecord(payload)) {
    throw new Error('Expected todo response')
  }

  if (
    typeof payload.id !== 'string' ||
    typeof payload.title !== 'string' ||
    typeof payload.completed !== 'boolean' ||
    typeof payload.createdAt !== 'string'
  ) {
    throw new Error('Invalid todo response')
  }

  return {
    id: payload.id,
    title: payload.title,
    completed: payload.completed,
    createdAt: payload.createdAt,
  }
}

function parseTodoNotFoundBody(payload: unknown): Omit<TodoNotFoundFailure, '_tag'> {
  if (!isRecord(payload) || typeof payload.todoId !== 'string' || typeof payload.message !== 'string') {
    throw new Error('Invalid TodoNotFound response')
  }

  return {
    todoId: payload.todoId,
    message: payload.message,
  }
}

function parseMessageBody(payload: unknown): Omit<TodoValidationFailure, '_tag'> {
  if (!isRecord(payload) || typeof payload.message !== 'string') {
    throw new Error('Invalid failure response')
  }

  return {
    message: payload.message,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
