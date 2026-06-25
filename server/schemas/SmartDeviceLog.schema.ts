import {Field, ObjectType, InputType, Int} from 'type-graphql';

/**
 * Smart cube / BLE timer connection telemetry event. Mirrors the SmartDeviceLog Prisma model.
 * `extra` is exposed as a JSON string (stringified server-side) to avoid a JSON-scalar dependency.
 */
@ObjectType()
export class SmartDeviceLog {
	@Field()
	id: string;

	@Field({nullable: true})
	user_email?: string;

	@Field()
	device_type: string;

	@Field({nullable: true})
	device_name?: string;

	@Field({nullable: true})
	hardware_name?: string;

	@Field({nullable: true})
	generation?: string;

	@Field()
	platform: string;

	@Field()
	event: string;

	@Field({nullable: true})
	reason?: string;

	@Field(() => Int, {nullable: true})
	solve_count?: number;

	@Field(() => Int, {nullable: true})
	last_serial?: number;

	@Field({nullable: true})
	extra?: string;

	@Field()
	created_at: Date;
}

/** Payload from the client telemetry logger. `extra` is a JSON string. */
@InputType()
export class LogSmartDeviceEventInput {
	@Field()
	device_type: string;

	@Field({nullable: true})
	device_name?: string;

	@Field({nullable: true})
	hardware_name?: string;

	@Field({nullable: true})
	generation?: string;

	@Field()
	platform: string;

	@Field()
	event: string;

	@Field({nullable: true})
	reason?: string;

	@Field(() => Int, {nullable: true})
	solve_count?: number;

	@Field(() => Int, {nullable: true})
	last_serial?: number;

	@Field({nullable: true})
	extra?: string;
}
