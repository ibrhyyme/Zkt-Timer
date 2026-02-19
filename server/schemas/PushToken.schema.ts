import { ObjectType, Field, InputType } from 'type-graphql';

@ObjectType()
export class PushTokenResult {
	@Field()
	success: boolean;
}

@InputType()
export class RegisterPushTokenInput {
	@Field()
	token: string;

	@Field()
	platform: string; // WEB, ANDROID, IOS
}
