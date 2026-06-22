import {
	isFailure,
	isSuccess,
	type AnyResult,
	type InferFailureByTags,
	type FailureOf,
	type InferFailureByTag,
	type InferFailureTag,
	type SuccessOf,
} from '../result';

export type MatchHandlers<R extends AnyResult, S, F> = {
} & ([SuccessOf<R>] extends [never]
	? {
			onSuccess?: never;
	  }
	: {
			onSuccess: (s: SuccessOf<R>) => S;
	  }) &
	([FailureOf<R>] extends [never]
		? {
				onFailure?: never;
		  }
		: {
				onFailure: (f: FailureOf<R>) => F;
		  });

export type MatchReturn<R extends AnyResult, S, F> = [SuccessOf<R>] extends [never]
	? F
	: [FailureOf<R>] extends [never]
		? S
		: S | F;

export function match<R extends AnyResult, S, F>(r: R, handlers: MatchHandlers<R, S, F>): MatchReturn<R, S, F> {
	if (isSuccess(r)) {
		if (handlers.onSuccess) {
			return handlers.onSuccess(r.value) as MatchReturn<R, S, F>;
		}

		throw new TypeError('Result.match requires onSuccess when result is Success');
	}
	if (isFailure(r)) {
		if (handlers.onFailure) {
			return handlers.onFailure(r.failure) as MatchReturn<R, S, F>;
		}

		throw new TypeError('Result.match requires onFailure when result is Failure');
	}
	throw new TypeError('Result.match requires a Result value, either Success or Failure');
}

export function matchFailureTag<
	R extends AnyResult,
	Tag extends InferFailureTag<R>,
	Handlers extends {
		onMatch: (f: InferFailureByTag<R, Tag>) => unknown;
		orElse: (r: R) => unknown;
	},
>(
	r: R,
	tag: Tag,
	handlers: Handlers,
): ReturnType<Handlers['onMatch']> | ReturnType<Handlers['orElse']> {
	if (isFailure(r) && r.failure._tag === tag) {
		return handlers.onMatch(r.failure as InferFailureByTag<R, Tag>) as ReturnType<Handlers['onMatch']>;
	}

	return handlers.orElse(r) as ReturnType<Handlers['orElse']>;
}

export function matchFailureTags<
	R extends AnyResult,
	const Tags extends ReadonlyArray<InferFailureTag<R>>,
	Handlers extends {
		onMatch: (f: InferFailureByTags<R, Tags>) => unknown;
		orElse: (r: R) => unknown;
	},
>(
	r: R,
	tags: Tags,
	handlers: Handlers,
): ReturnType<Handlers['onMatch']> | ReturnType<Handlers['orElse']> {
	if (isFailure(r) && (tags as readonly string[]).includes(r.failure._tag)) {
		return handlers.onMatch(r.failure as InferFailureByTags<R, Tags>) as ReturnType<Handlers['onMatch']>;
	}

	return handlers.orElse(r) as ReturnType<Handlers['orElse']>;
}
