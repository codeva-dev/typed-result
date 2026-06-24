import { flatMapFailure, flatMapFailureTag, flatMapFailureTags, flatMapSuccess } from './combinators/flat-map';
import { mapFailure, mapFailureTag, mapFailureTags, mapSuccess } from './combinators/map';
import { match, matchFailureTag, matchFailureTags } from './combinators/match';
import { tap, tapFailure, tapSuccess } from './combinators/tap';
import { unwrap, unwrapOr, unwrapOrElse, unwrapOrNull, unwrapOrUndefined } from './combinators/unwrap';
import { handle } from './handle/index';
import { Failure, Success, createTaggedFailure, defineTaggedFailure, isFailure, isResult, isSuccess } from './result';

export { flatMapFailure, flatMapFailureTag, flatMapFailureTags, flatMapSuccess } from './combinators/flat-map';
export { mapFailure, mapFailureTag, mapFailureTags, mapSuccess } from './combinators/map';
export { match, matchFailureTag, matchFailureTags, type MatchHandlers } from './combinators/match';
export { tap, tapFailure, tapSuccess } from './combinators/tap';
export {
	ResultUnwrapError,
	unwrap,
	unwrapOr,
	unwrapOrElse,
	unwrapOrNull,
	unwrapOrUndefined,
} from './combinators/unwrap';
export { handle, type Handle } from './handle/index';
export { Failure, Success, createTaggedFailure, defineTaggedFailure, isFailure, isResult, isSuccess } from './result';

export type {
	AnyResult,
	Failure as FailureType,
	FailureOf,
	InferFailureByTag,
	InferFailureByTags,
	InferFailureTag,
	Result as ResultType,
	Success as SuccessType,
	SuccessOf,
	TaggedFailure,
	TaggedFailureDefinition,
} from './result';

export const Result = {
	Failure,
	Success,
	createTaggedFailure,
	defineTaggedFailure,
	flatMapFailure,
	flatMapFailureTag,
	flatMapFailureTags,
	flatMapSuccess,
	handle,
	isFailure,
	isResult,
	isSuccess,
	mapFailure,
	mapFailureTag,
	mapFailureTags,
	mapSuccess,
	match,
	matchFailureTag,
	matchFailureTags,
	tap,
	tapFailure,
	tapSuccess,
	unwrap,
	unwrapOr,
	unwrapOrElse,
	unwrapOrNull,
	unwrapOrUndefined,
} as const;
