import { type ReactNode } from 'react';
import {
	Result,
	type AnyResult,
	type FailureType,
	type FailureOf,
	type SuccessType,
	type SuccessOf,
	type TaggedFailure,
} from './index';

export type UseResultReturn<R extends AnyResult> =
	| {
			readonly channel: 'success';
			readonly data: SuccessOf<R>;
			readonly failure: undefined;
			readonly failureTag: undefined;
			readonly isFailure: false;
			readonly isSuccess: true;
			readonly result: Extract<R, SuccessType<unknown>>;
	  }
	| {
			readonly channel: 'failure';
			readonly data: undefined;
			readonly failure: FailureOf<R>;
			readonly failureTag: FailureOf<R>['_tag'];
			readonly isFailure: true;
			readonly isSuccess: false;
			readonly result: Extract<R, FailureType<TaggedFailure>>;
	  };

export function useResult<R extends AnyResult>(result: R): UseResultReturn<R> {
	if (Result.isSuccess(result)) {
		return {
			channel: 'success',
			data: result.value as SuccessOf<R>,
			failure: undefined,
			failureTag: undefined,
			isFailure: false,
			isSuccess: true,
			result: result as Extract<R, SuccessType<unknown>>,
		};
	}

	return {
		channel: 'failure',
		data: undefined,
		failure: result.failure as FailureOf<R>,
		failureTag: result.failure._tag as FailureOf<R>['_tag'],
		isFailure: true,
		isSuccess: false,
		result: result as Extract<R, FailureType<TaggedFailure>>,
	};
}

export type MatchProps<R extends AnyResult> = {
	readonly result: R;
	readonly onSuccess: (success: SuccessOf<R>) => ReactNode;
	readonly onFailure: (failure: FailureOf<R>) => ReactNode;
	readonly onInvalid?: (value: unknown) => ReactNode;
	readonly throwOnInvalid?: boolean;
};

export function Match<R extends AnyResult>(props: MatchProps<R>): ReactNode {
	if (Result.isResult(props.result)) {
		if (Result.isSuccess(props.result)) {
			return props.onSuccess(props.result.value as SuccessOf<R>);
		}

		if (Result.isFailure(props.result)) {
			return props.onFailure(props.result.failure as FailureOf<R>);
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
