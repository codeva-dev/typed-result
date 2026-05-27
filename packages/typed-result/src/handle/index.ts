import { flatMapFailure, flatMapSuccess } from '../combinators/flat-map';
import { match, matchFailureTag, matchFailureTags } from '../combinators/match';
import { tapFailure, tapSuccess } from '../combinators/tap';
import { unwrap, unwrapOr, unwrapOrElse, unwrapOrNull, unwrapOrUndefined } from '../combinators/unwrap';
import type { AnyResult, FailureOf, InferFailureByTag, InferFailureByTags, InferFailureTag, Result, SuccessOf } from '../result';

export type Handle<R extends AnyResult> = {
	onSuccess: <NextR extends AnyResult>(
		fn: (success: SuccessOf<R>) => NextR,
	) => Handle<Result<SuccessOf<NextR>, FailureOf<R> | FailureOf<NextR>>>;

	onFailure: <NextR extends AnyResult>(
		fn: (failure: FailureOf<R>) => NextR,
	) => Handle<Result<SuccessOf<R> | SuccessOf<NextR>, FailureOf<NextR>>>;
	tapSuccess: (fn: (success: SuccessOf<R>) => void) => Handle<R>;
	tapFailure: (fn: (failure: FailureOf<R>) => void) => Handle<R>;
	tap: (fn: (result: R) => void) => Handle<R>;

	result: () => R;
	unwrap: () => SuccessOf<R>;
	unwrapOr: <T>(defaultValue: T) => SuccessOf<R> | T;
	unwrapOrNull: () => SuccessOf<R> | null;
	unwrapOrUndefined: () => SuccessOf<R> | undefined;
	unwrapOrElse: <T>(fn: (failure: FailureOf<R>) => T) => SuccessOf<R> | T;
	match: <SuccessT, FailureT>(handlers: {
		onSuccess: (success: SuccessOf<R>) => SuccessT;
		onFailure: (failure: FailureOf<R>) => FailureT;
	}) => SuccessT | FailureT;
	matchFailureTag: <
		Tag extends InferFailureTag<R>,
		Handlers extends {
			onMatch: (failure: InferFailureByTag<R, Tag>) => unknown;
			orElse: (result: R) => unknown;
		},
	>(
		tag: Tag,
		handlers: Handlers,
	) => ReturnType<Handlers['onMatch']> | ReturnType<Handlers['orElse']>;
	matchFailureTags: <
		const Tags extends ReadonlyArray<InferFailureTag<R>>,
		Handlers extends {
			onMatch: (failure: InferFailureByTags<R, Tags>) => unknown;
			orElse: (result: R) => unknown;
		},
	>(
		tags: Tags,
		handlers: Handlers,
	) => ReturnType<Handlers['onMatch']> | ReturnType<Handlers['orElse']>;
};

export function handle<R extends AnyResult>(result: R): Handle<R> {
	return {
		onSuccess(fn) {
			return handle(flatMapSuccess(result, fn));
		},

		onFailure(fn) {
			return handle(flatMapFailure(result, fn));
		},

		tapSuccess(fn) {
			tapSuccess(result, fn);
			return this;
		},

		tapFailure(fn) {
			tapFailure(result, fn);
			return this;
		},

		tap(fn) {
			fn(result);
			return this;
		},

		result() {
			return result;
		},

		unwrap() {
			return unwrap(result);
		},

		unwrapOr(defaultValue) {
			return unwrapOr(result, defaultValue);
		},

		unwrapOrNull() {
			return unwrapOrNull(result);
		},

		unwrapOrUndefined() {
			return unwrapOrUndefined(result);
		},

		unwrapOrElse(fn) {
			return unwrapOrElse(result, fn);
		},

		match(handlers) {
			return match(result, handlers);
		},

		matchFailureTag(tag, handlers) {
			return matchFailureTag(result, tag, handlers);
		},

		matchFailureTags(tags, handlers) {
			return matchFailureTags(result, tags, handlers);
		},
	};
}
