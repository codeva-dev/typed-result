import {
	useMutation,
	useQuery,
	type QueryClient,
	type QueryKey,
	type UseMutationOptions,
	type UseMutationResult,
	type UseQueryOptions,
	type UseQueryResult,
} from '@tanstack/react-query';
import { Result as CoreResult, type AnyResult } from '../core';
import { useResult, type UseResultReturn } from '../react';
import {
	Result as TanStackResult,
	type ResultDecoder,
	resultFromMutationState,
	resultFromQueryState,
} from './index';

export type UseResultQueryOptions<
	R extends AnyResult,
	TQueryFnData = unknown,
	TError = Error,
	TQueryKey extends QueryKey = QueryKey,
> = Omit<UseQueryOptions<TQueryFnData, TError, TQueryFnData, TQueryKey>, 'select'> & {
	readonly schema: ResultDecoder<R>;
};

type NoResultState = {
	readonly channel: undefined;
	readonly data: undefined;
	readonly failure: undefined;
	readonly failureTag: undefined;
	readonly hasResult: false;
	readonly isFailure: false;
	readonly isSuccess: false;
	readonly result: undefined;
	readonly state: 'pending';
};

type ErrorResultState = Omit<NoResultState, 'state'> & {
	readonly state: 'error';
};

type SuccessResultState<R extends AnyResult> = Extract<UseResultReturn<R>, { readonly isSuccess: true }> & {
	readonly hasResult: true;
	readonly state: 'success';
};

type FailureResultState<R extends AnyResult> = Extract<UseResultReturn<R>, { readonly isFailure: true }> & {
	readonly hasResult: true;
	readonly state: 'failure';
};

type SuccessFailureResultState<R extends AnyResult> = SuccessResultState<R> | FailureResultState<R>;

type ResultState<R extends AnyResult> = SuccessFailureResultState<R> | ErrorResultState | NoResultState;

const noResultState: NoResultState = {
	channel: undefined,
	data: undefined,
	failure: undefined,
	failureTag: undefined,
	hasResult: false,
	isFailure: false,
	isSuccess: false,
	result: undefined,
	state: 'pending',
};

const errorResultState: ErrorResultState = {
	...noResultState,
	state: 'error',
};

function toResultState<R extends AnyResult>(result: UseResultReturn<R> | undefined): ResultState<R> {
	if (result === undefined) {
		return noResultState;
	}

	if (result.isSuccess) {
		return {
			...result,
			hasResult: true,
			state: 'success',
		} as SuccessResultState<R>;
	}

	return {
		...result,
		hasResult: true,
		state: 'failure',
	} as FailureResultState<R>;
}

export type UseResultQueryReturn<R extends AnyResult, TQueryFnData = unknown, TError = Error> = ResultState<R> & {
	readonly isFetching: UseQueryResult<TQueryFnData, TError>['isFetching'];
	readonly isPending: UseQueryResult<TQueryFnData, TError>['isPending'];
	readonly query: UseQueryResult<TQueryFnData, TError>;
} & (
		| {
				readonly error: TError;
				readonly isError: true;
				readonly state: 'error';
		  }
		| {
				readonly error: UseQueryResult<TQueryFnData, TError>['error'];
				readonly isError: false;
				readonly state: 'pending' | 'success' | 'failure';
		  }
	);

export type UseResultMutationOptions<
	R extends AnyResult,
	TMutationFnData = unknown,
	TError = Error,
	TVariables = void,
	TOnMutateResult = unknown,
> = UseMutationOptions<TMutationFnData, TError, TVariables, TOnMutateResult> & {
	readonly schema: ResultDecoder<R>;
};

export type UseResultMutationReturn<
	R extends AnyResult,
	TMutationFnData = unknown,
	TError = Error,
	TVariables = void,
	TOnMutateResult = unknown,
> = ResultState<R> & {
	readonly isPending: UseMutationResult<TMutationFnData, TError, TVariables, TOnMutateResult>['isPending'];
	readonly mutation: UseMutationResult<TMutationFnData, TError, TVariables, TOnMutateResult>;
	readonly mutate: UseMutationResult<TMutationFnData, TError, TVariables, TOnMutateResult>['mutate'];
	readonly mutateAsync: UseMutationResult<TMutationFnData, TError, TVariables, TOnMutateResult>['mutateAsync'];
} & (
		| {
				readonly error: TError;
				readonly isError: true;
				readonly state: 'error';
		  }
		| {
				readonly error: UseMutationResult<TMutationFnData, TError, TVariables, TOnMutateResult>['error'];
				readonly isError: false;
				readonly state: 'pending' | 'success' | 'failure';
		  }
	);

export function useResultQuery<
	R extends AnyResult,
	TQueryFnData = unknown,
	TError = Error,
	TQueryKey extends QueryKey = QueryKey,
>(
	{ schema, ...options }: UseResultQueryOptions<R, TQueryFnData, TError, TQueryKey>,
	queryClient?: QueryClient,
): UseResultQueryReturn<R, TQueryFnData, TError> {
	const query = useQuery<TQueryFnData, TError, TQueryFnData, TQueryKey>(options, queryClient);
	const resultEnvelope = query.isSuccess ? resultFromQueryState({ data: query.data, schema }) : undefined;
	const result = useResult(resultEnvelope);
	const resultState = query.isError ? errorResultState : toResultState(result);

	return {
		...resultState,
		error: query.isError ? (query.error as TError) : query.error,
		isError: query.isError,
		isFetching: query.isFetching,
		isPending: query.isPending,
		query,
	} as UseResultQueryReturn<R, TQueryFnData, TError>;
}

export function useResultMutation<
	R extends AnyResult,
	TMutationFnData = unknown,
	TError = Error,
	TVariables = void,
	TOnMutateResult = unknown,
>(
	{
		schema,
		...options
	}: UseResultMutationOptions<R, TMutationFnData, TError, TVariables, TOnMutateResult>,
	queryClient?: QueryClient,
): UseResultMutationReturn<R, TMutationFnData, TError, TVariables, TOnMutateResult> {
	const mutation = useMutation<TMutationFnData, TError, TVariables, TOnMutateResult>(options, queryClient);
	const resultEnvelope = mutation.isSuccess ? resultFromMutationState({ data: mutation.data, schema }) : undefined;
	const result = useResult(resultEnvelope);
	const resultState = mutation.isError ? errorResultState : toResultState(result);

	return {
		...resultState,
		error: mutation.isError ? (mutation.error as TError) : mutation.error,
		isError: mutation.isError,
		isPending: mutation.isPending,
		mutation,
		mutate: mutation.mutate,
		mutateAsync: mutation.mutateAsync,
	} as UseResultMutationReturn<R, TMutationFnData, TError, TVariables, TOnMutateResult>;
}

export const Result = {
	...CoreResult,
	...TanStackResult,
	useResultMutation,
	useResultQuery,
} as const;
