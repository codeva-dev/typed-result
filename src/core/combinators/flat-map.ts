import {
	isFailure,
	isSuccess,
	type AnyResult,
	type FailureOf,
	type InferFailureByTag,
	type InferFailureByTags,
	type InferFailureTag,
	type Result,
	type SuccessOf,
} from '../result';

export function flatMapSuccess<R extends AnyResult, NextR extends AnyResult>(
	r: R,
	fn: (s: SuccessOf<R>) => NextR,
): Result<SuccessOf<NextR>, FailureOf<NextR> | FailureOf<R>> {
	if (isSuccess(r)) {
		return fn(r.value);
	}
	return r;
}

export function flatMapFailure<R extends AnyResult, NextR extends AnyResult>(
	r: R,
	fn: (f: FailureOf<R>) => NextR,
): Result<SuccessOf<R> | SuccessOf<NextR>, FailureOf<NextR>> {
	if (isFailure(r)) {
		return fn(r.failure);
	}
	return r;
}

export function flatMapFailureTag<R extends AnyResult, Tag extends InferFailureTag<R>, NextR extends AnyResult>(
	r: R,
	tag: Tag,
	fn: (f: InferFailureByTag<R, Tag>) => NextR,
): Result<SuccessOf<R> | SuccessOf<NextR>, FailureOf<NextR> | Exclude<FailureOf<R>, InferFailureByTag<R, Tag>>> {
	if (isFailure(r) && r.failure._tag === tag) {
		return fn(r.failure as InferFailureByTag<R, Tag>);
	}
	return r;
}

export function flatMapFailureTags<
	R extends AnyResult,
	const Tags extends ReadonlyArray<InferFailureTag<R>>,
	NextR extends AnyResult,
>(
	r: R,
	tags: Tags,
	fn: (f: InferFailureByTags<R, Tags>) => NextR,
): Result<SuccessOf<R> | SuccessOf<NextR>, FailureOf<NextR> | Exclude<FailureOf<R>, InferFailureByTags<R, Tags>>> {
	if (isFailure(r) && (tags as readonly string[]).includes(r.failure._tag)) {
		return fn(r.failure as InferFailureByTags<R, Tags>);
	}
	return r;
}
