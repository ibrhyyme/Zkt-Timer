import React, {useState} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {toastSuccess, toastError} from '../../../../util/toast';
import {b} from '../shared';
import {PencilSimple, Trash, ArrowUp, ArrowDown, Plus} from 'phosphor-react';

const CREATE_TAB = gql`
	mutation CreateZktCompTab($input: CreateZktCompTabInput!) {
		createZktCompTab(input: $input) {
			id
		}
	}
`;

const UPDATE_TAB = gql`
	mutation UpdateZktCompTab($input: UpdateZktCompTabInput!) {
		updateZktCompTab(input: $input) {
			id
		}
	}
`;

const DELETE_TAB = gql`
	mutation DeleteZktCompTab($tabId: String!) {
		deleteZktCompTab(tabId: $tabId)
	}
`;

const REORDER_TABS = gql`
	mutation ReorderZktCompTabs($input: ReorderZktCompTabsInput!) {
		reorderZktCompTabs(input: $input)
	}
`;

export default function ZktCompTabsManager({
	detail,
	onUpdated,
}: {
	detail: any;
	onUpdated: () => void;
}) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const tabs = (detail.tabs || []).slice().sort((a: any, b: any) => a.tab_order - b.tab_order);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [title, setTitle] = useState('');
	const [content, setContent] = useState('');
	const [saving, setSaving] = useState(false);

	function reset() {
		setEditingId(null);
		setTitle('');
		setContent('');
	}

	async function save() {
		if (!title.trim() || !content.trim()) {
			toastError(t('tab_fill_fields'));
			return;
		}
		setSaving(true);
		try {
			if (editingId) {
				await gqlMutate(UPDATE_TAB, {input: {tabId: editingId, title, content}});
				toastSuccess(t('tab_updated'));
			} else {
				await gqlMutate(CREATE_TAB, {input: {competitionId: detail.id, title, content}});
				toastSuccess(t('tab_created'));
			}
			reset();
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		} finally {
			setSaving(false);
		}
	}

	function edit(tab: any) {
		setEditingId(tab.id);
		setTitle(tab.title);
		setContent(tab.content);
	}

	async function remove(tabId: string) {
		if (!window.confirm(t('tab_delete_confirm'))) return;
		try {
			await gqlMutate(DELETE_TAB, {tabId});
			toastSuccess(t('tab_deleted'));
			if (editingId === tabId) reset();
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	async function move(index: number, dir: number) {
		const next = index + dir;
		if (next < 0 || next >= tabs.length) return;
		const ids = tabs.map((tb: any) => tb.id);
		[ids[index], ids[next]] = [ids[next], ids[index]];
		try {
			await gqlMutate(REORDER_TABS, {input: {competitionId: detail.id, tabIds: ids}});
			onUpdated();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		}
	}

	return (
		<div className={b('tabs-manager')}>
			<div className={b('section-title')}>{editingId ? t('tab_edit') : t('tab_new')}</div>
			<div className={b('field')}>
				<input
					className={b('input')}
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder={t('tab_title')}
				/>
			</div>
			<div className={b('field')}>
				<textarea
					className={b('textarea')}
					value={content}
					onChange={(e) => setContent(e.target.value)}
					placeholder={t('tab_content_md')}
					rows={6}
				/>
			</div>
			<div style={{display: 'flex', gap: '0.5rem'}}>
				<button className={b('modal-btn', {primary: true})} onClick={save} disabled={saving}>
					{editingId ? (
						t('save')
					) : (
						<>
							<Plus weight="bold" /> {t('add')}
						</>
					)}
				</button>
				{editingId && (
					<button className={b('modal-btn')} onClick={reset}>
						{t('cancel')}
					</button>
				)}
			</div>

			<div className={b('section-title')} style={{marginTop: 24}}>
				{t('tab_existing')}
			</div>
			{tabs.length === 0 ? (
				<div className={b('empty')}>{t('tab_none')}</div>
			) : (
				<div className={b('tab-list')}>
					{tabs.map((tb: any, i: number) => (
						<div key={tb.id} className={b('tab-row')}>
							<span className={b('tab-row-title')}>{tb.title}</span>
							<button
								type="button"
								className={b('icon-btn')}
								onClick={() => move(i, -1)}
								disabled={i === 0}
								title={t('move_up')}
							>
								<ArrowUp weight="bold" />
							</button>
							<button
								type="button"
								className={b('icon-btn')}
								onClick={() => move(i, 1)}
								disabled={i === tabs.length - 1}
								title={t('move_down')}
							>
								<ArrowDown weight="bold" />
							</button>
							<button
								type="button"
								className={b('icon-btn')}
								onClick={() => edit(tb)}
								title={t('edit')}
							>
								<PencilSimple weight="bold" />
							</button>
							<button
								type="button"
								className={b('icon-btn', {danger: true})}
								onClick={() => remove(tb.id)}
								title={t('delete')}
							>
								<Trash weight="bold" />
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
