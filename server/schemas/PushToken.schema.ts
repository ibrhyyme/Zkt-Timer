import { ObjectType, Field, InputType } from 'type-graphql';

@ObjectType()
export class PushTokenResult {
	@Field()
	success: boolean;
}

@ObjectType()
export class PushTokenInfo {
	@Field()
	platform: string;
}

@ObjectType()
export class AdminSendPushResult {
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
