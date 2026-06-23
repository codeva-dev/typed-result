import { Cause, Chunk, Effect, Exit, Runtime, Schema as EffectSchema } from 'effect';
import {
	Failure,
	Result as CoreResult,
	Success,
	isFailure,
	isSuccess,
	type FailureType,
	type ResultType as CoreResultType,
	type SuccessType,
	type TaggedFailure,
} from '../../core';

export * from '../../core';

type NoContextFields = Record<string, EffectSchema.Schema.AnyNoContext>;
type NoTagFields<Fields extends NoContextFields> = '_tag' extends keyof Fields ? never : Fields;

type TaggedFailureSchema<Tag extends string, FailureSchema extends EffectSchema.Schema.AnyNoContext> = {
	readonly Schema: FailureSchema;
	readonly _tag: Tag;
	readonly Type: EffectSchema.Schema.Type<FailureSchema>;
	readonly Encoded: EffectSchema.Schema.Encoded<FailureSchema>;
};

type EffectTaggedFailure<Tag extends string, Fields extends NoContextFields> = Error & {
	readonly _tag: Tag;
} & {
	readonly [Key in keyof Fields]: EffectSchema.Schema.Type<Fields[Key]>;
};

type EffectTaggedFailureEncoded<Tag extends string, Fields extends NoContextFields> = {
	readonly _tag: Tag;
} & {
	readonly [Key in keyof Fields]: EffectSchema.Schema.Encoded<Fields[Key]>;
};

type TaggedFailureInput<Tag extends string, Fields extends NoContextFields> = Omit<
	EffectTaggedFailureEncoded<Tag, Fields>,
	'_tag'
>;

type ResultSchemaSuccess<SuccessSchema extends EffectSchema.Schema.AnyNoContext> = {
	readonly _kind: 'Success';
	readonly value: EffectSchema.Schema.Type<SuccessSchema>;
};

type EncodedResultSchemaSuccess<SuccessSchema extends EffectSchema.Schema.AnyNoContext> = {
	readonly _kind: 'Success';
	readonly value: EffectSchema.Schema.Encoded<SuccessSchema>;
};

type ResultSchemaFailureBranch<FailureSchemaDefinition> =
	FailureSchemaDefinition extends TaggedFailureSchema<infer Tag, infer FailureSchema>
		? {
				readonly _kind: 'Failure';
				readonly _tag: Tag;
				readonly failure: EffectSchema.Schema.Type<FailureSchema>;
			}
		: never;

type ResultSchemaFailure<Failures extends readonly TaggedFailureSchema<string, EffectSchema.Schema.AnyNoContext>[]> =
	ResultSchemaFailureBranch<Failures[number]>;

type EncodedResultSchemaFailureBranch<FailureSchemaDefinition> =
	FailureSchemaDefinition extends TaggedFailureSchema<infer Tag, infer FailureSchema>
		? {
				readonly _kind: 'Failure';
				readonly _tag: Tag;
				readonly failure: EffectSchema.Schema.Encoded<FailureSchema>;
			}
		: never;

type EncodedResultSchemaFailure<Failures extends readonly TaggedFailureSchema<string, EffectSchema.Schema.AnyNoContext>[]> =
	EncodedResultSchemaFailureBranch<Failures[number]>;

type ResultSchemaType<
	SuccessSchema extends EffectSchema.Schema.AnyNoContext,
	Failures extends readonly TaggedFailureSchema<string, EffectSchema.Schema.AnyNoContext>[],
> = ResultSchemaSuccess<SuccessSchema> | ResultSchemaFailure<Failures>;

type ResultSchemaEncoded<
	SuccessSchema extends EffectSchema.Schema.AnyNoContext,
	Failures extends readonly TaggedFailureSchema<string, EffectSchema.Schema.AnyNoContext>[],
> = EncodedResultSchemaSuccess<SuccessSchema> | EncodedResultSchemaFailure<Failures>;

type FailureBranchSchemas<Failures extends readonly TaggedFailureSchema<string, EffectSchema.Schema.AnyNoContext>[]> = {
	readonly [Key in keyof Failures]: EffectSchema.Schema<
		{
			readonly _kind: 'Failure';
			readonly _tag: Failures[Key]['_tag'];
			readonly failure: EffectSchema.Schema.Type<Failures[Key]['Schema']>;
		},
		{
			readonly _kind: 'Failure';
			readonly _tag: Failures[Key]['_tag'];
			readonly failure: EffectSchema.Schema.Encoded<Failures[Key]['Schema']>;
		},
		never
	>;
};

type DecodeEffectSuccess<Decoded> = Decoded extends {
	readonly _kind: 'Success';
	readonly value: infer Success;
}
	? Success
	: never;

type DecodeEffectFailure<Decoded> = Decoded extends {
	readonly _kind: 'Failure';
	readonly failure: infer Failure;
}
	? Failure
	: never;

type DecodeEffect<DecodedSchema extends EffectSchema.Schema.AnyNoContext> = Effect.Effect<
	DecodeEffectSuccess<EffectSchema.Schema.Type<DecodedSchema>>,
	DecodeEffectFailure<EffectSchema.Schema.Type<DecodedSchema>>,
	never
>;

export type EffectResultOptions<E, F extends TaggedFailure> = {
	readonly mapFailure: (failure: E) => F;
};

type FailureMapper = (failure: any) => TaggedFailure;

export type EffectResultMapperOptions<Mapper extends FailureMapper> = {
	readonly mapFailure: Mapper;
};

export type MaybePromise<T> = T | Promise<T>;

export type RuntimeProvider<R> =
	| Runtime.Runtime<R>
	| {
			readonly runtime: () => MaybePromise<Runtime.Runtime<R>>;
	  };

export type RunEffect<R> = {
	<A, E extends TaggedFailure>(effect: Effect.Effect<A, E, R>): Promise<CoreResultType<A, E>>;
	<A, E, F extends TaggedFailure>(
		effect: Effect.Effect<A, E, R>,
		options: EffectResultOptions<E, F>,
	): Promise<CoreResultType<A, F>>;
};

function throwIfDefectOrInterrupt<E>(cause: Cause.Cause<E>): void {
	if (Chunk.isNonEmpty(Cause.defects(cause)) || Cause.isInterrupted(cause)) {
		throw Cause.squash(cause);
	}
}

function failureOrThrow<E>(cause: Cause.Cause<E>): E {
	throwIfDefectOrInterrupt(cause);

	const failures = Cause.failures(cause);
	if (failures.length === 1) {
		return Chunk.unsafeHead(failures);
	}

	throw Cause.squash(cause);
}

function resolveRuntime<R>(runtimeOrProvider: RuntimeProvider<R>): MaybePromise<Runtime.Runtime<R>> {
	if (
		runtimeOrProvider !== null &&
		typeof runtimeOrProvider === 'object' &&
		'runtime' in runtimeOrProvider &&
		typeof runtimeOrProvider.runtime === 'function'
	) {
		return runtimeOrProvider.runtime();
	}

	return runtimeOrProvider as Runtime.Runtime<R>;
}

export function fromExit<A, E extends TaggedFailure>(exit: Exit.Exit<A, E>): CoreResultType<A, E>;
export function fromExit<A, E, F extends TaggedFailure>(
	exit: Exit.Exit<A, E>,
	options: EffectResultOptions<E, F>,
): CoreResultType<A, F>;
export function fromExit<A, E, F extends TaggedFailure>(
	exit: Exit.Exit<A, E>,
	options?: EffectResultOptions<E, F>,
): CoreResultType<A, any> {
	if (Exit.isSuccess(exit)) {
		return Success(exit.value);
	}

	const failure = failureOrThrow(exit.cause);
	return Failure(options ? options.mapFailure(failure) : (failure as E & TaggedFailure));
}

export function fromEffect<A, E extends TaggedFailure>(effect: Effect.Effect<A, E, never>): Promise<CoreResultType<A, E>>;
export function fromEffect<A, E, F extends TaggedFailure>(
	effect: Effect.Effect<A, E, never>,
	options: EffectResultOptions<E, F>,
): Promise<CoreResultType<A, F>>;
export async function fromEffect<A, E, F extends TaggedFailure>(
	effect: Effect.Effect<A, E, never>,
	options?: EffectResultOptions<E, F>,
): Promise<CoreResultType<A, any>> {
	const exit = await Effect.runPromiseExit(effect);
	return fromExit(exit, options as EffectResultOptions<E, F>);
}

export function runEffect<R>(runtimeOrProvider: RuntimeProvider<R>): RunEffect<R>;
export function runEffect<R, E, F extends TaggedFailure>(
	runtimeOrProvider: RuntimeProvider<R>,
	options: EffectResultOptions<E, F>,
): <A>(effect: Effect.Effect<A, E, R>) => Promise<CoreResultType<A, F>>;
export function runEffect<R, Mapper extends FailureMapper>(
	runtimeOrProvider: RuntimeProvider<R>,
	options: EffectResultMapperOptions<Mapper>,
): <A, E extends Parameters<Mapper>[0]>(
	effect: Effect.Effect<A, E, R>,
) => Promise<CoreResultType<A, ReturnType<Mapper>>>;
export function runEffect<R, E, F extends TaggedFailure>(
	runtimeOrProvider: RuntimeProvider<R>,
	outerOptions?: EffectResultOptions<E, F>,
) {
	return async <A, InnerE, InnerF extends TaggedFailure>(
		effect: Effect.Effect<A, InnerE, R>,
		innerOptions?: EffectResultOptions<InnerE, InnerF>,
	) => {
		const runtime = await resolveRuntime(runtimeOrProvider);
		const exit = await Runtime.runPromiseExit(runtime)(effect);
		const options = innerOptions ?? (outerOptions as unknown as EffectResultOptions<InnerE, InnerF> | undefined);

		return options ? fromExit(exit, options) : fromExit(exit as Exit.Exit<A, InnerE & TaggedFailure>);
	};
}

export const runWith = runEffect;

export function toFailureTag<const E extends { readonly _tag: string }>(failure: E): TaggedFailure<E['_tag']> {
	return {
		_tag: failure._tag,
	};
}

export function toEffect<S>(result: SuccessType<S>): Effect.Effect<S, never, never>;
export function toEffect<F extends TaggedFailure>(result: FailureType<F>): Effect.Effect<never, F, never>;
export function toEffect<S, F extends TaggedFailure>(result: CoreResultType<S, F>): Effect.Effect<S, F, never>;
export function toEffect<S, F extends TaggedFailure>(result: CoreResultType<S, F>): Effect.Effect<S, F, never> {
	if (isSuccess(result)) {
		return Effect.succeed(result.value);
	}

	if (isFailure(result)) {
		return Effect.fail(result.failure);
	}

	return Effect.die(new TypeError('Result.toEffect requires a Result value'));
}

class Schema {
	static TaggedFailure<const Tag extends string, const Fields extends NoContextFields>(
		tag: Tag,
		fields: NoTagFields<Fields>,
	) {
		if (Object.hasOwn(fields, '_tag')) {
			throw new TypeError('TaggedFailure fields must not contain _tag');
		}

		type Failure = EffectTaggedFailure<Tag, Fields>;
		type EncodedFailure = EffectTaggedFailureEncoded<Tag, Fields>;
		type FieldsInput = TaggedFailureInput<Tag, Fields>;

		const TaggedError = EffectSchema.TaggedError<Failure>()(tag, fields as Fields);
		const schema = TaggedError as unknown as EffectSchema.Schema<Failure, EncodedFailure, never>;

		return {
			Schema: schema,
			Type: {} as Failure,
			Encoded: {} as EncodedFailure,
			_tag: tag,
			make: (fields: FieldsInput): Failure =>
				EffectSchema.decodeUnknownSync(schema)({
					_tag: tag,
					...fields,
				}),
			decode: (value: unknown): Failure => EffectSchema.decodeUnknownSync(schema)(value),
			encode: (value: Failure): EncodedFailure => EffectSchema.encodeUnknownSync(schema)(value),
		} as const;
	}

	static fromTaggedError<const TaggedError extends EffectSchema.Schema.AnyNoContext & {
		readonly _tag: string;
		readonly make: (fields: Omit<EffectSchema.Schema.Encoded<TaggedError>, '_tag'>) => EffectSchema.Schema.Type<TaggedError>;
	}>(taggedError: TaggedError) {
		type Failure = EffectSchema.Schema.Type<TaggedError>;
		type EncodedFailure = EffectSchema.Schema.Encoded<TaggedError>;
		type FieldsInput = Omit<EncodedFailure, '_tag'>;

		return {
			Schema: taggedError,
			Type: {} as Failure,
			Encoded: {} as EncodedFailure,
			_tag: taggedError._tag,
			make: (fields: FieldsInput): Failure => taggedError.make(fields),
			decode: (value: unknown): Failure => EffectSchema.decodeUnknownSync(taggedError)(value),
			encode: (value: Failure): EncodedFailure => EffectSchema.encodeUnknownSync(taggedError)(value),
		} as const;
	}

	static Result<
		const SuccessSchema extends EffectSchema.Schema.AnyNoContext,
		const Failures extends readonly [
			TaggedFailureSchema<string, EffectSchema.Schema.AnyNoContext>,
			...TaggedFailureSchema<string, EffectSchema.Schema.AnyNoContext>[],
		],
	>({ Success, Failure }: { Success: SuccessSchema; Failure: Failures }) {
		const failureBranches = Failure.map((failure) =>
			EffectSchema.Struct({
				_kind: EffectSchema.Literal('Failure'),
				_tag: EffectSchema.Literal(failure._tag),
				failure: failure.Schema,
			}),
		) as unknown as FailureBranchSchemas<Failures>;

		const failureUnion = EffectSchema.Union(
			...(failureBranches as unknown as [
				FailureBranchSchemas<Failures>[number],
				FailureBranchSchemas<Failures>[number],
				...Array<FailureBranchSchemas<Failures>[number]>,
			]),
		);

		const schema = EffectSchema.Union(
			EffectSchema.Struct({
				_kind: EffectSchema.Literal('Success'),
				value: Success,
			}),
			failureUnion,
		) as unknown as EffectSchema.Schema<ResultSchemaType<SuccessSchema, Failures>, ResultSchemaEncoded<SuccessSchema, Failures>, never>;

		return {
			Schema: schema,
			Type: {} as ResultSchemaType<SuccessSchema, Failures>,
			Encoded: {} as ResultSchemaEncoded<SuccessSchema, Failures>,
			decode: (value: unknown): ResultSchemaType<SuccessSchema, Failures> => EffectSchema.decodeUnknownSync(schema)(value),
			decodeEffect: (value: unknown): DecodeEffect<typeof schema> => Schema.decodeEffect(schema, value),
			encode: (value: ResultSchemaType<SuccessSchema, Failures>): ResultSchemaEncoded<SuccessSchema, Failures> =>
				EffectSchema.encodeUnknownSync(schema)(value),
		} as const;
	}

	static safeDecode<DecodedSchema extends EffectSchema.Schema.AnyNoContext>(schema: DecodedSchema, value: unknown) {
		try {
			return Success(EffectSchema.decodeUnknownSync(schema)(value));
		} catch (error) {
			return Failure('InvalidResult', {
				message: 'Invalid result',
				errors: error instanceof Error ? error.message : String(error),
			});
		}
	}

	static decodeEffect<DecodedSchema extends EffectSchema.Schema.AnyNoContext>(
		schema: DecodedSchema,
		value: unknown,
	): DecodeEffect<DecodedSchema> {
		let decoded: EffectSchema.Schema.Type<DecodedSchema>;
		try {
			decoded = EffectSchema.decodeUnknownSync(schema)(value);
		} catch (error) {
			return Effect.die(new TypeError('Invalid result type', { cause: error }));
		}

		if (isSuccess(decoded) || isFailure(decoded)) {
			return toEffect(decoded) as DecodeEffect<DecodedSchema>;
		}

		return Effect.die(new TypeError('Decoded value is not a Result value', { cause: decoded }));
	}

	static decode<DecodedSchema extends EffectSchema.Schema.AnyNoContext>(
		schema: DecodedSchema,
		value: unknown,
	): EffectSchema.Schema.Type<DecodedSchema> {
		const result = Schema.safeDecode(schema, value);
		if (isSuccess(result)) {
			return result.value;
		}

		throw new TypeError('Invalid result type', { cause: result.failure });
	}
}

export const Result = {
	...CoreResult,
	fromExit,
	fromEffect,
	runEffect,
	runWith,
	toFailureTag,
	toEffect,
} as const;

export const unsafe_Schema = Schema;
