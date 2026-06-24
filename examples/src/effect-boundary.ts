import { Result, unsafe_Schema as ResultSchema } from '@codeva-dev/typed-result/effect';
import { Effect, Runtime, Schema } from 'effect';

interface Meeting {
	readonly id: string;
	readonly title: string;
}

class MeetingAlreadyRequested extends Schema.TaggedError<MeetingAlreadyRequested>()('MeetingAlreadyRequested', {
	message: Schema.String,
	requestId: Schema.String,
}) {}

const requestMeeting = (requestId: string): Effect.Effect<Meeting, MeetingAlreadyRequested, never> =>
	Effect.gen(function* () {
		if (requestId === 'existing-request') {
			return yield* Effect.fail(
				new MeetingAlreadyRequested({
					message: 'Meeting was already requested',
					requestId,
				}),
			);
		}

		return {
			id: 'meeting-1',
			title: 'Planning',
		};
	});

const exit = await Runtime.runPromiseExit(Runtime.defaultRuntime)(requestMeeting('existing-request'));

export const result = Result.fromExit(exit, {
	onError: {
		MeetingAlreadyRequested: ResultSchema.fromTaggedError(MeetingAlreadyRequested),
	},
});

export const message = Result.match(result, {
	onSuccess: (meeting) => `Created meeting ${meeting.title}`,
	onFailure: (failure) => failure.message,
});
