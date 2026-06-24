import { Failure, Success, isSuccess } from '../../core';
import z4 from 'zod/v4';

export * from '../../core';

type TaggedFailureSchema<Tag extends string, Schema extends z4.ZodType> = {
	readonly Schema: Schema;
	readonly _tag: Tag;
	readonly Type: z4.output<Schema>;
	readonly Encoded: z4.input<Schema>;
};

type NoTagFields<Fields extends z4.ZodRawShape> = '_tag' extends keyof Fields ? never : Fields;

const FailureSchema = z4.object({
	_tag: z4.string(),
});

class Schema {
	static TaggedFailure<const Tag extends string, const Fields extends z4.ZodRawShape>(
		tag: Tag,
		fields: NoTagFields<Fields>,
	) {
		if (Object.hasOwn(fields, '_tag')) {
			throw new TypeError('TaggedFailure fields must not contain _tag');
		}

		const FieldsSchema = z4.object(fields);

		const _ = FailureSchema.extend({
			...FieldsSchema.shape,
			_tag: z4.literal(tag),
		});

		type FieldsInput = z4.input<typeof FieldsSchema>;
		type Failure = z4.output<typeof _>;
		type EncodedFailure = z4.input<typeof _>;

		return {
			Schema: _,
			Type: {} as Failure,
			Encoded: {} as EncodedFailure,
			_tag: tag,
			make: (fields: FieldsInput) => _.parse({ _tag: tag, ...fields }),
			decode: (value: unknown) => _.parse(value),
			encode: (value: Failure) => _.encode(value),
		} as const;
	}

	static Result<
		const S extends z4.ZodType,
		const FailureTag extends string,
		const FailureZodSchema extends z4.ZodType,
		const Failures extends readonly TaggedFailureSchema<FailureTag, FailureZodSchema>[],
	>({ Success, Failure }: { Success: S; Failure: Failures }) {
		type FailureBranchSchemas<Failures extends readonly TaggedFailureSchema<string, z4.ZodType>[]> = {
			readonly [K in keyof Failures]: z4.ZodObject<{
				_kind: z4.ZodLiteral<'Failure'>;
				_tag: z4.ZodLiteral<Failures[K]['_tag']>;
				failure: Failures[K]['Schema'];
			}>;
		};

		const FailureBranches = Failure.map((failure) =>
			z4.object({
				_kind: z4.literal('Failure'),
				_tag: z4.literal(failure._tag),
				failure: failure.Schema,
			}),
		) as unknown as FailureBranchSchemas<Failures>;

		const FailureUnion = z4.union(
			FailureBranches as unknown as [
				FailureBranchSchemas<Failures>[number],
				FailureBranchSchemas<Failures>[number],
				...Array<FailureBranchSchemas<Failures>[number]>,
			],
		);

		const _ = z4.union([
			z4.object({
				_kind: z4.literal('Success'),
				value: Success,
			}),
			FailureUnion,
		]);

		return {
			Schema: _,
			Type: {} as z4.output<typeof _>,
			Encoded: {} as z4.input<typeof _>,
			decode: (value: unknown) => _.parse(value),
			encode: (value: z4.output<typeof _>): z4.input<typeof _> => _.encode(value),
		} as const;
	}

	static safeDecode<DecodedSchema extends z4.ZodType>(schema: DecodedSchema, value: unknown) {
		const parsed = schema.safeParse(value);

		if (parsed.success) {
			return Success(parsed.data);
		}

		return Failure('InvalidResult', {
			message: 'Invalid result',
			errors: parsed.error.message,
		});
	}

	static decode<DecodedSchema extends z4.ZodType>(schema: DecodedSchema, value: unknown) {
		const result = Schema.safeDecode(schema, value);
		if (isSuccess(result)) {
			return result.value;
		}

		throw new TypeError('Invalid result type', { cause: result.failure });
	}
}

export const unsafe_Schema = Schema;
