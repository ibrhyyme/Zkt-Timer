import React, {useMemo, useState} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../../api';
import {useTranslation} from 'react-i18next';
import {toastSuccess, toastError} from '../../../../util/toast';
import {IModalProps} from '../../../common/modal/Modal';
import {b, getEventName} from '../shared';
import {UploadSimple, UserPlus, FileCsv, DownloadSimple} from 'phosphor-react';

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

// --- Per-row event format (the school-competition list shape) --------------
// A row carries the competitor's name AND the events they will solve on the
// same line, e.g.
//   1; İbrahim İskender; Üç çarpı üç; İki çarpı iki
//   2; İskender Aznavur; 3x3
// Leading pure-number cell = registrant no (ignored). First text cell = name.
// Remaining cells = events, recognised from Turkish spoken form / WCA code /
// "NxN" short form. Unlike the common-events format, each row keeps its own
// event set instead of one set shared by everyone.
interface InlineRow {
	firstName: string;
	lastName: string;
	eventIds: string[]; // comp_event.id values, already filtered to this competition
	rawName: string;
	unknownTokens: string[]; // cells that looked like an event but matched none
}

// Normalise a cell to a comparable token: lowercase, strip Turkish diacritics,
// drop spaces/separators. "Üç Çarpı Üç" → "uccarpiuc", "3 x 3" → "3x3".
function canon(s: string): string {
	return (s || '')
		.toLowerCase()
		.replace(/ı/g, 'i')
		.replace(/ş/g, 's')
		.replace(/ç/g, 'c')
		.replace(/ğ/g, 'g')
		.replace(/ü/g, 'u')
		.replace(/ö/g, 'o')
		.replace(/[\s_\-.]/g, '')
		.trim();
}

// WCA event_id → accepted aliases. Both sides are canon-normalised at lookup.
const EVENT_ALIASES: Array<{id: string; aliases: string[]}> = [
	{id: '222', aliases: ['222', '2x2', '2x2x2', 'iki', 'ikicarpiiki', '2carpi2']},
	{id: '333', aliases: ['333', '3x3', '3x3x3', 'uc', 'uccarpiuc', '3carpi3']},
	{id: '444', aliases: ['444', '4x4', '4x4x4', 'dort', 'dortcarpidort']},
	{id: '555', aliases: ['555', '5x5', '5x5x5', 'bes', 'bescarpibes']},
	{id: '666', aliases: ['666', '6x6', '6x6x6', 'alti', 'alticarpialti']},
	{id: '777', aliases: ['777', '7x7', '7x7x7', 'yedi', 'yedicarpiyedi']},
	{id: '333bf', aliases: ['333bf', '3x3bld', 'bld', 'korlemesine', 'korlame']},
	{id: '333oh', aliases: ['333oh', 'oh', 'tekel', '3x3oh']},
	{id: '333fm', aliases: ['333fm', 'fmc', 'enazhamle']},
	{id: 'minx', aliases: ['minx', 'megaminx', 'mega']},
	{id: 'pyram', aliases: ['pyram', 'pyraminx', 'piramit', 'piramid']},
	{id: 'skewb', aliases: ['skewb']},
	{id: 'sq1', aliases: ['sq1', 'square1', 'squareone']},
	{id: 'clock', aliases: ['clock', 'saat']},
	{id: '444bf', aliases: ['444bf', '4x4bld']},
	{id: '555bf', aliases: ['555bf', '5x5bld']},
	{id: '333mbf', aliases: ['333mbf', 'mbld', 'coklukor']},
];

// canon(alias) → event_id, precomputed once at module load.
const ALIAS_TO_EVENT = new Map<string, string>();
for (const ev of EVENT_ALIASES) {
	for (const a of ev.aliases) ALIAS_TO_EVENT.set(canon(a), ev.id);
}

// Header rows whose first cell is one of these are skipped.
const HEADER_FIRST_CELLS = new Set([
	'no',
	'sira',
	'numara',
	'ad',
	'isim',
	'name',
	'adsoyad',
	'sno',
	'#',
]);

// Resolve a free-text cell to a comp_event.id of THIS competition, or null.
// eventIdToCompId maps WCA event_id → comp_event.id.
function resolveEventCell(cell: string, eventIdToCompId: Map<string, string>): string | null {
	const eventId = ALIAS_TO_EVENT.get(canon(cell));
	if (!eventId) return null;
	return eventIdToCompId.get(eventId) || null;
}

function parseEventList(text: string, eventIdToCompId: Map<string, string>): InlineRow[] {
	const lines = text.replace(/\r\n?/g, '\n').split('\n');
	const rows: InlineRow[] = [];
	let firstLine = true;
	for (const line of lines) {
		if (!line.trim()) continue;
		const delim = line.includes('\t') ? '\t' : line.includes(';') ? ';' : ',';
		// Drop empty cells so wide sheets with blank event columns collapse.
		const cells = splitLine(line, delim).filter((c) => c !== '');
		if (cells.length === 0) continue;
		if (firstLine) {
			firstLine = false;
			if (HEADER_FIRST_CELLS.has(canon(cells[0]))) continue;
		}
		let idx = 0;
		// A leading pure-number cell is the registrant no, not the name.
		if (/^\d+$/.test(cells[0].trim())) idx = 1;
		const rawName = (cells[idx] || '').trim();
		idx++;
		const eventIds: string[] = [];
		const unknownTokens: string[] = [];
		for (; idx < cells.length; idx++) {
			const compId = resolveEventCell(cells[idx], eventIdToCompId);
			if (compId) {
				if (!eventIds.includes(compId)) eventIds.push(compId);
			} else if (cells[idx].trim()) {
				unknownTokens.push(cells[idx].trim());
			}
		}
		const parts = rawName.split(/\s+/).filter(Boolean);
		const firstName = parts.shift() || '';
		const lastName = parts.join(' ');
		if (!firstName && !lastName) continue;
		rows.push({firstName, lastName, eventIds, rawName, unknownTokens});
	}
	return rows;
}

export default function ImportCompetitorsModal(props: Props) {
	const {t} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const [mode, setMode] = useState<'bulk' | 'single'>('bulk');
	const [submitting, setSubmitting] = useState(false);

	// Bulk state
	const [raw, setRaw] = useState('');
	// 'inline' = each row lists its own events (school list); 'common' = one
	// event set chosen below applied to every imported row.
	const [bulkFormat, setBulkFormat] = useState<'inline' | 'common'>('inline');
	const [bulkEvents, setBulkEvents] = useState<Set<string>>(new Set());
	const parsed = useMemo(() => parseList(raw), [raw]);

	// WCA event_id → comp_event.id, for resolving per-row event tokens.
	const eventIdToCompId = useMemo(() => {
		const m = new Map<string, string>();
		for (const ev of props.compEvents) m.set(ev.event_id, ev.id);
		return m;
	}, [props.compEvents]);
	const parsedInline = useMemo(
		() => parseEventList(raw, eventIdToCompId),
		[raw, eventIdToCompId]
	);

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

	// Build a ready-to-fill CSV the organiser can open in Excel, matching the
	// currently selected bulk format. UTF-8 BOM so Excel renders Turkish chars.
	function downloadTemplate() {
		const rows =
			bulkFormat === 'inline'
				? [
						['No', 'Ad Soyad', 'Etkinlikler'],
						['1', 'İbrahim İskender', 'Üç çarpı üç', 'İki çarpı iki'],
						['2', 'İskender Aznavur', 'Üç çarpı üç'],
						['3', 'Ayşe Yılmaz', 'Üç çarpı üç', 'İki çarpı iki', 'Beş çarpı beş'],
				  ]
				: [
						['Ad', 'Soyad', 'Ulke', 'WCA ID', 'Dis ID'],
						['Ahmet', 'Yılmaz', 'TR', '', '12345'],
						['Elif', 'Demir', 'TR', '', '12346'],
				  ];
		const csv = rows.map((r) => r.join(',')).join('\r\n');
		const blob = new Blob(['﻿' + csv], {type: 'text/csv;charset=utf-8;'});
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = bulkFormat === 'inline' ? 'ornek-liste.csv' : 'ornek-liste-ortak.csv';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	async function handleImport() {
		// Build rows for whichever bulk format is active.
		let rows: Array<{
			firstName: string;
			lastName: string;
			country?: string;
			wcaId?: string;
			externalId?: string;
			eventIds: string[];
		}>;
		if (bulkFormat === 'inline') {
			if (parsedInline.length === 0) {
				toastError(t('import_no_rows'));
				return;
			}
			rows = parsedInline.map((r) => ({
				firstName: r.firstName,
				lastName: r.lastName,
				eventIds: r.eventIds,
			}));
		} else {
			if (parsed.length === 0) {
				toastError(t('import_no_rows'));
				return;
			}
			if (bulkEvents.size === 0) {
				toastError(t('select_at_least_one_event'));
				return;
			}
			rows = parsed.map((r) => ({
				firstName: r.firstName,
				lastName: r.lastName,
				country: r.country || undefined,
				wcaId: r.wcaId || undefined,
				externalId: r.externalId || undefined,
				eventIds: Array.from(bulkEvents),
			}));
		}
		setSubmitting(true);
		try {
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
					<div className={b('import-format-seg')}>
						<button
							type="button"
							className={b('import-format-opt', {active: bulkFormat === 'inline'})}
							onClick={() => setBulkFormat('inline')}
						>
							{t('import_format_inline')}
						</button>
						<button
							type="button"
							className={b('import-format-opt', {active: bulkFormat === 'common'})}
							onClick={() => setBulkFormat('common')}
						>
							{t('import_format_common')}
						</button>
					</div>

					<div className={b('import-format-hint')}>
						{bulkFormat === 'inline' ? t('import_format_inline_hint') : t('import_format_hint')}
					</div>

					<div className={b('import-file-row')}>
						<label className={b('import-file-btn')}>
							<UploadSimple weight="bold" /> {t('import_choose_file')}
							<input
								type="file"
								accept=".csv,.txt,text/csv,text/plain"
								onChange={onFile}
								style={{display: 'none'}}
							/>
						</label>
						<button type="button" className={b('import-template-btn')} onClick={downloadTemplate}>
							<DownloadSimple weight="bold" /> {t('import_download_template')}
						</button>
					</div>

					<textarea
						className={b('import-textarea')}
						value={raw}
						onChange={(e) => setRaw(e.target.value)}
						placeholder={bulkFormat === 'inline' ? t('import_paste_inline_placeholder') : t('import_paste_placeholder')}
						rows={6}
					/>

					{bulkFormat === 'inline' && parsedInline.length > 0 && (
						<div className={b('import-preview')}>
							<div className={b('import-preview-count')}>
								{t('import_preview_count', {count: parsedInline.length})}
							</div>
							<table className={b('import-table')}>
								<thead>
									<tr>
										<th>{t('csv_col_name')}</th>
										<th>{t('import_col_events')}</th>
									</tr>
								</thead>
								<tbody>
									{parsedInline.slice(0, PREVIEW_LIMIT).map((r, i) => (
										<tr key={i}>
											<td>{r.rawName}</td>
											<td>
												<span className={b('import-event-chips')}>
													{r.eventIds.map((cid) => {
														const ev = props.compEvents.find((e) => e.id === cid);
														return ev ? (
															<span
																key={cid}
																className={`cubing-icon event-${ev.event_id}`}
																title={getEventName(ev.event_id)}
															/>
														) : null;
													})}
													{r.eventIds.length === 0 && r.unknownTokens.length === 0 && (
														<span className={b('import-warn')}>{t('import_row_no_events')}</span>
													)}
													{r.unknownTokens.length > 0 && (
														<span className={b('import-warn')}>
															{t('import_unknown_events', {tokens: r.unknownTokens.join(', ')})}
														</span>
													)}
												</span>
											</td>
										</tr>
									))}
								</tbody>
							</table>
							{parsedInline.length > PREVIEW_LIMIT && (
								<div className={b('import-preview-more')}>
									{t('import_preview_more', {count: parsedInline.length - PREVIEW_LIMIT})}
								</div>
							)}
						</div>
					)}

					{bulkFormat === 'common' && parsed.length > 0 && (
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

					{bulkFormat === 'common' && (
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
					)}

					<button
						type="button"
						className={b('cta')}
						onClick={handleImport}
						disabled={submitting || (bulkFormat === 'inline' ? parsedInline.length === 0 : parsed.length === 0 || bulkEvents.size === 0)}
					>
						{submitting ? t('import_importing') : t('import_submit', {count: bulkFormat === 'inline' ? parsedInline.length : parsed.length})}
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
