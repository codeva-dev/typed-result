import { type ReactNode } from 'react';
import {
	Result,
	type AnyResult,
	type FailureType,
	type FailureOf,
	type SuccessType,
	type SuccessOf,
	type TaggedFailure,
} from '../core/index';

export type UseResultReturn<R extends AnyResult> =
	([SuccessOf<R>] extends [never]
		? never
		: {
			readonly channel: 'success';
			readonly data: SuccessOf<R>;
			readonly failure: undefined;
			readonly failureTag: undefined;
			readonly isFailure: false;
			readonly isSuccess: true;
			readonly result: Extract<R, SuccessType<unknown>>;
		  }) |
	([FailureOf<R>] extends [never]
		? never
		: {
			readonly channel: 'failure';
			readonly data: undefined;
			readonly failure: FailureOf<R>;
			readonly failureTag: FailureOf<R>['_tag'];
			readonly isFailure: true;
			readonly isSuccess: false;
			readonly result: Extract<R, FailureType<TaggedFailure>>;
		  });

export function useResult<R extends AnyResult>(result: R): UseResultReturn<R>;
export function useResult(result: undefined): undefined;
export function useResult<R extends AnyResult>(result: R | undefined): UseResultReturn<R> | undefined;
export function useResult<R extends AnyResult>(result: R | undefined): UseResultReturn<R> | undefined {
	if (result === undefined) {
		return undefined;
	}

	if (Result.isSuccess(result)) {
		return {
			channel: 'success',
			data: result.value as SuccessOf<R>,
			failure: undefined,
			failureTag: undefined,
			isFailure: false,
			isSuccess: true,
			result: result as Extract<R, SuccessType<unknown>>,
		} as UseResultReturn<R>;
	}

	return {
		channel: 'failure',
		data: undefined,
		failure: result.failure as FailureOf<R>,
		failureTag: result.failure._tag as FailureOf<R>['_tag'],
		isFailure: true,
		isSuccess: false,
		result: result as Extract<R, FailureType<TaggedFailure>>,
	} as UseResultReturn<R>;
}

export type MatchProps<R extends AnyResult> = {
	readonly result: R;
	readonly onInvalid?: (value: unknown) => ReactNode;
	readonly throwOnInvalid?: boolean;
} & ([SuccessOf<R>] extends [never]
	? {
			readonly onSuccess?: never;
	  }
	: {
			readonly onSuccess: (success: SuccessOf<R>) => ReactNode;
	  }) &
	([FailureOf<R>] extends [never]
	? {
			readonly onFailure?: never;
	  }
	: {
			readonly onFailure: (failure: FailureOf<R>) => ReactNode;
	  });

type MatchUnknownProps = {
	readonly result: unknown;
	readonly onSuccess: (success: unknown) => ReactNode;
	readonly onFailure: (failure: TaggedFailure) => ReactNode;
	readonly onInvalid?: (value: unknown) => ReactNode;
	readonly throwOnInvalid?: boolean;
};

export function Match<R>(
	props: [R] extends [AnyResult] ? MatchProps<R> : MatchUnknownProps & { readonly result: R },
): ReactNode;
export function Match<R extends AnyResult>(props: MatchProps<R> | MatchUnknownProps): ReactNode {
	if (Result.isResult(props.result)) {
		if (Result.isSuccess(props.result)) {
			if (props.onSuccess) {
				return props.onSuccess(props.result.value as SuccessOf<R>);
			}

			throw new TypeError('Result.Match requires onSuccess when result is Success');
		}

		if (Result.isFailure(props.result)) {
			if (props.onFailure) {
				return props.onFailure(props.result.failure as FailureOf<R>);
			}

			throw new TypeError('Result.Match requires onFailure when result is Failure');
		}
	}

	if (props.throwOnInvalid === true) {
		throw new TypeError('Result.Match requires a Result value, either Success or Failure');
	}

	if (props.onInvalid) {
		return props.onInvalid(props.result);
	}

	throw new TypeError('Result.Match requires a Result value, either Success or Failure');
}

export type MatchFailureTagHandlers<F extends TaggedFailure> = {
	readonly [Tag in F['_tag']]?: (failure: Extract<F, { readonly _tag: Tag }>) => ReactNode;
} & {
	readonly default?: (failure: F) => ReactNode;
};

export type MatchFailureTagProps<F extends TaggedFailure> = {
	readonly failure: F;
	readonly tags: MatchFailureTagHandlers<F>;
};

export type MatchFailureTagsProps<F extends TaggedFailure> = MatchFailureTagProps<F>;

export function MatchFailureTags<F extends TaggedFailure>(props: MatchFailureTagsProps<F>): ReactNode {
	const handler = props.tags[props.failure._tag as F['_tag']];

	if (handler) {
		return handler(props.failure as never);
	}

	if (props.tags.default) {
		return props.tags.default(props.failure);
	}

	return null;
}

export function MatchFailureTag<F extends TaggedFailure>(props: MatchFailureTagProps<F>): ReactNode {
	return MatchFailureTags(props);
}
