import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Todo = {
  readonly id: string
  readonly title: string
  readonly completed: boolean
  readonly createdAt: string
}

const todos = new Map<string, Todo>([
  [
    'todo-1',
    {
      id: 'todo-1',
      title: 'Load REST data into a typed Result',
      completed: false,
      createdAt: new Date('2026-05-29T09:00:00.000Z').toISOString(),
    },
  ],
  [
    'todo-2',
    {
      id: 'todo-2',
      title: 'Render tagged failures in React',
      completed: true,
      createdAt: new Date('2026-05-29T09:15:00.000Z').toISOString(),
    },
  ],
])

const app = new Hono()

app.use(
  '*',
  cors({
    origin: 'http://localhost:3001',
  }),
)

app.get('/api/todos', (context) => {
  return context.json([...todos.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
})

app.post('/api/todos', async (context) => {
  const body: { readonly title?: unknown } = await context.req.json<{ readonly title?: unknown }>().catch(() => ({}))
  const title = typeof body.title === 'string' ? body.title.trim() : ''

  if (title.length === 0) {
    return context.json({ message: 'Todo title is required' }, 400)
  }

  if (title.length > 80) {
    return context.json({ message: 'Todo title must be 80 characters or less' }, 400)
  }

  const todo: Todo = {
    id: `todo-${Date.now()}`,
    title,
    completed: false,
    createdAt: new Date().toISOString(),
  }

  todos.set(todo.id, todo)

  return context.json(todo, 201)
})

app.patch('/api/todos/:todoId/toggle', (context) => {
  const todoId = context.req.param('todoId')
  const todo = todos.get(todoId)

  if (!todo) {
    return context.json(
      {
        todoId,
        message: 'Todo does not exist',
      },
      404,
    )
  }

  const updated: Todo = {
    ...todo,
    completed: !todo.completed,
  }

  todos.set(todoId, updated)

  return context.json(updated)
})

app.delete('/api/todos/:todoId', (context) => {
  const todoId = context.req.param('todoId')
  const todo = todos.get(todoId)

  if (!todo) {
    return context.json(
      {
        todoId,
        message: 'Todo does not exist',
      },
      404,
    )
  }

  todos.delete(todoId)

  return context.json({ deleted: true })
})

serve(
  {
    fetch: app.fetch,
    port: 8787,
  },
  (info) => {
    console.log(`Hono API running on http://localhost:${info.port}`)
  },
)
