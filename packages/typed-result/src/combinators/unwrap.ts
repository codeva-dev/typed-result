import { isSuccess, type AnyResult, type FailureOf, type SuccessOf } from '../result';

export class ResultUnwrapError extends Error {
	readonly result: AnyResult;

	constructor(result: AnyResult) {
		super(`Expected Success, got ${result._kind}`);
		this.name = 'ResultUnwrapError';
		this.result = result;
	}
}

export function unwrap<R extends AnyResult>(result: R): SuccessOf<R> {
	if (isSuccess(result)) {
		return result.value as SuccessOf<R>;
	}

	throw new ResultUnwrapError(result);
}

export function unwrapOr<R extends AnyResult, FallbackS>(r: R, defaultValue: FallbackS): SuccessOf<R> | FallbackS {
	if (isSuccess(r)) {
		return r.value as SuccessOf<R>;
	}
	return defaultValue;
}

export function unwrapOrNull<R extends AnyResult>(r: R): SuccessOf<R> | null {
	return unwrapOr(r, null);
}

export function unwrapOrUndefined<R extends AnyResult>(r: R): SuccessOf<R> | undefined {
	return unwrapOr(r, undefined);
}

export function unwrapOrElse<R extends AnyResult, FallbackS>(
	r: R,
	fn: (f: FailureOf<R>) => FallbackS,
): SuccessOf<R> | FallbackS {
	if (isSuccess(r)) {
		return r.value as SuccessOf<R>;
	}
	return fn(r.failure);
}
