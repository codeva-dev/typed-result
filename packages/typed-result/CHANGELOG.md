# @codeva-dev/typed-result

## 1.1.0-alpha.6

### Patch Changes

- Omit `cause?: unknown` from Effect `fromTaggedError(...)` public failure DTOs so domain-kit default errors remain serializable at server boundaries.

## 1.1.0-alpha.5

### Patch Changes

- Allow Effect `fromTaggedError(...)` to wrap `Schema.TaggedError` classes exposed through narrower constructor types, including domain-kit `DomainError.Class(...)` errors.

## 1.1.0-alpha.4

### Patch Changes

- Refine Effect boundary conversion around explicit `Result.fromExit(exit, { onError })` whitelists, removing the alpha runtime helper surface and tightening strict Cause handling.

## 1.1.0-alpha.3

### Patch Changes

- Add higher-level Effect boundary helpers for converting typed failures to Result envelopes while letting defects escape.

## 1.1.0-alpha.2

### Patch Changes

- Make match-style helpers require only handlers for branches that can exist in the input result type.

## 1.1.0-alpha.0

### Minor Changes

- 582433f: Add experimental Zod and Effect Schema support under the `/zod` and `/effect` subpaths via `unsafe_Schema`.
