import { Cause, Effect, Exit, Option, Schema as EffectSchema } from 'effect';
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

export function fromEffectExit<A, E extends TaggedFailure>(exit: Exit.Exit<A, E>): CoreResultType<A, E> {
	if (Exit.isSuccess(exit)) {
		return Success(exit.value);
	}

	const failure = Cause.failureOption(exit.cause);
	if (Option.isSome(failure)) {
		return Failure(failure.value);
	}

	throw Cause.squash(exit.cause);
}

export async function fromEffect<A, E extends TaggedFailure>(
	effect: Effect.Effect<A, E, never>,
): Promise<CoreResultType<A, E>> {
	const exit = await Effect.runPromiseExit(effect);
	return fromEffectExit(exit);
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
	fromEffect,
	fromEffectExit,
	toEffect,
} as const;

export const unsafe_Schema = Schema;
