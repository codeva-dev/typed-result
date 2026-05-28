export class TypedResultDecodeError extends Error {
	readonly cause: unknown;

	constructor(message: string, options: { readonly cause?: unknown } = {}) {
		super(message);
		this.name = 'TypedResultDecodeError';
		this.cause = options.cause;
	}
}

export class TypedResultEncodeError extends Error {
	readonly cause: unknown;

	constructor(message: string, options: { readonly cause?: unknown } = {}) {
		super(message);
		this.name = 'TypedResultEncodeError';
		this.cause = options.cause;
	}
}
