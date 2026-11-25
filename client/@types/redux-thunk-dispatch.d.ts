import 'redux';

// The store runs redux-thunk, so dispatch also takes a thunk and returns what it
// returns. redux-thunk ships this as 'redux-thunk/extend-redux', but that file
// targets redux 4's `Dispatch<A>` and cannot merge with redux 3.7's `Dispatch<S>`.
// react-redux 9 types useDispatch() with redux's own Dispatch; @types/react-redux 7
// used to hand out Dispatch<any> instead, which hid this.
declare module 'redux' {
	export interface Dispatch<S> {
		<R>(thunk: (dispatch: Dispatch<S>, getState: () => S) => R): R;
	}
}
