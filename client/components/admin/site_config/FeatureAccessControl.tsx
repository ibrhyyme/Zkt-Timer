import React, {useState, useRef, useEffect} from 'react';
import {gqlQuery, gqlMutateTyped} from '../../api';
import {UpdateSiteConfigDocument} from '../../../@types/generated/graphql';
import {setSiteConfigCache, SiteConfigData} from '../../../util/hooks/useSiteConfig';
import gql from 'graphql-tag';
import block from '../../../styles/bem';
import './FeatureAccessControl.scss';

const b = block('feature-access-control');

const ADMIN_USER_SEARCH = gql`
	query FeatureAccessUserSearch($pageArgs: PaginationArgsInput) {
		adminUserSearch(pageArgs: $pageArgs) {
			items {
				id
				username
			}
		}
	}
`;

interface OverrideUser {
	id?: string | null;
	username?: string | null;
}

interface OverrideEntry {
	feature?: string | null;
	mode?: string | null;
	users?: (OverrideUser | null)[] | null;
}

interface NormalizedUser {
	id: string;
	username: string;
}

interface Props {
	feature: string;
	currentOverride: OverrideEntry | null | undefined;
	onSaved: (updatedConfig: SiteConfigData) => void;
}

function normalizeUsers(users?: (OverrideUser | null)[] | null): NormalizedUser[] {
	return (users ?? [])
		.filter((u): u is OverrideUser => !!u?.id && !!u?.username)
		.map((u) => ({id: u.id!, username: u.username!}));
}

export default function FeatureAccessControl({feature, currentOverride, onSaved}: Props) {
	const [users, setUsers] = useState<NormalizedUser[]>(() => normalizeUsers(currentOverride?.users));
	const [saving, setSaving] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const [searchResults, setSearchResults] = useState<NormalizedUser[]>([]);
	const [searching, setSearching] = useState(false);
	const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		setUsers(normalizeUsers(currentOverride?.users));
	}, [currentOverride?.feature]);

	async function save(newUsers: NormalizedUser[]) {
		setSaving(true);
		try {
			const mode = newUsers.length > 0 ? 'INCLUDE' : 'ALL';
			const res = await gqlMutateTyped(UpdateSiteConfigDocument, {
				input: {
					featureOverrides: [{feature, mode, users: newUsers}],
				},
			});
			const updated = res?.data?.updateSiteConfig;
			if (updated) {
				setSiteConfigCache(updated as SiteConfigData);
				onSaved(updated as SiteConfigData);
			}
		} catch (err) {
			alert('Kayıt hatası: ' + (err as any)?.message);
		} finally {
			setSaving(false);
		}
	}

	function handleRemoveUser(userId: string) {
		const newUsers = users.filter((u) => u.id !== userId);
		setUsers(newUsers);
		save(newUsers);
	}

	async function handleAddUser(user: NormalizedUser) {
		if (users.some((u) => u.id === user.id)) return;
		const newUsers = [...users, user];
		setUsers(newUsers);
		setSearchQuery('');
		setSearchResults([]);
		save(newUsers);
	}

	function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
		const q = e.target.value;
		setSearchQuery(q);
		if (searchTimeout.current) clearTimeout(searchTimeout.current);
		if (!q.trim()) {
			setSearchResults([]);
			return;
		}
		searchTimeout.current = setTimeout(async () => {
			setSearching(true);
			try {
				const res = await gqlQuery(ADMIN_USER_SEARCH, {pageArgs: {searchQuery: q, page: 0, pageSize: 8}});
				const items = res?.data?.adminUserSearch?.items ?? [];
				setSearchResults(
					items
						.filter((u: any) => !users.some((existing) => existing.id === u.id))
						.map((u: any) => ({id: u.id, username: u.username}))
				);
			} catch {
				setSearchResults([]);
			} finally {
				setSearching(false);
			}
		}, 300);
	}

	return (
		<div className={b()}>
			<div className={b('label')}>
				Özel erişim
				{users.length > 0 && (
					<span className={b('label-hint')}>— toggle kapalıyken de bu kullanıcılar erişebilir</span>
				)}
			</div>
			<div className={b('user-section')}>
				<div className={b('chips')}>
					{users.map((u) => (
						<span key={u.id} className={b('chip')}>
							{u.username}
							<button
								className={b('chip-remove')}
								onClick={() => handleRemoveUser(u.id)}
								disabled={saving}
							>
								×
							</button>
						</span>
					))}
				</div>
				<div className={b('search-wrap')}>
					<input
						className={b('search-input')}
						value={searchQuery}
						onChange={handleSearchChange}
						placeholder="Kullanıcı ekle..."
					/>
					{(searchResults.length > 0 || searching) && (
						<div className={b('dropdown')}>
							{searching ? (
								<div className={b('dropdown-item', {loading: true})}>Aranıyor...</div>
							) : (
								searchResults.map((u) => (
									<button
										key={u.id}
										className={b('dropdown-item')}
										onClick={() => handleAddUser(u)}
									>
										{u.username}
									</button>
								))
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
