import {
	Failure,
	isFailure,
	isSuccess,
	Success,
	type AnyResult,
	type FailureOf,
	type InferFailureByTag,
	type InferFailureByTags,
	type InferFailureTag,
	type Result,
	type SuccessOf,
	type TaggedFailure,
} from '../result';

export function mapSuccess<R extends AnyResult, NextS>(
	r: R,
	fn: (s: SuccessOf<R>) => NextS,
): Result<NextS, FailureOf<R>> {
	if (isSuccess(r)) {
		return Success(fn(r.value));
	}
	return r;
}

export function mapFailure<R extends AnyResult, NextF extends TaggedFailure>(
	r: R,
	fn: (f: FailureOf<R>) => NextF,
): Result<SuccessOf<R>, NextF> {
	if (isFailure(r)) {
		return Failure(fn(r.failure));
	}
	return r;
}

export function mapFailureTag<R extends AnyResult, Tag extends InferFailureTag<R>, NextF extends TaggedFailure>(
	r: R,
	tag: Tag,
	fn: (f: InferFailureByTag<R, Tag>) => NextF,
): Result<SuccessOf<R>, NextF | Exclude<FailureOf<R>, InferFailureByTag<R, Tag>>> {
	if (isFailure(r) && r.failure._tag === tag) {
		return Failure(fn(r.failure));
	}
	return r;
}

export function mapFailureTags<
	R extends AnyResult,
	const Tags extends ReadonlyArray<InferFailureTag<R>>,
	NextF extends TaggedFailure,
>(
	r: R,
	tags: Tags,
	fn: (f: InferFailureByTags<R, Tags>) => NextF,
): Result<SuccessOf<R>, NextF | Exclude<FailureOf<R>, InferFailureByTags<R, Tags>>> {
	if (isFailure(r) && (tags as readonly string[]).includes(r.failure._tag)) {
		return Failure(fn(r.failure as InferFailureByTags<R, Tags>));
	}
	return r;
}
