const initialState = {
	me: null,
};

export default (state = initialState, action) => {
	switch (action.type) {
		case 'FORCE_OVERRIDE_ACCOUNT': {
			const {newState} = action.payload;
			return {
				...state,
				...newState,
			};
		}
		case 'SET_ME': {
			const {me} = action.payload;
			return {
				...state,
				me,
			};
		}

		default: {
			return {
				...initialState,
				...state,
			};
		}
	}
};
