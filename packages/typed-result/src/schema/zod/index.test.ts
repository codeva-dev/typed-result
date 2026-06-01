import { describe, expect, expectTypeOf, it } from 'vitest';
import z4 from 'zod/v4';
import { isFailure, isSuccess } from '../../core';
import { unsafe_Schema as ResultSchema } from './index';

describe('Zod ResultSchema.TaggedFailure', () => {
	it('creates tagged failure values from field data', () => {
		const TodoNotFound = ResultSchema.TaggedFailure('TodoNotFound', {
			message: z4.string(),
			todoId: z4.string(),
		});

		const failure = TodoNotFound.make({
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});

		expect(failure).toEqual({
			_tag: 'TodoNotFound',
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});
	});

	it('rejects _tag fields at runtime', () => {
		expect(() =>
			ResultSchema.TaggedFailure('TodoNotFound', {
				message: z4.string(),
				_tag: z4.literal('TodoNotFound'),
			} as never),
		).toThrow('TaggedFailure fields must not contain _tag');
	});

	it('decodes full tagged failure payloads', () => {
		const TodoNotFound = ResultSchema.TaggedFailure('TodoNotFound', {
			message: z4.string(),
			todoId: z4.string(),
		});

		const decoded = TodoNotFound.decode({
			_tag: 'TodoNotFound',
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});

		expect(decoded).toEqual({
			_tag: 'TodoNotFound',
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});
	});

	it('preserves tagged failure output types', () => {
		const TodoNotFound = ResultSchema.TaggedFailure('TodoNotFound', {
			message: z4.string(),
			todoId: z4.string(),
		});

		const failure = TodoNotFound.make({
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});

		expectTypeOf(failure).toEqualTypeOf<{
			_tag: 'TodoNotFound';
			message: string;
			todoId: string;
		}>();

		if (false) {
			// @ts-expect-error _tag is owned by the tagged failure schema factory
			ResultSchema.TaggedFailure('Invalid', { _tag: z4.string() });
		}
	});

	it('rejects invalid field data in make', () => {
		const TodoNotFound = ResultSchema.TaggedFailure('TodoNotFound', {
			message: z4.string(),
			todoId: z4.string(),
		});

		expect(() =>
			TodoNotFound.make({
				message: 'Todo does not exist',
				todoId: 1,
			} as never),
		).toThrow();
	});

	it('rejects invalid full tagged failure payloads in decode', () => {
		const TodoNotFound = ResultSchema.TaggedFailure('TodoNotFound', {
			message: z4.string(),
			todoId: z4.string(),
		});

		expect(() =>
			TodoNotFound.decode({
				_tag: 'OtherFailure',
				message: 'Todo does not exist',
				todoId: 'todo-1',
			}),
		).toThrow();

		expect(() =>
			TodoNotFound.decode({
				_tag: 'TodoNotFound',
				message: 'Todo does not exist',
			}),
		).toThrow();
	});

	it('encodes tagged failure values through the field schema', () => {
		const TodoNotFound = ResultSchema.TaggedFailure('TodoNotFound', {
			message: z4.string(),
			todoId: z4.string(),
		});

		const failure = TodoNotFound.make({
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});

		expect(TodoNotFound.encode(failure)).toEqual({
			_tag: 'TodoNotFound',
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});
	});

	it('keeps input and output types separate for transformed fields', () => {
		const ValidationFailure = ResultSchema.TaggedFailure('ValidationFailure', {
			message: z4.string(),
			code: z4.string().transform((value) => Number(value)),
		});

		const failure = ValidationFailure.make({
			message: 'Invalid input',
			code: '400',
		});

		expect(failure).toEqual({
			_tag: 'ValidationFailure',
			message: 'Invalid input',
			code: 400,
		});
		expectTypeOf(failure.code).toEqualTypeOf<number>();
		expectTypeOf<typeof ValidationFailure.Encoded>().toEqualTypeOf<{
			_tag: 'ValidationFailure';
			message: string;
			code: string;
		}>();
	});
});

describe('Zod ResultSchema.Result', () => {
	const Todo = z4.object({
		id: z4.string(),
		title: z4.string(),
	});

	const TodoNotFound = ResultSchema.TaggedFailure('TodoNotFound', {
		message: z4.string(),
		todoId: z4.string(),
	});

	const RandomFailure = ResultSchema.TaggedFailure('RandomFailure', {
		message: z4.string(),
	});

	it('decodes success result payloads', () => {
		const TodoResult = ResultSchema.Result({
			Success: Todo,
			Failure: [TodoNotFound, RandomFailure],
		});

		const parsed = TodoResult.decode({
			_kind: 'Success',
			value: {
				id: 'todo-1',
				title: 'Write tests',
			},
		});

		expect(parsed).toEqual({
			_kind: 'Success',
			value: {
				id: 'todo-1',
				title: 'Write tests',
			},
		});
	});

	it('decodes tagged failure result payloads', () => {
		const TodoResult = ResultSchema.Result({
			Success: Todo,
			Failure: [TodoNotFound, RandomFailure],
		});

		const parsed = TodoResult.decode({
			_kind: 'Failure',
			_tag: 'TodoNotFound',
			failure: {
				_tag: 'TodoNotFound',
				message: 'Todo does not exist',
				todoId: 'todo-1',
			},
		});

		expect(parsed).toEqual({
			_kind: 'Failure',
			_tag: 'TodoNotFound',
			failure: {
				_tag: 'TodoNotFound',
				message: 'Todo does not exist',
				todoId: 'todo-1',
			},
		});
	});

	it('rejects mismatched outer and inner failure tags', () => {
		const TodoResult = ResultSchema.Result({
			Success: Todo,
			Failure: [TodoNotFound, RandomFailure],
		});

		expect(() =>
			TodoResult.decode({
				_kind: 'Failure',
				_tag: 'RandomFailure',
				failure: {
					_tag: 'TodoNotFound',
					message: 'Todo does not exist',
					todoId: 'todo-1',
				},
			}),
		).toThrow();
	});

	it('rejects unknown failure tags', () => {
		const TodoResult = ResultSchema.Result({
			Success: Todo,
			Failure: [TodoNotFound, RandomFailure],
		});

		expect(() =>
			TodoResult.decode({
				_kind: 'Failure',
				_tag: 'UnknownFailure',
				failure: {
					_tag: 'UnknownFailure',
					message: 'Unknown failure',
				},
			}),
		).toThrow();
	});

	it('rejects malformed success payloads', () => {
		const TodoResult = ResultSchema.Result({
			Success: Todo,
			Failure: [TodoNotFound, RandomFailure],
		});

		expect(() =>
			TodoResult.decode({
				_kind: 'Success',
				value: {
					id: 'todo-1',
				},
			}),
		).toThrow();
	});

	it('supports a single failure schema', () => {
		const TodoResult = ResultSchema.Result({
			Success: Todo,
			Failure: [TodoNotFound],
		});

		const parsed = TodoResult.decode({
			_kind: 'Failure',
			_tag: 'TodoNotFound',
			failure: {
				_tag: 'TodoNotFound',
				message: 'Todo does not exist',
				todoId: 'todo-1',
			},
		});

		expect(parsed).toEqual({
			_kind: 'Failure',
			_tag: 'TodoNotFound',
			failure: {
				_tag: 'TodoNotFound',
				message: 'Todo does not exist',
				todoId: 'todo-1',
			},
		});

		type Parsed = typeof TodoResult.Type;
		type ParsedFailure = Extract<Parsed, { readonly _kind: 'Failure' }>;

		expectTypeOf<ParsedFailure['_tag']>().toEqualTypeOf<'TodoNotFound'>();
		expectTypeOf<ParsedFailure['failure']>().toEqualTypeOf<{
			_tag: 'TodoNotFound';
			message: string;
			todoId: string;
		}>();
	});

	it('preserves success and failure union types', () => {
		const TodoResult = ResultSchema.Result({
			Success: Todo,
			Failure: [TodoNotFound, RandomFailure],
		});

		type Parsed = typeof TodoResult.Type;
		type ParsedSuccess = Extract<Parsed, { readonly _kind: 'Success' }>;
		type ParsedFailure = Extract<Parsed, { readonly _kind: 'Failure' }>;

		expectTypeOf<ParsedSuccess['value']>().toEqualTypeOf<{
			id: string;
			title: string;
		}>();

		expectTypeOf<ParsedFailure['_tag']>().toEqualTypeOf<'TodoNotFound' | 'RandomFailure'>();
		expectTypeOf<ParsedFailure['failure']>().toEqualTypeOf<
			| {
					_tag: 'TodoNotFound';
					message: string;
					todoId: string;
			  }
			| {
					_tag: 'RandomFailure';
					message: string;
			  }
		>();

		const parsed = TodoResult.decode({
			_kind: 'Failure',
			_tag: 'TodoNotFound',
			failure: {
				_tag: 'TodoNotFound',
				message: 'Todo does not exist',
				todoId: 'todo-1',
			},
		});

		if (parsed._kind === 'Failure') {
			switch (parsed.failure._tag) {
				case 'TodoNotFound':
					expectTypeOf(parsed.failure.todoId).toEqualTypeOf<string>();
					break;
				case 'RandomFailure':
					expectTypeOf(parsed.failure.message).toEqualTypeOf<string>();
					// @ts-expect-error RandomFailure does not have todoId
					parsed.failure.todoId;
					break;
				default: {
					const exhaustive: never = parsed.failure;
					expectTypeOf(exhaustive).toEqualTypeOf<never>();
				}
			}
		}
	});

	it('wraps schema decode success and failure in core Result values', () => {
		const TodoResult = ResultSchema.Result({
			Success: Todo,
			Failure: [TodoNotFound, RandomFailure],
		});

		const success = ResultSchema.safeDecode(TodoResult.Schema, {
			_kind: 'Success',
			value: {
				id: 'todo-1',
				title: 'Write tests',
			},
		});

		expect(isSuccess(success)).toBe(true);
		if (isSuccess(success)) {
			expect(success.value._kind).toBe('Success');
		}

		const failure = ResultSchema.safeDecode(TodoResult.Schema, {
			_kind: 'Success',
			value: {
				id: 1,
				title: 'Write tests',
			},
		});

		expect(isFailure(failure)).toBe(true);
		if (isFailure(failure)) {
			expect(failure.failure._tag).toBe('InvalidResult');
		}
	});

	it('throws from decode when safeDecode returns InvalidResult', () => {
		const TodoResult = ResultSchema.Result({
			Success: Todo,
			Failure: [TodoNotFound, RandomFailure],
		});

		expect(() =>
			ResultSchema.decode(TodoResult.Schema, {
				_kind: 'Success',
				value: {
					id: 1,
					title: 'Write tests',
				},
			}),
		).toThrow('Invalid result type');
	});

	it('returns parsed values from decode', () => {
		const TodoResult = ResultSchema.Result({
			Success: Todo,
			Failure: [TodoNotFound, RandomFailure],
		});

		const decoded = ResultSchema.decode(TodoResult.Schema, {
			_kind: 'Failure',
			_tag: 'RandomFailure',
			failure: {
				_tag: 'RandomFailure',
				message: 'Random failure',
			},
		});

		expect(decoded).toEqual({
			_kind: 'Failure',
			_tag: 'RandomFailure',
			failure: {
				_tag: 'RandomFailure',
				message: 'Random failure',
			},
		});
	});

	it('preserves transformed success output types', () => {
		const Count = z4.object({
			value: z4.string().transform((value) => Number(value)),
		});

		const CountResult = ResultSchema.Result({
			Success: Count,
			Failure: [RandomFailure],
		});

		const parsed = CountResult.decode({
			_kind: 'Success',
			value: {
				value: '42',
			},
		});

		expect(parsed).toEqual({
			_kind: 'Success',
			value: {
				value: 42,
			},
		});

		if (parsed._kind === 'Success') {
			expectTypeOf(parsed.value.value).toEqualTypeOf<number>();
		}
	});
});
