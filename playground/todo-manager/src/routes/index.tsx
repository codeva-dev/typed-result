import { useState, type ReactNode } from 'react'
import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Result } from '@codeva-dev/typed-result'
import { Match, MatchFailureTags } from '@codeva-dev/typed-result/react'
import { Check, Loader2, Plus, Trash2, X } from 'lucide-react'
import {
  createTodo,
  deleteTodo,
  listTodos,
  toggleTodo,
  type Todo,
  type TodoFailure,
} from '#/server-functions/todos'

const todosQueryOptions = queryOptions({
  queryKey: ['todos'],
  queryFn: () => listTodos(),
})

export const Route = createFileRoute('/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(todosQueryOptions),
  component: TodoRoute,
})

function TodoRoute() {
  const { data } = useSuspenseQuery(todosQueryOptions)

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          typed-result playground
        </p>
        <h1 className="text-3xl font-semibold text-slate-950">Todo manager</h1>
      </header>

      <TodoComposer />

      <Match
        result={data}
        onSuccess={(todos) => <TodoList todos={todos} />}
        onFailure={(failure) => <TodoFailureView failure={failure} />}
      />
    </main>
  )
}

function TodoComposer() {
  const [title, setTitle] = useState('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => createTodo({ data: { title } }),
    onSuccess: (result) => {
      Result.handle(result)
        .tapSuccess(() => {
          setTitle('')
          void queryClient.invalidateQueries({ queryKey: ['todos'] })
        })
        .tapFailure((failure) => {
          console.warn('Create todo failed', failure)
        })
    },
  })

  return (
    <form
      className="flex gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        mutation.mutate()
      }}
    >
      <input
        className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition focus:border-slate-500"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Add a todo"
      />
      <button
        className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={mutation.isPending}
      >
        {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Add
      </button>
    </form>
  )
}

function TodoList({ todos }: { readonly todos: ReadonlyArray<Todo> }) {
  if (todos.length === 0) {
    return (
      <section className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
        No todos yet.
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      {todos.map((todo) => (
        <TodoRow key={todo.id} todo={todo} />
      ))}
    </section>
  )
}

function TodoRow({ todo }: { readonly todo: Todo }) {
  const queryClient = useQueryClient()

  const toggleMutation = useMutation({
    mutationFn: () => toggleTodo({ data: { id: todo.id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTodo({ data: { id: todo.id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['todos'] })
    },
  })

  return (
    <article className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0">
      <button
        className="grid size-8 place-items-center rounded-md border border-slate-300 text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
        type="button"
        onClick={() => toggleMutation.mutate()}
        disabled={toggleMutation.isPending}
        aria-label={todo.completed ? 'Reopen todo' : 'Complete todo'}
      >
        {todo.completed ? <Check className="size-4" /> : <X className="size-4" />}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={
            todo.completed
              ? 'truncate text-sm text-slate-400 line-through'
              : 'truncate text-sm font-medium text-slate-950'
          }
        >
          {todo.title}
        </p>
        <p className="text-xs text-slate-500">{new Date(todo.createdAt).toLocaleString()}</p>
      </div>

      <button
        className="grid size-8 place-items-center rounded-md text-slate-500 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
        type="button"
        onClick={() => deleteMutation.mutate()}
        disabled={deleteMutation.isPending}
        aria-label="Delete todo"
      >
        <Trash2 className="size-4" />
      </button>
    </article>
  )
}

function TodoFailureView({ failure }: { readonly failure: TodoFailure }) {
  return (
    <MatchFailureTags
      failure={failure}
      tags={{
        TodoValidationFailure: (failure) => <ErrorPanel>{failure.message}</ErrorPanel>,
        TodoNotFound: (failure) => <ErrorPanel>{failure.message}</ErrorPanel>,
        TodoStorageFailure: (failure) => <ErrorPanel>{failure.message}</ErrorPanel>,
        default: (failure) => <ErrorPanel>Unexpected failure: {failure._tag}</ErrorPanel>,
      }}
    />
  )
}

function ErrorPanel({ children }: { readonly children: ReactNode }) {
  return (
    <section className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-900">
      {children}
    </section>
  )
}
