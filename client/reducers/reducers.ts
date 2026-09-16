import {combineReducers} from 'redux';
import timer from './timer';
import smartCube from './smart_cube';
import algorithms from './algorithms';
import account from './account';
import help from './help';
import ssr from './ssr';
import stats from './stats';
import general from './general';

export default combineReducers({
	timer,
	// Smart cube connection, separate from `timer` so leaving the timer page cannot reset it.
	smartCube,
	algorithms,
	stats,
	help,
	ssr,
	general,
	account,
});
