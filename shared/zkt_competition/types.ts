export interface ZktCompResultPayload {
	roundId: string;
	resultId: string;
	userId: string;
}

export interface ZktCompRoundStatusPayload {
	roundId: string;
	status: string;
}

export interface ZktCompStatusPayload {
	competitionId: string;
	status: string;
}

export interface ZktCompRegistrationPayload {
	competitionId: string;
	registrationId: string;
	status: string;
}
