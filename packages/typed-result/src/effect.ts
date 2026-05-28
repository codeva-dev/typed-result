import * as Schema from 'effect/Schema';
import { TypedResultDecodeError, TypedResultEncodeError } from './errors';
import * as Core from './index';
import type { Failure as FailureResult, Result as ResultType, TaggedFailure } from './result';

type AnyEffectSchema = Schema.Schema<any, any, never>;
type Shape = Record<string, Schema.Schema<any, any, never>>;
type AnySuccessSchema = { readonly _kind: "SuccessSchema"; readonly decode: (value: unknown) => any; readonly encode: (value: any) => any; };
type AnyFailureSchema = { readonly _kind: "FailureSchema"; readonly tag: string; readonly decode: (value: unknown) => TaggedFailure; readonly encode: (value: any) => TaggedFailure; readonly make: (fields: any) => TaggedFailure; };
type OneOrMany<T> = T | readonly T[];

type FieldType<S extends Shape> = {
	readonly [K in keyof S]: Schema.Schema.Type<S[K]>;
};

type FieldEncoded<S extends Shape> = {
	readonly [K in keyof S]: Schema.Schema.Encoded<S[K]>;
};

type SuccessValue<T> = T extends EffectSuccessSchema<infer SuccessSchema> ? Schema.Schema.Type<SuccessSchema> : never;
type SuccessEncoded<T> = T extends EffectSuccessSchema<infer SuccessSchema> ? Schema.Schema.Encoded<SuccessSchema> : never;
type SuccessValueOf<T> = T extends readonly unknown[] ? SuccessValue<T[number]> : SuccessValue<T>;
type SuccessEncodedOf<T> = T extends readonly unknown[] ? SuccessEncoded<T[number]> : SuccessEncoded<T>;

type FailureValue<T> = T extends EffectFailureSchema<infer Tag, infer Fields> ? TaggedFailure<Tag> & FieldType<Fields> : never;
type FailureEncoded<T> = T extends EffectFailureSchema<infer Tag, infer Fields> ? TaggedFailure<Tag> & FieldEncoded<Fields> : never;
type FailureFields<T> = T extends EffectFailureSchema<string, infer Fields> ? FieldEncoded<Fields> : never;
type FailureValueOf<T> = T extends readonly unknown[] ? FailureValue<T[number]> : FailureValue<T>;
type FailureEncodedOf<T> = T extends readonly unknown[] ? FailureEncoded<T[number]> : FailureEncoded<T>;
type FailureByTag<Failures, Tag extends string> = Extract<FailureValueOf<Failures>, { readonly _tag: Tag }>;
type FailureFieldsByTag<Failures, Tag extends string> =
	Failures extends readonly unknown[]
		? Extract<Failures[number], { readonly tag: Tag }> extends infer FailureSchema
			? FailureFields<FailureSchema>
			: never
		: Failures extends { readonly tag: Tag }
			? FailureFields<Failures>
			: never;
type FailureTagOf<Failures> = FailureValueOf<Failures>['_tag'];

export type EffectSuccessSchema<SuccessSchema extends AnyEffectSchema> = {
	readonly _kind: 'SuccessSchema';
	readonly schema: SuccessSchema;
	readonly make: (value: Schema.Schema.Encoded<SuccessSchema>) => Schema.Schema.Type<SuccessSchema>;
	readonly Success: (value: Schema.Schema.Encoded<SuccessSchema>) => Core.SuccessType<Schema.Schema.Type<SuccessSchema>>;
	readonly decode: (value: unknown) => Schema.Schema.Type<SuccessSchema>;
	readonly encode: (value: Schema.Schema.Type<SuccessSchema>) => Schema.Schema.Encoded<SuccessSchema>;
	readonly is: (value: unknown) => value is Schema.Schema.Type<SuccessSchema>;
};

export type EffectFailureSchema<Tag extends string, Fields extends Shape> = {
	readonly _kind: 'FailureSchema';
	readonly tag: Tag;
	readonly schema: AnyEffectSchema;
	readonly make: (fields: FieldEncoded<Fields>) => TaggedFailure<Tag> & FieldType<Fields>;
	readonly Failure: (fields: FieldEncoded<Fields>) => FailureResult<TaggedFailure<Tag> & FieldType<Fields>>;
	readonly decode: (value: unknown) => TaggedFailure<Tag> & FieldType<Fields>;
	readonly encode: (value: TaggedFailure<Tag> & FieldType<Fields>) => TaggedFailure<Tag> & FieldEncoded<Fields>;
	readonly is: (value: unknown) => value is TaggedFailure<Tag> & FieldType<Fields>;
};

export type EffectResultSchema<Successes extends OneOrMany<AnySuccessSchema>, Failures extends OneOrMany<AnyFailureSchema>> = {
	readonly _kind: 'ResultSchema';
	readonly success: Successes;
	readonly failure: Failures;
	readonly Success: (value: SuccessEncodedOf<Successes>) => Core.SuccessType<SuccessValueOf<Successes>>;
	readonly Failure: {
		<const Tag extends FailureTagOf<Failures>>(
			tag: Tag,
			fields: unknown,
		): FailureResult<FailureByTag<Failures, Tag>>;
		(failure: FailureValueOf<Failures>): FailureResult<FailureValueOf<Failures>>;
	};
	readonly decode: {
		(value: unknown): ResultType<SuccessValueOf<Successes>, FailureValueOf<Failures>>;
		<const NextFailure extends TaggedFailure>(
			value: unknown,
			options: {
				readonly onInvalid: 'failure';
				readonly failure: (error: TypedResultDecodeError) => FailureResult<NextFailure>;
			},
		): ResultType<SuccessValueOf<Successes>, FailureValueOf<Failures> | NextFailure>;
	};
	readonly encode: (
		result: ResultType<SuccessValueOf<Successes>, FailureValueOf<Failures>>,
	) => ResultType<SuccessEncodedOf<Successes>, FailureEncodedOf<Failures>>;
	readonly is: (value: unknown) => value is ResultType<SuccessValueOf<Successes>, FailureValueOf<Failures>>;
};

export function defineSuccess<SuccessSchema extends AnyEffectSchema>(
	schema: SuccessSchema,
): EffectSuccessSchema<SuccessSchema> {
	const decode = (value: unknown) => Schema.decodeUnknownSync(schema)(value) as Schema.Schema.Type<SuccessSchema>;
	const encode = (value: Schema.Schema.Type<SuccessSchema>) =>
		Schema.encodeSync(schema)(value) as Schema.Schema.Encoded<SuccessSchema>;

	return {
		_kind: 'SuccessSchema',
		schema,
		make: decode,
		Success: (value) => Core.Success(decode(value)),
		decode,
		encode,
		is: (value): value is Schema.Schema.Type<SuccessSchema> => {
			try {
				decode(value);
				return true;
			} catch {
				return false;
			}
		},
	};
}

export function defineFailure<const Tag extends string, const Fields extends Shape>(
	tag: Tag,
	fields: Fields,
): EffectFailureSchema<Tag, Fields> {
	const schema = Schema.Struct({
		_tag: Schema.Literal(tag),
		...fields,
	});
	const fieldsSchema = Schema.Struct(fields);
	const schemaNoContext = schema as unknown as Schema.Schema<any, any, never>;
	const fieldsSchemaNoContext = fieldsSchema as unknown as Schema.Schema<any, any, never>;

	const decode = (value: unknown) => Schema.decodeUnknownSync(schemaNoContext)(value) as TaggedFailure<Tag> & FieldType<Fields>;
	const encode = (value: TaggedFailure<Tag> & FieldType<Fields>) =>
		Schema.encodeSync(schemaNoContext)(value) as TaggedFailure<Tag> & FieldEncoded<Fields>;
	const make = (value: FieldEncoded<Fields>) => decode({ _tag: tag, ...Schema.decodeUnknownSync(fieldsSchemaNoContext)(value) });

	return {
		_kind: 'FailureSchema',
		tag,
		schema: schemaNoContext,
		make,
		Failure: (value) => Core.Failure(make(value)),
		decode,
		encode,
		is: (value): value is TaggedFailure<Tag> & FieldType<Fields> => {
			try {
				decode(value);
				return true;
			} catch {
				return false;
			}
		},
	};
}

export function defineSchema<Successes extends OneOrMany<AnySuccessSchema>, Failures extends OneOrMany<AnyFailureSchema>>(
	options: {
		readonly success: Successes;
		readonly failure: Failures;
	},
): EffectResultSchema<Successes, Failures> {
	const successes = toArray(options.success);
	const failures = toArray(options.failure);

	const decodeSuccessValue = (value: unknown) => decodeWithSchemas(successes, value, 'success');
	const decodeFailureValue = (value: unknown) => decodeWithSchemas(failures, value, 'failure');

	const decodeThrow = (value: unknown): ResultType<SuccessValueOf<Successes>, FailureValueOf<Failures>> => {
		if (!Core.isResult(value)) {
			throw new TypedResultDecodeError('Expected a Result envelope');
		}

		if (Core.isSuccess(value)) {
			return Core.Success(decodeSuccessValue(value.value)) as ResultType<SuccessValueOf<Successes>, FailureValueOf<Failures>>;
		}

		const failure = decodeFailureValue(value.failure) as FailureValueOf<Failures>;

		if (value._tag !== failure._tag) {
			throw new TypedResultDecodeError('Failure envelope tag does not match failure payload tag');
		}

		return Core.Failure(failure) as ResultType<SuccessValueOf<Successes>, FailureValueOf<Failures>>;
	};

	const resultSchema: EffectResultSchema<Successes, Failures> = {
		_kind: 'ResultSchema',
		success: options.success,
		failure: options.failure,

		Success(value) {
			return Core.Success(decodeSuccessValue(value)) as Core.SuccessType<SuccessValueOf<Successes>>;
		},

		Failure: ((first: FailureTagOf<Failures> | FailureValueOf<Failures>, fields?: unknown) => {
			if (typeof first === 'string') {
				const schema = failures.find((failureSchema) => failureSchema.tag === first);

				if (!schema) {
					throw new TypedResultEncodeError(`Unknown failure tag: ${first}`);
				}

				return Core.Failure(schema.make(fields as never));
			}

			const failure = decodeFailureValue(first) as FailureValueOf<Failures>;
			return Core.Failure(failure);
		}) as EffectResultSchema<Successes, Failures>['Failure'],

		decode: ((value: unknown, options?: DecodeOptions) => {
			try {
				return decodeThrow(value);
			} catch (cause) {
				const error = toDecodeError(cause);

				if (options?.onInvalid === 'failure') {
					return options.failure(error);
				}

				throw error;
			}
		}) as EffectResultSchema<Successes, Failures>['decode'],

		encode(result) {
			try {
				if (Core.isSuccess(result)) {
					const encoded = encodeWithSchemas(successes, result.value, 'success');
					return Core.Success(encoded) as ResultType<SuccessEncodedOf<Successes>, FailureEncodedOf<Failures>>;
				}

				const encoded = encodeWithSchemas(failures, result.failure, 'failure') as FailureEncodedOf<Failures>;

				if (result._tag !== encoded._tag) {
					throw new TypedResultEncodeError('Failure envelope tag does not match failure payload tag');
				}

				return Core.Failure(encoded) as ResultType<SuccessEncodedOf<Successes>, FailureEncodedOf<Failures>>;
			} catch (cause) {
				throw toEncodeError(cause);
			}
		},

		is(value): value is ResultType<SuccessValueOf<Successes>, FailureValueOf<Failures>> {
			try {
				decodeThrow(value);
				return true;
			} catch {
				return false;
			}
		},
	};

	return resultSchema;
}

type DecodeOptions = {
	readonly onInvalid: 'failure';
	readonly failure: (error: TypedResultDecodeError) => FailureResult<TaggedFailure>;
};

function toArray<T>(value: OneOrMany<T>): readonly T[] {
	return Array.isArray(value) ? (value as readonly T[]) : [value as T];
}

function decodeWithSchemas(schemas: readonly (AnySuccessSchema | AnyFailureSchema)[], value: unknown, channel: string): unknown {
	const errors: unknown[] = [];

	for (const schema of schemas) {
		try {
			return schema.decode(value);
		} catch (error) {
			errors.push(error);
		}
	}

	throw new TypedResultDecodeError(`Could not decode ${channel} payload`, {
		cause: errors,
	});
}

function encodeWithSchemas(schemas: readonly (AnySuccessSchema | AnyFailureSchema)[], value: unknown, channel: string): unknown {
	const errors: unknown[] = [];

	for (const schema of schemas) {
		try {
			return schema.encode(value as never);
		} catch (error) {
			errors.push(error);
		}
	}

	throw new TypedResultEncodeError(`Could not encode ${channel} payload`, {
		cause: errors,
	});
}

function toDecodeError(cause: unknown): TypedResultDecodeError {
	if (cause instanceof TypedResultDecodeError) return cause;
	return new TypedResultDecodeError('Could not decode Result payload', { cause });
}

function toEncodeError(cause: unknown): TypedResultEncodeError {
	if (cause instanceof TypedResultEncodeError) return cause;
	return new TypedResultEncodeError('Could not encode Result payload', { cause });
}

export { Schema };
export { TypedResultDecodeError, TypedResultEncodeError } from './errors';
export * from './index';

export const Result = {
	...Core.Result,
	defineSuccess,
	defineFailure,
	defineSchema,
} as const;
