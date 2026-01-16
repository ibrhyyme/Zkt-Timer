import { Solve } from '../../../server/schemas/Solve.schema';
import { fetchLastSolve } from '../../db/solves/query';
import { useSolveDb } from './useSolveDb';

export function useLatestSolve(): Solve | null {
    // This hook will re-render when solves database changes
    useSolveDb();

    // Fetch the latest solve from the database
    return fetchLastSolve();
}
