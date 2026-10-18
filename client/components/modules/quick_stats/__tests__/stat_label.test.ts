import * as fs from 'fs';
import * as path from 'path';
import { getStatLabel } from '../stat_label';

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

	it('has every label in all five languages', () => {
		const kinds = ['best_single', 'worst_single', 'best_avg', 'current_avg', 'mean'];
		for (const lang of ['tr', 'en', 'es', 'ru', 'zh']) {
			const file = path.join(__dirname, '../../../../i18n/locales', lang, 'translation.json');
			const labels = JSON.parse(fs.readFileSync(file, 'utf8')).timer_modules.stat_label;
			for (const kind of kinds) {
				expect(typeof labels[kind]).toBe('string');
				expect(typeof labels[`session_${kind}`]).toBe('string');
			}
		}
	});
});
