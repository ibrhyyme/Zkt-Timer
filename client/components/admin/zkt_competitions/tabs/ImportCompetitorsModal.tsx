import React, {useMemo, useState} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {toastSuccess, toastError} from '../../../../util/toast';
import {IModalProps} from '../../../common/modal/Modal';
import {b, getEventName} from '../shared';
import {UploadSimple, UserPlus, FileCsv} from 'phosphor-react';

// Bulk import of account-less ("ghost") competitors: paste an Excel/CSV list
// (e.g. a municipality registration export) or upload a .csv file. Each row
// becomes a ZktPerson + APPROVED registration. No ZKT/WCA account required.
const IMPORT_COMPETITORS = gql`
	mutation ImportZktCompetitors($input: ImportZktCompetitorsInput!) {
		importZktCompetitors(input: $input) {
			id
			first_name
			last_name
		}
	}
`;

const ADD_PERSON = gql`
	mutation AddZktPerson($input: AddZktPersonInput!) {
		addZktPerson(input: $input) {
			id
			first_name
			last_name
		}
	}
`;

interface ParsedRow {
	firstName: string;
	lastName: string;
	country: string;
	wcaId: string;
	externalId: string;
}

interface Props extends IModalProps {
	competitionId: string;
	compEvents: Array<{id: string; event_id: string}>;
}

// Split one delimited line, honouring "quoted, fields". Delimiter is detected
// per line so Excel paste (tab) and CSV (comma/semicolon) both work.
function splitLine(line: string, delim: string): string[] {
	const out: string[] = [];
	let cur = '';
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQuotes) {
			if (ch === '"') {
				if (line[i + 1] === '"') {
					cur += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				cur += ch;
			}
		} else if (ch === '"') {
			inQuotes = true;
		} else if (ch === delim) {
			out.push(cur);
			cur = '';
		} else {
			cur += ch;
		}
	}
	out.push(cur);
	return out.map((s) => s.trim());
}

const HEADER_HINTS = ['ad', 'isim', 'name', 'first', 'firstname', 'first_name', 'ad soyad'];

function parseList(text: string): ParsedRow[] {
	const lines = text.replace(/\r\n?/g, '\n').split('\n');
	const rows: ParsedRow[] = [];
	let first = true;
	for (const line of lines) {
		if (!line.trim()) continue;
		const delim = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
		const cells = splitLine(line, delim);
		// Skip a leading header row ("Ad, Soyad, ...").
		if (first) {
			first = false;
			const f = (cells[0] || '').toLowerCase();
			if (HEADER_HINTS.some((h) => f === h || f.includes(h))) continue;
		}
		rows.push({
			firstName: cells[0] || '',
			lastName: cells[1] || '',
			country: cells[2] || '',
			wcaId: cells[3] || '',
			externalId: cells[4] || '',
		});
	}
	return rows.filter((r) => r.firstName || r.lastName);
}

export default function ImportCompetitorsModal(props: Props) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const [mode, setMode] = useState<'bulk' | 'single'>('bulk');
	const [submitting, setSubmitting] = useState(false);

	// Bulk state
	const [raw, setRaw] = useState('');
	const [bulkEvents, setBulkEvents] = useState<Set<string>>(new Set());
	const parsed = useMemo(() => parseList(raw), [raw]);

	// Single state
	const [form, setForm] = useState({
		firstName: '',
		lastName: '',
		country: 'TR',
		wcaId: '',
		externalId: '',
	});
	const [singleEvents, setSingleEvents] = useState<Set<string>>(new Set());

	function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
		const next = new Set(set);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		setter(next);
	}

	function onFile(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => setRaw(String(reader.result || ''));
		reader.readAsText(file, 'utf-8');
		// Allow re-selecting the same file.
		e.target.value = '';
	}

	async function handleImport() {
		if (parsed.length === 0) {
			toastError(t('import_no_rows'));
			return;
		}
		if (bulkEvents.size === 0) {
			toastError(t('select_at_least_one_event'));
			return;
		}
		setSubmitting(true);
		try {
			const rows = parsed.map((r) => ({
				firstName: r.firstName,
				lastName: r.lastName,
				country: r.country || undefined,
				wcaId: r.wcaId || undefined,
				externalId: r.externalId || undefined,
				eventIds: Array.from(bulkEvents),
			}));
			await gqlMutate(IMPORT_COMPETITORS, {
				input: {competitionId: props.competitionId, rows},
			});
			toastSuccess(t('import_done', {count: rows.length}));
			// onComplete is the modal wrapper's clickComplete: refetches + closes.
			if (props.onComplete) props.onComplete();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		} finally {
			setSubmitting(false);
		}
	}

	async function handleAddSingle() {
		if (!form.firstName.trim() || !form.lastName.trim()) {
			toastError(t('import_name_required'));
			return;
		}
		if (singleEvents.size === 0) {
			toastError(t('select_at_least_one_event'));
			return;
		}
		setSubmitting(true);
		try {
			await gqlMutate(ADD_PERSON, {
				input: {
					competitionId: props.competitionId,
					firstName: form.firstName.trim(),
					lastName: form.lastName.trim(),
					country: form.country.trim() || undefined,
					wcaId: form.wcaId.trim() || undefined,
					externalId: form.externalId.trim() || undefined,
					eventIds: Array.from(singleEvents),
				},
			});
			toastSuccess(t('added'));
			if (props.onComplete) props.onComplete();
		} catch (e: any) {
			toastError(e?.message || t('error'));
		} finally {
			setSubmitting(false);
		}
	}

	const PREVIEW_LIMIT = 8;

	return (
		<div className={b('import-modal')}>
			<div className={b('modal-header')}>
				<div className={b('modal-icon')}>
					<UploadSimple weight="fill" />
				</div>
				<h2 className={b('modal-title')}>{t('import_competitors')}</h2>
			</div>

			<p className={b('import-intro')}>{t('import_intro')}</p>

			<div className={b('import-tabs')}>
				<button
					type="button"
					className={b('import-tab', {active: mode === 'bulk'})}
					onClick={() => setMode('bulk')}
				>
					<FileCsv weight="bold" /> {t('import_bulk_tab')}
				</button>
				<button
					type="button"
					className={b('import-tab', {active: mode === 'single'})}
					onClick={() => setMode('single')}
				>
					<UserPlus weight="bold" /> {t('import_single_tab')}
				</button>
			</div>

			{mode === 'bulk' ? (
				<div className={b('form')}>
					<div className={b('import-format-hint')}>{t('import_format_hint')}</div>

					<label className={b('import-file-btn')}>
						<UploadSimple weight="bold" /> {t('import_choose_file')}
						<input
							type="file"
							accept=".csv,.txt,text/csv,text/plain"
							onChange={onFile}
							style={{display: 'none'}}
						/>
					</label>

					<textarea
						className={b('import-textarea')}
						value={raw}
						onChange={(e) => setRaw(e.target.value)}
						placeholder={t('import_paste_placeholder')}
						rows={6}
					/>

					{parsed.length > 0 && (
						<div className={b('import-preview')}>
							<div className={b('import-preview-count')}>
								{t('import_preview_count', {count: parsed.length})}
							</div>
							<table className={b('import-table')}>
								<thead>
									<tr>
										<th>{t('csv_col_first')}</th>
										<th>{t('csv_col_last')}</th>
										<th>{t('csv_col_country')}</th>
										<th>{t('csv_col_wca')}</th>
										<th>{t('csv_col_external')}</th>
									</tr>
								</thead>
								<tbody>
									{parsed.slice(0, PREVIEW_LIMIT).map((r, i) => (
										<tr key={i}>
											<td>{r.firstName}</td>
											<td>{r.lastName}</td>
											<td>{r.country || 'TR'}</td>
											<td>{r.wcaId}</td>
											<td>{r.externalId}</td>
										</tr>
									))}
								</tbody>
							</table>
							{parsed.length > PREVIEW_LIMIT && (
								<div className={b('import-preview-more')}>
									{t('import_preview_more', {count: parsed.length - PREVIEW_LIMIT})}
								</div>
							)}
						</div>
					)}

					<div className={b('field')}>
						<label className={b('label')}>{t('import_common_events')}</label>
						<div className={b('event-grid')}>
							{props.compEvents.map((ev) => (
								<button
									key={ev.id}
									type="button"
									className={b('event-option', {selected: bulkEvents.has(ev.id)})}
									onClick={() => toggle(bulkEvents, setBulkEvents, ev.id)}
								>
									<span className={`cubing-icon event-${ev.event_id}`} />
									<span>{getEventName(ev.event_id)}</span>
								</button>
							))}
						</div>
					</div>

					<button
						type="button"
						className={b('cta')}
						onClick={handleImport}
						disabled={submitting || parsed.length === 0 || bulkEvents.size === 0}
					>
						{submitting
							? t('import_importing')
							: t('import_submit', {count: parsed.length})}
					</button>
				</div>
			) : (
				<div className={b('form')}>
					<div className={b('import-grid-2')}>
						<div className={b('field')}>
							<label className={b('label')}>{t('csv_col_first')}</label>
							<input
								className={b('input')}
								value={form.firstName}
								onChange={(e) => setForm({...form, firstName: e.target.value})}
								autoFocus
							/>
						</div>
						<div className={b('field')}>
							<label className={b('label')}>{t('csv_col_last')}</label>
							<input
								className={b('input')}
								value={form.lastName}
								onChange={(e) => setForm({...form, lastName: e.target.value})}
							/>
						</div>
					</div>

					<div className={b('import-grid-2')}>
						<div className={b('field')}>
							<label className={b('label')}>{t('csv_col_country')}</label>
							<input
								className={b('input')}
								value={form.country}
								onChange={(e) => setForm({...form, country: e.target.value})}
								placeholder="TR"
								maxLength={2}
							/>
						</div>
						<div className={b('field')}>
							<label className={b('label')}>{t('csv_col_external')}</label>
							<input
								className={b('input')}
								value={form.externalId}
								onChange={(e) => setForm({...form, externalId: e.target.value})}
							/>
						</div>
					</div>

					<div className={b('field')}>
						<label className={b('label')}>{t('csv_col_wca')}</label>
						<input
							className={b('input')}
							value={form.wcaId}
							onChange={(e) => setForm({...form, wcaId: e.target.value})}
							placeholder="2018XXXX01"
						/>
					</div>

					<div className={b('field')}>
						<label className={b('label')}>{t('select_events')}</label>
						<div className={b('event-grid')}>
							{props.compEvents.map((ev) => (
								<button
									key={ev.id}
									type="button"
									className={b('event-option', {selected: singleEvents.has(ev.id)})}
									onClick={() => toggle(singleEvents, setSingleEvents, ev.id)}
								>
									<span className={`cubing-icon event-${ev.event_id}`} />
									<span>{getEventName(ev.event_id)}</span>
								</button>
							))}
						</div>
					</div>

					<button
						type="button"
						className={b('cta')}
						onClick={handleAddSingle}
						disabled={
							submitting ||
							!form.firstName.trim() ||
							!form.lastName.trim() ||
							singleEvents.size === 0
						}
					>
						{submitting ? t('adding') : t('add')}
					</button>
				</div>
			)}
		</div>
	);
}
