import { z } from 'zod';
import { TypedResultDecodeError, TypedResultEncodeError } from './errors';
import * as Core from './index';
import type { Failure as FailureResult, Result as ResultType, TaggedFailure } from './result';

type AnyZodSchema = z.ZodType<any, any>;
type AnySuccessSchema = { readonly _kind: "SuccessSchema"; readonly decode: (value: unknown) => any; readonly encode: (value: any) => any; };
type AnyFailureSchema = { readonly _kind: "FailureSchema"; readonly tag: string; readonly decode: (value: unknown) => TaggedFailure; readonly encode: (value: any) => TaggedFailure; readonly make: (fields: any) => TaggedFailure; };
type OneOrMany<T> = T | readonly T[];

type SuccessValue<T> = T extends ZodSuccessSchema<infer Schema> ? z.output<Schema> : never;
type SuccessInput<T> = T extends ZodSuccessSchema<infer Schema> ? z.input<Schema> : never;
type SuccessValueOf<T> = T extends readonly unknown[] ? SuccessValue<T[number]> : SuccessValue<T>;
type SuccessInputOf<T> = T extends readonly unknown[] ? SuccessInput<T[number]> : SuccessInput<T>;

type FailureValue<T> = T extends ZodFailureSchema<infer Tag, infer Shape>
	? TaggedFailure<Tag> & z.output<z.ZodObject<Shape>>
	: never;
type FailureFields<T> = T extends ZodFailureSchema<string, infer Shape> ? z.input<z.ZodObject<Shape>> : never;
type FailureValueOf<T> = T extends readonly unknown[] ? FailureValue<T[number]> : FailureValue<T>;

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

export type ZodSuccessSchema<Schema extends AnyZodSchema> = {
	readonly _kind: 'SuccessSchema';
	readonly schema: Schema;
	readonly make: (value: z.input<Schema>) => z.output<Schema>;
	readonly Success: (value: z.input<Schema>) => Core.SuccessType<z.output<Schema>>;
	readonly decode: (value: unknown) => z.output<Schema>;
	readonly encode: (value: z.output<Schema>) => z.input<Schema>;
	readonly is: (value: unknown) => value is z.output<Schema>;
};

export type ZodFailureSchema<Tag extends string, Shape extends z.ZodRawShape> = {
	readonly _kind: 'FailureSchema';
	readonly tag: Tag;
	readonly schema: z.ZodObject<{ readonly _tag: z.ZodLiteral<Tag> } & Shape>;
	readonly make: (fields: z.input<z.ZodObject<Shape>>) => TaggedFailure<Tag> & z.output<z.ZodObject<Shape>>;
	readonly Failure: (fields: z.input<z.ZodObject<Shape>>) => FailureResult<TaggedFailure<Tag> & z.output<z.ZodObject<Shape>>>;
	readonly decode: (value: unknown) => TaggedFailure<Tag> & z.output<z.ZodObject<Shape>>;
	readonly encode: (value: TaggedFailure<Tag> & z.output<z.ZodObject<Shape>>) => TaggedFailure<Tag> & z.input<z.ZodObject<Shape>>;
	readonly is: (value: unknown) => value is TaggedFailure<Tag> & z.output<z.ZodObject<Shape>>;
};

export type ZodResultSchema<Successes extends OneOrMany<AnySuccessSchema>, Failures extends OneOrMany<AnyFailureSchema>> = {
	readonly _kind: 'ResultSchema';
	readonly success: Successes;
	readonly failure: Failures;
	readonly Success: (value: SuccessInputOf<Successes>) => Core.SuccessType<SuccessValueOf<Successes>>;
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
	) => ResultType<SuccessInputOf<Successes>, FailureValueOf<Failures>>;
	readonly is: (value: unknown) => value is ResultType<SuccessValueOf<Successes>, FailureValueOf<Failures>>;
};

export function defineSuccess<Schema extends AnyZodSchema>(schema: Schema): ZodSuccessSchema<Schema> {
	const decode = (value: unknown) => schema.parse(value) as z.output<Schema>;
	const encode = (value: z.output<Schema>) => schema.parse(value) as z.input<Schema>;

	return {
		_kind: 'SuccessSchema',
		schema,
		make: decode,
		Success: (value) => Core.Success(decode(value)),
		decode,
		encode,
		is: (value): value is z.output<Schema> => schema.safeParse(value).success,
	};
}

export function defineFailure<const Tag extends string, const Shape extends z.ZodRawShape>(
	tag: Tag,
	fields: Shape,
): ZodFailureSchema<Tag, Shape> {
	const fieldsSchema = z.object(fields);
	const schema = z.object({ _tag: z.literal(tag), ...fields }) as z.ZodObject<{ readonly _tag: z.ZodLiteral<Tag> } & Shape>;

	const decode = (value: unknown) => schema.parse(value) as TaggedFailure<Tag> & z.output<z.ZodObject<Shape>>;
	const encode = (value: TaggedFailure<Tag> & z.output<z.ZodObject<Shape>>) =>
		schema.parse(value) as TaggedFailure<Tag> & z.input<z.ZodObject<Shape>>;
	const make = (value: z.input<z.ZodObject<Shape>>) => decode({ _tag: tag, ...fieldsSchema.parse(value) });

	return {
		_kind: 'FailureSchema',
		tag,
		schema,
		make,
		Failure: (value) => Core.Failure(make(value)),
		decode,
		encode,
		is: (value): value is TaggedFailure<Tag> & z.output<z.ZodObject<Shape>> => schema.safeParse(value).success,
	};
}

export function defineSchema<Successes extends OneOrMany<AnySuccessSchema>, Failures extends OneOrMany<AnyFailureSchema>>(
	options: {
		readonly success: Successes;
		readonly failure: Failures;
	},
): ZodResultSchema<Successes, Failures> {
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

	const resultSchema: ZodResultSchema<Successes, Failures> = {
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
		}) as ZodResultSchema<Successes, Failures>['Failure'],

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
		}) as ZodResultSchema<Successes, Failures>['decode'],

		encode(result) {
			try {
				if (Core.isSuccess(result)) {
					return Core.Success(decodeSuccessValue(result.value)) as ResultType<SuccessInputOf<Successes>, FailureValueOf<Failures>>;
				}

				const failure = decodeFailureValue(result.failure) as FailureValueOf<Failures>;

				if (result._tag !== failure._tag) {
					throw new TypedResultEncodeError('Failure envelope tag does not match failure payload tag');
				}

				return Core.Failure(failure) as ResultType<SuccessInputOf<Successes>, FailureValueOf<Failures>>;
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

function toDecodeError(cause: unknown): TypedResultDecodeError {
	if (cause instanceof TypedResultDecodeError) return cause;
	return new TypedResultDecodeError('Could not decode Result payload', { cause });
}

function toEncodeError(cause: unknown): TypedResultEncodeError {
	if (cause instanceof TypedResultEncodeError) return cause;
	return new TypedResultEncodeError('Could not encode Result payload', { cause });
}

export { z };
export { TypedResultDecodeError, TypedResultEncodeError } from './errors';
export * from './index';

export const Result = {
	...Core.Result,
	defineSuccess,
	defineFailure,
	defineSchema,
} as const;
