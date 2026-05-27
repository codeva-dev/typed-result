import { isFailure, isSuccess, type AnyResult, type FailureOf, type SuccessOf } from '../result';

export function tapSuccess<R extends AnyResult>(r: R, fn: (s: SuccessOf<R>) => void): R {
	if (isSuccess(r)) {
		fn(r.value);
	}
	return r;
}

export function tapFailure<R extends AnyResult>(r: R, fn: (f: FailureOf<R>) => void): R {
	if (isFailure(r)) {
		fn(r.failure);
	}
	return r;
}

export function tap<R extends AnyResult>(r: R, fn: (v: SuccessOf<R> | FailureOf<R>) => void): R {
	if (isSuccess(r)) {
		tapSuccess(r, fn);
	}
	if (isFailure(r)) {
		tapFailure(r, fn);
	}
	return r;
}
