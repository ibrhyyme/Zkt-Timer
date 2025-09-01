import React from 'react';
import './AdminUsers.scss';
import {gqlQueryTyped} from '../../api';
import {AdminUserSearchDocument} from '../../../@types/generated/graphql';
import {UserAccount} from '../../../../server/schemas/UserAccount.schema';
import PaginatedList from '../../common/paginated_list/PaginatedList';
import ProfileRow from '../../community/profile_row/ProfileRow';
import {PaginationArgsInput} from '../../../../server/schemas/Pagination.schema';
import Input from '../../common/inputs/input/Input';
import {useInput} from '../../../util/hooks/useInput';
import {gql} from '@apollo/client';

export default function AdminUsers() {
	const [query, setQuery] = useInput('');

	const ADMIN_USER_SEARCH_QUERY = gql`
		query AdminUserSearch($pageArgs: PaginationArgsInput) {
			adminUserSearch(pageArgs: $pageArgs) {
				hasMore
				total
				items {
					id
					username
					email
					verified
					created_at
					banned_forever
					is_pro
					banned_until
					admin
					mod
					offline_hash
					pro_status
					integrations {
						id
						service_name
					}
					profile {
						pfp_image {
							id
							user_id
							storage_path
						}
					}
				}
			}
		}
	`;

	async function fetchData(pageArgs: PaginationArgsInput) {
		try {
			const res = await gqlQueryTyped(
				ADMIN_USER_SEARCH_QUERY,
				{
					pageArgs,
				},
				{
					fetchPolicy: 'network-only',
				}
			);

			// Handle null response from server
			if (!res.data.adminUserSearch) {
				console.error('AdminUserSearch returned null response');
				return {
					items: [],
					total: 0,
					hasMore: false
				};
			}

			return res.data.adminUserSearch as any;
		} catch (error) {
			console.error('Error fetching admin users:', error);
			return {
				items: [],
				total: 0,
				hasMore: false
			};
		}
	}

	return (
		<div className="w-full p-2">
			<div className="w-full max-w-4xl mx-auto">
				<div>
					<Input value={query} onChange={setQuery} />
				</div>
				<PaginatedList<any>
					searchQuery={query}
					fetchData={fetchData}
					getItemRow={(user) => {
						return <ProfileRow hideDropdown user={user} key={user.id} />;
					}}
				/>
			</div>
		</div>
	);
}
