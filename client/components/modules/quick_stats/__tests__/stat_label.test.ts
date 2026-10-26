import * as fs from 'fs';
import * as path from 'path';
import { getStatLabel, STAT_LABEL_KINDS } from '../stat_label';

describe('getStatLabel', () => {
	it('names singles', () => {
		expect(getStatLabel({ statType: 'single', sortBy: 'best' }).key).toBe('timer_modules.stat_label.best_single');
		expect(getStatLabel({ statType: 'single', sortBy: 'worst' }).key).toBe('timer_modules.stat_label.worst_single');
		expect(getStatLabel({ statType: 'single', sortBy: 'worst', session: true }).key).toBe(
			'timer_modules.stat_label.session_worst_single'
		);
	});

	it('names averages with their count', () => {
		expect(getStatLabel({ statType: 'average', averageCount: 5, sortBy: 'current' })).toEqual({
			key: 'timer_modules.stat_label.current_avg',
			params: { n: 5 },
		});
		expect(getStatLabel({ statType: 'average', averageCount: 100, sortBy: 'best', session: true })).toEqual({
			key: 'timer_modules.stat_label.session_best_avg',
			params: { n: 100 },
		});
	});

	it('calls an average without a count a mean', () => {
		expect(getStatLabel({ statType: 'average', session: true }).key).toBe('timer_modules.stat_label.session_mean');
		expect(getStatLabel({ statType: 'average', averageCount: 0 }).key).toBe('timer_modules.stat_label.mean');
	});

	it('names the worst average, which used to show the current one', () => {
		expect(getStatLabel({ statType: 'average', averageCount: 12, sortBy: 'worst' }).key).toBe(
			'timer_modules.stat_label.worst_avg'
		);
	});

	it('names means of N, the next-solve values, σ and the count', () => {
		expect(getStatLabel({ statType: 'mean', averageCount: 3, sortBy: 'current' })).toEqual({
			key: 'timer_modules.stat_label.current_mo',
			params: { n: 3 },
		});
		expect(getStatLabel({ statType: 'mean', averageCount: 0 }).key).toBe('timer_modules.stat_label.mean');
		expect(getStatLabel({ statType: 'average', averageCount: 5, sortBy: 'target', session: true }).key).toBe(
			'timer_modules.stat_label.session_target_avg'
		);
		// A mean of N has no WPA (a DNF next solve makes it a DNF): it falls back to current
		expect(getStatLabel({ statType: 'mean', averageCount: 3, sortBy: 'wpa' }).key).toBe(
			'timer_modules.stat_label.current_mo'
		);
		expect(getStatLabel({ statType: 'stdev', averageCount: 12 })).toEqual({
			key: 'timer_modules.stat_label.stdev_avg',
			params: { n: 12 },
		});
		expect(getStatLabel({ statType: 'stdev', averageCount: 0 }).key).toBe('timer_modules.stat_label.stdev');
		expect(getStatLabel({ statType: 'count', averageCount: 50, session: true })).toEqual({
			key: 'timer_modules.stat_label.session_count',
			params: {},
		});
	});

	it('has every label and editor text in all five languages', () => {
		const tr = JSON.parse(
			fs.readFileSync(path.join(__dirname, '../../../../i18n/locales/tr/translation.json'), 'utf8')
		).timer_modules.stat_editor;
		const leaves = (obj: any, prefix = ''): string[] =>
			Object.entries(obj).flatMap(([k, v]) => (typeof v === 'object' ? leaves(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
		const editorKeys = leaves(tr);

		for (const lang of ['tr', 'en', 'es', 'ru', 'zh']) {
			const file = path.join(__dirname, '../../../../i18n/locales', lang, 'translation.json');
			const modules = JSON.parse(fs.readFileSync(file, 'utf8')).timer_modules;
			const labels = modules.stat_label;
			for (const keyPath of editorKeys) {
				const text = keyPath.split('.').reduce((o: any, k) => o?.[k], modules.stat_editor);
				expect([lang, keyPath, typeof text]).toEqual([lang, keyPath, 'string']);
			}
			for (const kind of STAT_LABEL_KINDS) {
				expect(typeof labels[kind]).toBe('string');
				expect(typeof labels[`session_${kind}`]).toBe('string');
			}
		}
	});
});
