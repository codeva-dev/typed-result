import { Cause, Effect, Exit, FiberId, Schema } from 'effect';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { Failure, Success, isFailure, isSuccess, type ResultType as CoreResultType } from '../../core';
import { Result, unsafe_Schema as ResultSchema } from './index';

describe('Effect ResultSchema.TaggedFailure', () => {
	it('creates tagged failure values from field data', () => {
		const TodoNotFound = ResultSchema.TaggedFailure('TodoNotFound', {
			message: Schema.String,
			todoId: Schema.String,
		});

		const failure = TodoNotFound.make({
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});

		expect(failure).toBeInstanceOf(Error);
		expect(failure).toMatchObject({
			_tag: 'TodoNotFound',
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});
	});

	it('rejects _tag fields at runtime', () => {
		expect(() =>
			ResultSchema.TaggedFailure('TodoNotFound', {
				message: Schema.String,
				_tag: Schema.Literal('TodoNotFound'),
			} as never),
		).toThrow('TaggedFailure fields must not contain _tag');
	});

	it('decodes full tagged failure payloads', () => {
		const TodoNotFound = ResultSchema.TaggedFailure('TodoNotFound', {
			message: Schema.String,
			todoId: Schema.String,
		});

		const decoded = TodoNotFound.decode({
			_tag: 'TodoNotFound',
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});

		expect(decoded).toBeInstanceOf(Error);
		expect(decoded).toMatchObject({
			_tag: 'TodoNotFound',
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});
	});

	it('preserves tagged failure output types', () => {
		const TodoNotFound = ResultSchema.TaggedFailure('TodoNotFound', {
			message: Schema.String,
			todoId: Schema.String,
		});

		const failure = TodoNotFound.make({
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});

		expectTypeOf(failure).toMatchTypeOf<{
			readonly _tag: 'TodoNotFound';
			readonly message: string;
			readonly todoId: string;
		}>();

		if (false) {
			// @ts-expect-error _tag is owned by the tagged failure schema factory
			ResultSchema.TaggedFailure('Invalid', { _tag: Schema.String });
		}
	});

	it('rejects invalid field data in make', () => {
		const TodoNotFound = ResultSchema.TaggedFailure('TodoNotFound', {
			message: Schema.String,
			todoId: Schema.String,
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
			message: Schema.String,
			todoId: Schema.String,
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
			message: Schema.String,
			todoId: Schema.String,
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
			message: Schema.String,
			code: Schema.NumberFromString,
		});

		const failure = ValidationFailure.make({
			message: 'Invalid input',
			code: '400',
		});

		expect(failure).toBeInstanceOf(Error);
		expect(failure).toMatchObject({
			_tag: 'ValidationFailure',
			message: 'Invalid input',
			code: 400,
		});
		expectTypeOf(failure.code).toEqualTypeOf<number>();
		expectTypeOf(ValidationFailure.Encoded).toMatchTypeOf<{
			readonly _tag: 'ValidationFailure';
			readonly message: string;
			readonly code: string;
		}>();
	});
});

describe('Effect ResultSchema.fromTaggedError', () => {
	class TodoNotFound extends Schema.TaggedError<TodoNotFound>()('TodoNotFound', {
		message: Schema.String,
		todoId: Schema.String,
	}) {}

	type DomainErrorInstance<TTag extends string, Fields extends object> = Error &
		Fields & {
			readonly _tag: TTag;
		};

	type DomainErrorClass<TTag extends string, Fields extends object> = {
		readonly _tag: TTag;
		new (props: Fields): DomainErrorInstance<TTag, Fields>;
	};

	it('wraps native Effect Schema TaggedError classes', () => {
		const TodoNotFoundFailure = ResultSchema.fromTaggedError(TodoNotFound);

		const failure = TodoNotFoundFailure.make({
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});

		expect(failure).toBeInstanceOf(Error);
		expect(failure).toBeInstanceOf(TodoNotFound);
		expect(failure).toMatchObject({
			_tag: 'TodoNotFound',
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});
		expect(TodoNotFoundFailure.encode(failure)).toEqual({
			_tag: 'TodoNotFound',
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});
	});

	it('wraps Schema TaggedError classes whose public type hides the Schema surface', () => {
		const SchedulerParticipantNotFoundError = Schema.TaggedError<DomainErrorInstance<
			'SchedulerParticipantNotFoundError',
			{
				readonly message: string;
				readonly participantId: string;
			}
		>>()('SchedulerParticipantNotFoundError', {
			message: Schema.String,
			participantId: Schema.String,
		}) as unknown as DomainErrorClass<
			'SchedulerParticipantNotFoundError',
			{
				readonly message: string;
				readonly participantId: string;
			}
		>;

		const SchedulerParticipantNotFoundFailure = ResultSchema.fromTaggedError(SchedulerParticipantNotFoundError);
		const failure = new SchedulerParticipantNotFoundError({
			message: 'Participant not found',
			participantId: 'participant-1',
		});

		const encoded = SchedulerParticipantNotFoundFailure.encode(failure);

		expect(encoded).toEqual({
			_tag: 'SchedulerParticipantNotFoundError',
			message: 'Participant not found',
			participantId: 'participant-1',
		});
		const typecheck: {
			readonly _tag: 'SchedulerParticipantNotFoundError';
			readonly message: string;
			readonly participantId: string;
		} = encoded;
		void typecheck;
	});

	it('omits unknown cause fields from hidden Schema TaggedError public encodings', () => {
		const MeetingSelfRequestError = Schema.TaggedError<DomainErrorInstance<
			'MeetingSelfRequestError',
			{
				readonly message: string;
				readonly cause?: unknown;
			}
		>>()('MeetingSelfRequestError', {
			message: Schema.String,
			cause: Schema.optional(Schema.Unknown),
		}) as unknown as DomainErrorClass<
			'MeetingSelfRequestError',
			{
				readonly message: string;
				readonly cause?: unknown;
			}
		>;

		const MeetingSelfRequestFailure = ResultSchema.fromTaggedError(MeetingSelfRequestError);
		const failure = new MeetingSelfRequestError({
			message: 'Cannot request yourself',
			cause: new Error('internal cause'),
		});

		const encoded = MeetingSelfRequestFailure.encode(failure);

		expect(encoded).toEqual({
			_tag: 'MeetingSelfRequestError',
			message: 'Cannot request yourself',
		});
		expect(encoded).not.toHaveProperty('cause');
		const typecheck: {
			readonly _tag: 'MeetingSelfRequestError';
			readonly message: string;
		} = encoded;
		void typecheck;

		if (false) {
			// @ts-expect-error unknown cause is intentionally not part of the public failure DTO
			encoded.cause;
		}
	});

	it('can use native TaggedError wrappers in Result schemas', () => {
		const Todo = Schema.Struct({
			id: Schema.String,
			title: Schema.String,
		});
		const TodoNotFoundFailure = ResultSchema.fromTaggedError(TodoNotFound);
		const TodoResult = ResultSchema.Result({
			Success: Todo,
			Failure: [TodoNotFoundFailure],
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

		expect(parsed._kind).toBe('Failure');
		if (parsed._kind === 'Failure') {
			expect(parsed.failure).toBeInstanceOf(TodoNotFound);
			expectTypeOf(parsed.failure._tag).toEqualTypeOf<'TodoNotFound'>();
		}
	});
});

describe('Effect ResultSchema.Result', () => {
	const Todo = Schema.Struct({
		id: Schema.String,
		title: Schema.String,
	});

	const TodoNotFound = ResultSchema.TaggedFailure('TodoNotFound', {
		message: Schema.String,
		todoId: Schema.String,
	});

	const RandomFailure = ResultSchema.TaggedFailure('RandomFailure', {
		message: Schema.String,
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

		expect(parsed._kind).toBe('Failure');
		expect(parsed).toMatchObject({
			_kind: 'Failure',
			_tag: 'TodoNotFound',
		});
		if (parsed._kind === 'Failure') {
			expect(parsed.failure).toBeInstanceOf(Error);
			expect(parsed.failure).toMatchObject({
				_tag: 'TodoNotFound',
				message: 'Todo does not exist',
				todoId: 'todo-1',
			});
		}
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

		expect(parsed._kind).toBe('Failure');
		expect(parsed).toMatchObject({
			_kind: 'Failure',
			_tag: 'TodoNotFound',
		});
		if (parsed._kind === 'Failure') {
			expect(parsed.failure).toBeInstanceOf(Error);
			expect(parsed.failure).toMatchObject({
				_tag: 'TodoNotFound',
				message: 'Todo does not exist',
				todoId: 'todo-1',
			});
		}

		type Parsed = typeof TodoResult.Type;
		type ParsedFailure = Extract<Parsed, { readonly _kind: 'Failure' }>;

		expectTypeOf<ParsedFailure['_tag']>().toEqualTypeOf<'TodoNotFound'>();
		expectTypeOf<ParsedFailure['failure']>().toMatchTypeOf<{
			readonly _tag: 'TodoNotFound';
			readonly message: string;
			readonly todoId: string;
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
			readonly id: string;
			readonly title: string;
		}>();

		expectTypeOf<ParsedFailure['_tag']>().toEqualTypeOf<'TodoNotFound' | 'RandomFailure'>();
		expectTypeOf<ParsedFailure['failure']>().toMatchTypeOf<
			| {
					readonly _tag: 'TodoNotFound';
					readonly message: string;
					readonly todoId: string;
			  }
			| {
					readonly _tag: 'RandomFailure';
					readonly message: string;
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

	it('keeps outer failure tags correlated with inner tagged errors', () => {
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

		if (parsed._kind === 'Failure') {
			switch (parsed._tag) {
				case 'TodoNotFound':
					expectTypeOf(parsed.failure.todoId).toEqualTypeOf<string>();
					break;
				case 'RandomFailure':
					expectTypeOf(parsed.failure.message).toEqualTypeOf<string>();
					// @ts-expect-error RandomFailure does not have todoId
					parsed.failure.todoId;
					break;
				default: {
					const exhaustive: never = parsed;
					expectTypeOf(exhaustive).toEqualTypeOf<never>();
				}
			}
		}
	});

	it('encodes decoded result failures into wire-safe plain objects', () => {
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

		expect(TodoResult.encode(parsed)).toEqual({
			_kind: 'Failure',
			_tag: 'TodoNotFound',
			failure: {
				_tag: 'TodoNotFound',
				message: 'Todo does not exist',
				todoId: 'todo-1',
			},
		});
	});

	it('dies from decode effect when the payload is invalid', () => {
		const TodoResult = ResultSchema.Result({
			Success: Todo,
			Failure: [TodoNotFound, RandomFailure],
		});

		expect(() =>
			Effect.runSync(
				ResultSchema.decodeEffect(TodoResult.Schema, {
					_kind: 'Success',
					value: {
						id: 1,
						title: 'Write tests',
					},
				}),
			),
		).toThrow('Invalid result type');
	});

	it('decodes synchronously through the static schema decoder', () => {
		const TodoResult = ResultSchema.Result({
			Success: Todo,
			Failure: [TodoNotFound, RandomFailure],
		});

		const decoded = ResultSchema.decode(TodoResult.Schema, {
			_kind: 'Success',
			value: {
				id: 'todo-1',
				title: 'Write tests',
			},
		});

		expect(decoded).toEqual({
			_kind: 'Success',
			value: {
				id: 'todo-1',
				title: 'Write tests',
			},
		});
		expectTypeOf(decoded).toEqualTypeOf<typeof TodoResult.Type>();
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

	it('returns success values from decode effect', () => {
		const TodoResult = ResultSchema.Result({
			Success: Todo,
			Failure: [TodoNotFound, RandomFailure],
		});

		const decoded = Effect.runSync(
			ResultSchema.decodeEffect(TodoResult.Schema, {
				_kind: 'Success',
				value: {
					id: 'todo-1',
					title: 'Write tests',
				},
			}),
		);

		expect(decoded).toEqual({
			id: 'todo-1',
			title: 'Write tests',
		});
	});

	it('returns tagged failures in the Effect error channel from decode effect', () => {
		const TodoResult = ResultSchema.Result({
			Success: Todo,
			Failure: [TodoNotFound, RandomFailure],
		});

		const failure = Effect.runSync(
			Effect.flip(
				ResultSchema.decodeEffect(TodoResult.Schema, {
					_kind: 'Failure',
					_tag: 'RandomFailure',
					failure: {
						_tag: 'RandomFailure',
						message: 'Random failure',
					},
				}),
			),
		);

		expect(failure).toBeInstanceOf(Error);
		expect(failure).toMatchObject({
			_tag: 'RandomFailure',
			message: 'Random failure',
		});
	});

	it('preserves transformed success output types', () => {
		const Count = Schema.Struct({
			value: Schema.NumberFromString,
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

describe('Effect Result.fromExit', () => {
	const TodoNotFound = ResultSchema.TaggedFailure('TodoNotFound', {
		message: Schema.String,
		todoId: Schema.String,
	});
	const TodoArchived = ResultSchema.TaggedFailure('TodoArchived', {
		todoId: Schema.String,
	});

	class NativeTodoNotFound extends Schema.TaggedError<NativeTodoNotFound>()('TodoNotFound', {
		message: Schema.String,
		todoId: Schema.String,
	}) {}

	const NativeTodoNotFoundFailure = ResultSchema.fromTaggedError(NativeTodoNotFound);

	type DomainErrorInstance<TTag extends string, Fields extends object> = Error &
		Fields & {
			readonly _tag: TTag;
		};

	type DomainErrorClass<TTag extends string, Fields extends object> = {
		readonly _tag: TTag;
		new (props: Fields): DomainErrorInstance<TTag, Fields>;
	};

	it('maps successful exits into Success results', () => {
		const exit = Effect.runSync(Effect.exit(Effect.succeed({ id: 'todo-1' })));
		const result = Result.fromExit(exit);

		expect(result).toEqual({
			_kind: 'Success',
			value: {
				id: 'todo-1',
			},
		});
	});

	it('maps whitelisted tagged failures into Failure results using ResultSchema.TaggedFailure', () => {
		const failure = TodoNotFound.make({
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});

		const exit = Effect.runSync(Effect.exit(Effect.fail(failure)));
		const result = Result.fromExit(exit, {
			onError: {
				TodoNotFound,
			},
		});

		expect(result).toEqual({
			_kind: 'Failure',
			_tag: 'TodoNotFound',
			failure: {
				_tag: 'TodoNotFound',
				message: 'Todo does not exist',
				todoId: 'todo-1',
			},
		});
		const typecheck: CoreResultType<
			never,
			{
				readonly _tag: 'TodoNotFound';
				readonly message: string;
				readonly todoId: string;
			}
		> = result;
		void typecheck;
	});

	it('maps whitelisted native Effect Schema TaggedError classes through fromTaggedError', () => {
		const failure = new NativeTodoNotFound({
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});
		const exit: Exit.Exit<never, NativeTodoNotFound> = Effect.runSync(Effect.exit(Effect.fail(failure)));

		const result = Result.fromExit(exit, {
			onError: {
				TodoNotFound: NativeTodoNotFoundFailure,
			},
		});

		expect(result).toEqual({
			_kind: 'Failure',
			_tag: 'TodoNotFound',
			failure: {
				_tag: 'TodoNotFound',
				message: 'Todo does not exist',
				todoId: 'todo-1',
			},
		});
	});

	it('omits unknown cause fields from Result failures created from hidden tagged error classes', () => {
		const MeetingSelfRequestError = Schema.TaggedError<DomainErrorInstance<
			'MeetingSelfRequestError',
			{
				readonly message: string;
				readonly cause?: unknown;
			}
		>>()('MeetingSelfRequestError', {
			message: Schema.String,
			cause: Schema.optional(Schema.Unknown),
		}) as unknown as DomainErrorClass<
			'MeetingSelfRequestError',
			{
				readonly message: string;
				readonly cause?: unknown;
			}
		>;
		const failure = new MeetingSelfRequestError({
			message: 'Cannot request yourself',
			cause: new Error('internal cause'),
		});
		const exit: Exit.Exit<never, InstanceType<typeof MeetingSelfRequestError>> = Effect.runSync(
			Effect.exit(Effect.fail(failure)),
		);

		const result = Result.fromExit(exit, {
			onError: {
				MeetingSelfRequestError: ResultSchema.fromTaggedError(MeetingSelfRequestError),
			},
		});

		expect(result).toEqual({
			_kind: 'Failure',
			_tag: 'MeetingSelfRequestError',
			failure: {
				_tag: 'MeetingSelfRequestError',
				message: 'Cannot request yourself',
			},
		});
		const typecheck: CoreResultType<
			never,
			{
				readonly _tag: 'MeetingSelfRequestError';
				readonly message: string;
			}
		> = result;
		void typecheck;
	});

	it('throws unlisted tagged failures instead of converting them', () => {
		const failure = TodoArchived.make({
			todoId: 'todo-1',
		});
		const exit: Exit.Exit<never, typeof TodoNotFound.Type | typeof TodoArchived.Type> = Effect.runSync(
			Effect.exit(Effect.fail(failure)),
		);

		expect(() =>
			Result.fromExit(exit, {
				onError: {
					TodoNotFound,
				},
			}),
		).toThrow();
	});

	it('does not include unlisted failures in the returned Result type', () => {
		const failure = TodoNotFound.make({
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});
		const exit = Effect.runSync(Effect.exit(Effect.fail(failure)));
		const result = Result.fromExit(exit, {
			onError: {
				TodoNotFound,
			},
		});

		const typecheck: CoreResultType<
			never,
			{
				readonly _tag: 'TodoNotFound';
				readonly message: string;
				readonly todoId: string;
			}
		> = result;
		void typecheck;
	});

	it('rejects handlers whose key and encoded tag do not match at type level', () => {
		const exit = Effect.runSync(Effect.exit(Effect.fail(TodoNotFound.make({ message: 'Missing', todoId: 'todo-1' }))));

		if (false) {
			Result.fromExit(exit, {
				onError: {
					// @ts-expect-error handler tag must match its object key
					TodoNotFound: TodoArchived,
				},
			});
		}
	});

	it('throws if a handler is incorrectly cast with a mismatched runtime tag', () => {
		const failure = TodoNotFound.make({
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});
		const exit = Effect.runSync(Effect.exit(Effect.fail(failure)));

		expect(() =>
			Result.fromExit(exit, {
				onError: {
					TodoNotFound: TodoArchived as never,
				},
			}),
		).toThrow('handler tag mismatch');
	});

	it('throws defects instead of converting them into Failure results', () => {
		const exit = Effect.runSync(Effect.exit(Effect.die(new Error('boom'))));

		expect(() => Result.fromExit(exit)).toThrow('boom');
	});

	it('throws interrupted exits instead of converting them into Failure results', () => {
		const exit = Effect.runSync(Effect.exit(Effect.interrupt));

		expect(() => Result.fromExit(exit)).toThrow();
	});

	it('throws mixed failure and defect exits instead of converting the failure into Failure results', () => {
		const failure = TodoNotFound.make({
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});
		const exit = Exit.failCause(Cause.parallel(Cause.fail(failure), Cause.die(new Error('boom'))));

		expect(() =>
			Result.fromExit(exit, {
				onError: {
					TodoNotFound,
				},
			}),
		).toThrow();
	});

	it('throws sequential mixed failure and defect exits', () => {
		const failure = TodoNotFound.make({
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});
		const exit = Exit.failCause(Cause.sequential(Cause.fail(failure), Cause.die(new Error('boom'))));

		expect(() =>
			Result.fromExit(exit, {
				onError: {
					TodoNotFound,
				},
			}),
		).toThrow();
	});

	it('throws mixed failure and interruption exits', () => {
		const failure = TodoNotFound.make({
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});
		const exit = Exit.failCause(Cause.parallel(Cause.fail(failure), Cause.interrupt(FiberId.none)));

		expect(() =>
			Result.fromExit(exit, {
				onError: {
					TodoNotFound,
				},
			}),
		).toThrow();
	});

	it('throws multiple pure failures instead of choosing one', () => {
		const first = TodoNotFound.make({
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});
		const second = TodoArchived.make({
			todoId: 'todo-1',
		});
		const exit = Exit.failCause(Cause.parallel(Cause.fail(first), Cause.fail(second)));

		expect(() =>
			Result.fromExit(exit, {
				onError: {
					TodoNotFound,
					TodoArchived,
				},
			}),
		).toThrow();
	});

	it('throws sequential multiple pure failures instead of choosing one', () => {
		const first = TodoNotFound.make({
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});
		const second = TodoArchived.make({
			todoId: 'todo-1',
		});
		const exit = Exit.failCause(Cause.sequential(Cause.fail(first), Cause.fail(second)));

		expect(() =>
			Result.fromExit(exit, {
				onError: {
					TodoNotFound,
					TodoArchived,
				},
			}),
		).toThrow();
	});

	it('throws multiple pure failures with the same tag instead of choosing one', () => {
		const first = TodoNotFound.make({
			message: 'First missing todo',
			todoId: 'todo-1',
		});
		const second = TodoNotFound.make({
			message: 'Second missing todo',
			todoId: 'todo-2',
		});
		const exit = Exit.failCause(Cause.parallel(Cause.fail(first), Cause.fail(second)));

		expect(() =>
			Result.fromExit(exit, {
				onError: {
					TodoNotFound,
				},
			}),
		).toThrow();
	});

	it('throws empty unknown causes', () => {
		const exit = Exit.failCause(Cause.empty);

		expect(() => Result.fromExit(exit)).toThrow();
	});

	it('requires an onError whitelist for failure-capable exits', () => {
		const exit = Effect.runSync(Effect.exit(Effect.fail(TodoNotFound.make({ message: 'Missing', todoId: 'todo-1' }))));

		if (false) {
			// @ts-expect-error failure-capable exits require an explicit onError whitelist
			Result.fromExit(exit);
		}
	});

	it('rejects handlers for impossible failure tags at type level', () => {
		const exit = Effect.runSync(Effect.exit(Effect.fail(TodoNotFound.make({ message: 'Missing', todoId: 'todo-1' }))));

		if (false) {
			Result.fromExit(exit, {
				onError: {
					TodoNotFound,
					// @ts-expect-error TodoArchived is not in this Exit error channel
					TodoArchived,
				},
			});
		}
	});

	it('rejects untagged Effect failures at type level', () => {
		const effect = Effect.fail({ code: 404 });

		if (false) {
			// @ts-expect-error Effect failures must be tagged for Result boundary conversion
			Result.fromEffect(effect, {
				onError: {},
			});
		}
	});

	it('propagates schema encode failures from whitelisted handlers', () => {
		const invalidFailure = {
			_tag: 'TodoNotFound' as const,
			message: 'Todo does not exist',
			todoId: 123,
		} as unknown as typeof TodoNotFound.Type;
		const exit = Effect.runSync(Effect.exit(Effect.fail(invalidFailure)));

		expect(() =>
			Result.fromExit(exit, {
				onError: {
					TodoNotFound,
				},
			}),
		).toThrow();
	});
});

describe('Effect Result.fromEffect', () => {
	const TodoNotFound = ResultSchema.TaggedFailure('TodoNotFound', {
		message: Schema.String,
		todoId: Schema.String,
	});
	const TodoArchived = ResultSchema.TaggedFailure('TodoArchived', {
		todoId: Schema.String,
	});

	it('runs Effect success into Success results', async () => {
		const result = await Result.fromEffect(Effect.succeed({ id: 'todo-1' }));

		expect(result).toEqual({
			_kind: 'Success',
			value: {
				id: 'todo-1',
			},
		});
	});

	it('runs Effect failure into Failure results', async () => {
		const failure = TodoNotFound.make({
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});

		const result = await Result.fromEffect(Effect.fail(failure), {
			onError: {
				TodoNotFound,
			},
		});

		expect(result).toEqual({
			_kind: 'Failure',
			_tag: 'TodoNotFound',
			failure: {
				_tag: 'TodoNotFound',
				message: 'Todo does not exist',
				todoId: 'todo-1',
			},
		});
	});

	it('requires the Effect environment to be provided before running', () => {
		class TodoId extends Effect.Service<TodoId>()('TodoId', {
			succeed: {
				value: 'todo-1',
			},
		}) {}

		const effect = Effect.gen(function* () {
			const todoId = yield* TodoId;
			return todoId.value;
		});

		if (false) {
			// @ts-expect-error fromEffect runs the Effect, so R must already be provided
			Result.fromEffect(effect);
		}
	});

	it('requires an explicit onError whitelist for failure-capable effects', () => {
		const effect = Effect.fail(TodoNotFound.make({ message: 'Missing', todoId: 'todo-1' }));

		if (false) {
			// @ts-expect-error failure-capable effects require an explicit onError whitelist
			Result.fromEffect(effect);
		}
	});

	it('throws unlisted effect failures', async () => {
		const failure = TodoArchived.make({
			todoId: 'todo-1',
		});

		const effect: Effect.Effect<never, typeof TodoNotFound.Type | typeof TodoArchived.Type, never> = Effect.fail(failure);

		await expect(
			Result.fromEffect(effect, {
				onError: {
					TodoNotFound,
				},
			}),
		).rejects.toThrow();
	});

	it('rejects defects instead of converting them into Failure results', async () => {
		await expect(Result.fromEffect(Effect.die(new Error('boom')))).rejects.toThrow('boom');
	});

	it('rejects interruptions instead of converting them into Failure results', async () => {
		await expect(Result.fromEffect(Effect.interrupt)).rejects.toThrow();
	});
});

describe('Effect Result.toEffect', () => {
	const TodoNotFound = ResultSchema.TaggedFailure('TodoNotFound', {
		message: Schema.String,
		todoId: Schema.String,
	});

	it('maps Success results into Effect success values', () => {
		const effect = Result.toEffect(Success({ id: 'todo-1' }));
		const value = Effect.runSync(effect);

		expect(value).toEqual({
			id: 'todo-1',
		});

		const typecheck: Effect.Effect<{ readonly id: string }, never, never> = effect;
		void typecheck;
	});

	it('maps Failure results into the Effect error channel', () => {
		const failure = TodoNotFound.make({
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});
		const effect = Result.toEffect(Failure(failure));
		const value = Effect.runSync(Effect.flip(effect));

		expect(value).toBe(failure);

		const typecheck: Effect.Effect<never, typeof TodoNotFound.Type, never> = effect;
		void typecheck;
	});
});

describe('Effect schema and core Result integration', () => {
	const Todo = Schema.Struct({
		id: Schema.String,
		title: Schema.String,
	});

	const TodoNotFound = ResultSchema.TaggedFailure('TodoNotFound', {
		message: Schema.String,
		todoId: Schema.String,
	});

	const TodoCouldNotBeLoaded = ResultSchema.TaggedFailure('TodoCouldNotBeLoaded', {
		message: Schema.String,
	});

	const TodoConflict = ResultSchema.TaggedFailure('TodoConflict', {
		message: Schema.String,
	});

	const TodoResult = ResultSchema.Result({
		Success: Todo,
		Failure: [TodoNotFound, TodoCouldNotBeLoaded, TodoConflict],
	});

	it('uses decoded Effect schema Result values with core handle success flow', () => {
		const decoded = TodoResult.decode({
			_kind: 'Success',
			value: {
				id: 'todo-1',
				title: 'Write integration tests',
			},
		});

		const result = Result.handle(decoded)
			.onSuccess((todo) => Success(todo.title.toUpperCase()))
			.tapSuccess((title) => {
				expect(title).toBe('WRITE INTEGRATION TESTS');
			})
			.result();

		expect(result).toEqual(Success('WRITE INTEGRATION TESTS'));
		expectTypeOf(result).toEqualTypeOf<
			CoreResultType<string, typeof TodoNotFound.Type | typeof TodoCouldNotBeLoaded.Type | typeof TodoConflict.Type>
		>();
	});

	it('uses decoded Effect schema Result values with core failure tag recovery', () => {
		const decoded = TodoResult.decode({
			_kind: 'Failure',
			_tag: 'TodoNotFound',
			failure: {
				_tag: 'TodoNotFound',
				message: 'Todo does not exist',
				todoId: 'todo-1',
			},
		});

		const result = Result.handle(decoded)
			.onFailure((failure) => {
				switch (failure._tag) {
					case 'TodoNotFound':
						expect(failure).toBeInstanceOf(Error);
						expect(failure.todoId).toBe('todo-1');
						return Success(null);
					case 'TodoCouldNotBeLoaded':
					case 'TodoConflict':
						return Failure(failure);
				}
			})
			.result();

		expect(result).toEqual(Success(null));
		expectTypeOf(result).toEqualTypeOf<
			CoreResultType<
				{ readonly id: string; readonly title: string } | null,
				typeof TodoCouldNotBeLoaded.Type | typeof TodoConflict.Type
			>
		>();
	});

	it('uses decoded Effect schema Result values with core match and exhaustive failure switching', () => {
		const decoded = TodoResult.decode({
			_kind: 'Failure',
			_tag: 'TodoCouldNotBeLoaded',
			failure: {
				_tag: 'TodoCouldNotBeLoaded',
				message: 'Database is unavailable',
			},
		});

		const rendered = Result.match(decoded, {
			onSuccess: (todo) => todo.title,
			onFailure: (failure) => {
				switch (failure._tag) {
					case 'TodoNotFound':
						return failure.todoId;
					case 'TodoCouldNotBeLoaded':
						return failure.message;
					case 'TodoConflict':
						return failure.message;
					default: {
						const exhaustive: never = failure;
						return exhaustive;
					}
				}
			},
		});

		expect(rendered).toBe('Database is unavailable');
	});

	it('uses Effect channel failures converted by fromEffect with core tagged combinators', async () => {
		const effect = Effect.fail(
			TodoNotFound.make({
				message: 'Todo does not exist',
				todoId: 'todo-1',
			}),
		);

		const result = await Result.fromEffect(effect, {
			onError: {
				TodoNotFound,
			},
		});

		const mapped = Result.mapFailureTag(result, 'TodoNotFound', (failure) => {
			expect(failure).not.toBeInstanceOf(Error);
			return TodoCouldNotBeLoaded.make({
				message: `Could not load ${failure.todoId}`,
			});
		});

		expect(isFailure(mapped)).toBe(true);
		if (isFailure(mapped)) {
			expect(mapped.failure).toBeInstanceOf(Error);
			expect(mapped.failure).toMatchObject({
				_tag: 'TodoCouldNotBeLoaded',
				message: 'Could not load todo-1',
			});
		}
		expectTypeOf(mapped).toEqualTypeOf<CoreResultType<never, typeof TodoCouldNotBeLoaded.Type>>();
	});

	it('uses fromEffect output with core unwrap fallbacks', async () => {
		const success = await Result.fromEffect(
			Effect.succeed({
				id: 'todo-1',
				title: 'Write integration tests',
			}),
		);
		const failure = await Result.fromEffect(
			Effect.fail(
				TodoConflict.make({
					message: 'Todo already completed',
				}),
			),
			{
				onError: {
					TodoConflict,
				},
			},
		);

		expect(Result.unwrap(success)).toEqual({
			id: 'todo-1',
			title: 'Write integration tests',
		});
		expect(Result.unwrapOrNull(failure)).toBeNull();
		expect(Result.unwrapOrUndefined(failure)).toBeUndefined();
		expect(
			Result.unwrapOrElse(failure, (failure) => {
				expect(failure).not.toBeInstanceOf(Error);
				return failure.message;
			}),
		).toBe('Todo already completed');
	});

	it('round-trips core Result envelopes through Effect schema encode and decode', () => {
		const failure = TodoNotFound.make({
			message: 'Todo does not exist',
			todoId: 'todo-1',
		});

		const encoded = TodoResult.encode(Failure(failure));
		const decoded = TodoResult.decode(encoded);

		expect(encoded).toEqual({
			_kind: 'Failure',
			_tag: 'TodoNotFound',
			failure: {
				_tag: 'TodoNotFound',
				message: 'Todo does not exist',
				todoId: 'todo-1',
			},
		});
		expect(isFailure(decoded)).toBe(true);
		if (isFailure(decoded)) {
			expect(decoded.failure).toBeInstanceOf(Error);
			expect(decoded.failure).toMatchObject(failure);
		}
	});
});
