export type TaggedFailure<T extends string = string, Fields extends object = {}> = {
	readonly _tag: T;
};

export type TaggedFailureDefinition<T extends string, Fields extends object = object> = {
	readonly _tag: T;
	readonly make: (fields: Fields) => TaggedFailure<T> & Fields;
};

export type InferFailureTag<R> = R extends Failure<infer F> ? F['_tag'] : never;
export type InferFailureByTag<R, T extends InferFailureTag<R>> =
	R extends Failure<infer F> ? (F extends { readonly _tag: T } ? F : never) : never;
export type InferFailureByTags<R, Tags extends ReadonlyArray<InferFailureTag<R>>> =
	R extends Failure<infer F> ? (F extends { readonly _tag: Tags[number] } ? F : never) : never;

export function defineTaggedFailure<const T extends string, const Fields extends object = object>(
	tag: T,
): TaggedFailureDefinition<T, Fields> {
	return {
		_tag: tag,
		make: (fields: Fields) => createTaggedFailure(tag, fields),
	};
}

export type Success<S> = {
	readonly _kind: 'Success';
	readonly value: S;
};

export type Failure<F extends TaggedFailure> = {
	readonly _kind: 'Failure';
	readonly _tag: F['_tag'];
	readonly failure: F;
};

export type Result<S, F extends TaggedFailure> = Success<S> | Failure<F>;

export type AnyResult = Success<any> | Failure<any>;

export type SuccessOf<R> = R extends Success<infer S> ? S : never;

export type FailureOf<R> = R extends Failure<infer F> ? F : never;

export function Success<S>(s: S): Success<S> {
	return {
		_kind: 'Success',
		value: s,
	};
}

export function Failure<const F extends TaggedFailure>(f: F): Failure<F>;
export function Failure<const T extends string, Fields extends object = {}>(
	definition: TaggedFailureDefinition<T, Fields>,
	fields: Fields,
): Failure<TaggedFailure<T> & Fields>;
export function Failure<const T extends string, Fields extends object = {}>(
	tag: T,
	fields: Fields,
): Failure<TaggedFailure<T> & Fields>;

export function Failure(
	...args:
		| [failure: TaggedFailure]
		| [definition: TaggedFailureDefinition<string, object>, fields: object]
		| [tag: string, fields: object]
): Failure<TaggedFailure> {
	if (args.length === 1) {
		const [failure] = args;
		return {
			_kind: 'Failure',
			_tag: failure._tag,
			failure,
		};
	}

	if (typeof args[0] === 'string') {
		const [tag, fields] = args;
		const failure = createTaggedFailure(tag, fields);

		return {
			_kind: 'Failure',
			_tag: failure._tag,
			failure,
		};
	}

	const [definition, fields] = args;
	return {
		_kind: 'Failure',
		_tag: definition._tag,
		failure: definition.make(fields),
	};
}

export function isResult<R extends AnyResult>(r: unknown): r is R {
	if (r === null || typeof r !== 'object') return false;
	if (!('_kind' in r)) return false;

	if (r._kind === 'Success') {
		return 'value' in r;
	}

	if (r._kind === 'Failure') {
		if (!('_tag' in r) || !('failure' in r)) return false;
		if (typeof r._tag !== 'string') return false;
		if (r.failure === null || typeof r.failure !== 'object') return false;
		if (!('_tag' in r.failure)) return false;

		return (r.failure as { readonly _tag: unknown })._tag === r._tag;
	}

	return false;
}

export function isSuccess<R extends AnyResult>(r: unknown): r is R & Success<SuccessOf<R>> {
	if (!isResult(r)) return false;
	return r._kind === 'Success';
}

export function isFailure<R extends AnyResult>(r: unknown): r is Failure<FailureOf<R>> {
	if (!isResult(r)) return false;
	return r._kind === 'Failure' && '_tag' in r && r._tag === r.failure._tag;
}

export function createTaggedFailure<const T extends string, Fields extends object = {}>(
	tag: T,
	fields: Fields,
): TaggedFailure<T> & Fields {
	return { _tag: tag, ...fields };
}

export const Result = {
	Success,
	Failure,
	isResult,
	isSuccess,
	isFailure,
	createTaggedFailure,
};
