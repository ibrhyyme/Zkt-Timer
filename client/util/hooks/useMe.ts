import {RootStateOrAny, useSelector} from 'react-redux';
import {UserAccount} from '../../../server/schemas/UserAccount.schema';

export function useMe(): UserAccount {
	// Select `me` itself, not the account slice. This hook sits in 70+ components,
	// layout App among them, so re-rendering on anything but a new `me` is expensive.
	return useSelector((store: RootStateOrAny) => store.account.me);
}
