import {useState, useEffect} from 'react';
import {isAppVisible, onVisibilityChange} from '../app-visibility';

export function useAppVisible(): boolean {
	const [visible, setVisible] = useState(isAppVisible);
	useEffect(() => onVisibilityChange(setVisible), []);
	return visible;
}
