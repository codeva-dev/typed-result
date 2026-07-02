import { Result as CoreResult, Success, type AnyResult } from '../core';

export type ResultDecoder<R extends AnyResult> = {
	readonly decode: (value: unknown) => R;
};

export type ResultExtractor = (error: unknown) => AnyResult | undefined;

export type TanStackResultState = {
	readonly data?: unknown;
	readonly error?: unknown;
};

export type ResultAdapterOptions<R extends AnyResult> = {
	readonly schema: ResultDecoder<R>;
	readonly extractErrorResult?: ResultExtractor;
};

export type ResultStateOptions<R extends AnyResult> = TanStackResultState & ResultAdapterOptions<R>;

export const resultErrorExtractor: ResultExtractor = (error) => {
	if (CoreResult.isResult(error)) {
		return error;
	}

	return undefined;
};

export const dataPropertyResultExtractor: ResultExtractor = (error) => {
	if (error === null || typeof error !== 'object' || !('data' in error)) {
		return undefined;
	}

	const data = (error as { readonly data: unknown }).data;
	if (CoreResult.isResult(data)) {
		return data;
	}

	return undefined;
};

export function chainExtractors(...extractors: readonly ResultExtractor[]): ResultExtractor {
	return (error) => {
		for (const extractor of extractors) {
			const result = extractor(error);
			if (result !== undefined) {
				return result;
			}
		}

		return undefined;
	};
}

export const defaultErrorResultExtractor = chainExtractors(resultErrorExtractor, dataPropertyResultExtractor);

function hasValue(value: unknown): boolean {
	return value !== undefined;
}

function hasError(error: unknown): boolean {
	return error !== undefined && error !== null;
}

export function resultFromTanStackState<R extends AnyResult>({
	data,
	error,
	schema,
	extractErrorResult = defaultErrorResultExtractor,
}: ResultStateOptions<R>): R | undefined {
	if (hasError(error)) {
		const extractedResult = extractErrorResult(error);
		if (extractedResult !== undefined) {
			return schema.decode(extractedResult);
		}

		throw error;
	}

	if (!hasValue(data)) {
		return undefined;
	}

	if (CoreResult.isResult(data)) {
		return schema.decode(data);
	}

	return schema.decode(Success(data));
}

export function resultFromQueryState<R extends AnyResult>(options: ResultStateOptions<R>): R | undefined {
	return resultFromTanStackState(options);
}

export function resultFromMutationState<R extends AnyResult>(options: ResultStateOptions<R>): R | undefined {
	return resultFromTanStackState(options);
}

export function createResultAdapter<R extends AnyResult>({
	schema,
	extractErrorResult = defaultErrorResultExtractor,
}: ResultAdapterOptions<R>) {
	const fromState = (state: TanStackResultState): R | undefined =>
		resultFromTanStackState({
			...state,
			schema,
			extractErrorResult,
		});

	return {
		fromState,
		fromQueryState: fromState,
		fromMutationState: fromState,
	} as const;
}

export const Result = {
	...CoreResult,
	chainExtractors,
	createResultAdapter,
	dataPropertyResultExtractor,
	defaultErrorResultExtractor,
	resultErrorExtractor,
	resultFromMutationState,
	resultFromQueryState,
	resultFromTanStackState,
} as const;
