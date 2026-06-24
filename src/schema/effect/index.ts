import { Cause, Chunk, Effect, Exit, Schema as EffectSchema } from 'effect';
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

type AnyTaggedErrorClassLike = {
	readonly _tag: string;
	new (props: any): any;
	readonly make?: (fields: any) => any;
};

type TaggedErrorType<TaggedError> =
	TaggedError extends EffectSchema.Schema.AnyNoContext
		? EffectSchema.Schema.Type<TaggedError>
		: TaggedError extends new (...args: readonly any[]) => infer Type
			? Type
			: never;

type TaggedErrorInput<TaggedError> =
	TaggedError extends {
		readonly make: (fields: infer Fields) => any;
	}
		? Fields
		: TaggedError extends new (props: infer Fields) => any
			? Fields
			: never;

type TaggedErrorEncoded<TaggedError extends { readonly _tag: string }> =
	TaggedError extends EffectSchema.Schema.AnyNoContext
		? EffectSchema.Schema.Encoded<TaggedError>
		: TaggedErrorInput<TaggedError> extends object
			? {
					readonly _tag: TaggedError['_tag'];
				} & TaggedErrorInput<TaggedError>
			: {
					readonly _tag: TaggedError['_tag'];
				};

type OmitUnknownCause<Encoded> = Encoded extends {
	readonly cause?: infer Cause;
}
	? unknown extends Cause
		? Omit<Encoded, 'cause'>
		: Encoded
	: Encoded;

function omitCause<Encoded>(encoded: Encoded): Omit<Encoded, 'cause'> {
	if (encoded === null || typeof encoded !== 'object' || !('cause' in encoded)) {
		return encoded as Omit<Encoded, 'cause'>;
	}

	const { cause: _cause, ...publicEncoded } = encoded;
	return publicEncoded as Omit<Encoded, 'cause'>;
}

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

export type EffectErrorWithTag = {
	readonly _tag: string;
};

export type EffectFailureEncoder<Tag extends string, Failure extends EffectErrorWithTag, Encoded extends TaggedFailure> = {
	readonly _tag: Tag;
	readonly encode: (failure: Failure) => Encoded;
};

export type EffectFailureHandlers<E extends EffectErrorWithTag> = Partial<{
	readonly [Tag in E['_tag']]: EffectFailureEncoder<Tag, Extract<E, { readonly _tag: Tag }>, TaggedFailure<Tag>>;
}>;

type NoExtraFailureHandlers<E extends EffectErrorWithTag, Handlers> = Handlers & {
	readonly [Tag in Exclude<keyof Handlers, E['_tag']>]: never;
};

export type EffectResultOptions<E extends EffectErrorWithTag, Handlers extends EffectFailureHandlers<E>> = {
	readonly onError: NoExtraFailureHandlers<E, Handlers>;
};

type EncodedFailureFromHandlers<Handlers> = {
	readonly [Key in keyof Handlers]: Handlers[Key] extends {
		readonly encode: (...args: any) => infer Encoded;
	}
		? Encoded extends TaggedFailure
			? Encoded
			: never
		: never;
}[keyof Handlers];

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

export function fromExit<A>(exit: Exit.Exit<A, never>): CoreResultType<A, never>;
export function fromExit<A, E extends EffectErrorWithTag, Handlers extends EffectFailureHandlers<E>>(
	exit: Exit.Exit<A, E>,
	options: EffectResultOptions<E, Handlers>,
): CoreResultType<A, EncodedFailureFromHandlers<Handlers>>;
export function fromExit<A, E extends EffectErrorWithTag, Handlers extends EffectFailureHandlers<E>>(
	exit: Exit.Exit<A, E>,
	options?: EffectResultOptions<E, Handlers>,
): CoreResultType<A, any> {
	if (Exit.isSuccess(exit)) {
		return Success(exit.value);
	}

	const failure = failureOrThrow(exit.cause);
	const handler = options?.onError[failure._tag as keyof Handlers] as
		| EffectFailureEncoder<string, EffectErrorWithTag, TaggedFailure>
		| undefined;

	if (!handler) {
		throw failure;
	}

	if (handler._tag !== failure._tag) {
		throw new TypeError(`Result.fromExit handler tag mismatch: expected ${failure._tag}, got ${handler._tag}`);
	}

	return Failure(handler.encode(failure));
}

export function fromEffect<A>(effect: Effect.Effect<A, never, never>): Promise<CoreResultType<A, never>>;
export function fromEffect<A, E extends EffectErrorWithTag, Handlers extends EffectFailureHandlers<E>>(
	effect: Effect.Effect<A, E, never>,
	options: EffectResultOptions<E, Handlers>,
): Promise<CoreResultType<A, EncodedFailureFromHandlers<Handlers>>>;
export async function fromEffect<A, E extends EffectErrorWithTag, Handlers extends EffectFailureHandlers<E>>(
	effect: Effect.Effect<A, E, never>,
	options?: EffectResultOptions<E, Handlers>,
): Promise<CoreResultType<A, any>> {
	const exit = await Effect.runPromiseExit(effect);
	return fromExit(exit, options as EffectResultOptions<E, Handlers>);
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

	static fromTaggedError<const TaggedError extends AnyTaggedErrorClassLike>(taggedError: TaggedError) {
		type Failure = TaggedErrorType<TaggedError>;
		type EncodedFailure = TaggedErrorEncoded<TaggedError>;
		type PublicEncodedFailure = OmitUnknownCause<EncodedFailure>;
		type Tag = EncodedFailure extends { readonly _tag: infer T extends string } ? T : TaggedError['_tag'];
		type FieldsInput = TaggedErrorInput<TaggedError>;

		return {
			Schema: taggedError as unknown as EffectSchema.Schema<Failure, PublicEncodedFailure, never>,
			Type: {} as Failure,
			Encoded: {} as PublicEncodedFailure,
			_tag: taggedError._tag as Tag,
			make: (fields: FieldsInput): Failure =>
				(taggedError.make ? taggedError.make(fields) : new taggedError(fields as ConstructorParameters<TaggedError>[0])) as Failure,
			decode: (value: unknown): Failure =>
				EffectSchema.decodeUnknownSync(taggedError as unknown as EffectSchema.Schema<Failure, EncodedFailure, never>)(value),
			encode: (value: Failure): PublicEncodedFailure =>
				omitCause(EffectSchema.encodeUnknownSync(taggedError as unknown as EffectSchema.Schema<Failure, EncodedFailure, never>)(value)) as PublicEncodedFailure,
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
	toEffect,
} as const;

export const unsafe_Schema = Schema;
