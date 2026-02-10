import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    vus: 1,
    iterations: 1, // Run only once to verify logic
};

const BASE_URL = 'http://localhost:3000/graphql';

const PARAMS = {
    headers: {
        'Content-Type': 'application/json',
        'Cookie': 'session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZTc2YWU1ZDktN2Q0Zi00M2Q3LWEyZjctZjAwOThjMDk2YmFlIiwiY3JlYXRlZEF0IjoxNzY4Njk3Nzc3NTc0LCJpYXQiOjE3Njg2OTc3Nzd9.Q3rcaVoqrx_dsa8YLBheizMgVOcgcBSF-9E55bW9TS4',
    },
};

const CREATE_SOLVE_MUTATION = `
  mutation CreateSolve($input: SolveInput!) {
    createSolve(input: $input) {
      id
      time
      scramble
      created_at
    }
  }
`;

const SOLVES_QUERY = `
  query Solves {
    solves {
      id
      time
      scramble
      created_at
    }
  }
`;

export default function () {
    const now = Date.now();
    // Unique scramble to identify this specific solve
    const uniqueScramble = `TEST_SCRAMBLE_${now}`;
    const testTime = 12.34;

    console.log(`Step 1: Creating solve with scramble: ${uniqueScramble}`);

    const createPayload = JSON.stringify({
        query: CREATE_SOLVE_MUTATION,
        variables: {
            input: {
                time: testTime,
                raw_time: testTime,
                cube_type: "333",
                scramble: uniqueScramble,
                started_at: now - 12340,
                ended_at: now,
                dnf: false,
                plus_two: false,
                from_timer: true,
                is_smart_cube: false
            }
        }
    });

    let createRes = http.post(BASE_URL, createPayload, PARAMS);

    // Check if creation was successful
    let createSuccess = check(createRes, {
        'Create Solve Status is 200': (r) => r.status === 200,
        'Create Solve has ID': (r) => JSON.parse(r.body).data.createSolve.id !== undefined
    });

    if (!createSuccess) {
        console.error(`Failed to create solve: ${createRes.body}`);
        return;
    }

    const createdSolveId = JSON.parse(createRes.body).data.createSolve.id;
    console.log(`Step 1 Success: Solve created with ID: ${createdSolveId}`);

    sleep(1); // Wait a moment to ensure DB consistency (though should be instant)

    console.log(`Step 2: Fetching solves to verify persistence...`);

    let fetchRes = http.post(BASE_URL, JSON.stringify({ query: SOLVES_QUERY }), PARAMS);

    let fetchSuccess = check(fetchRes, {
        'Fetch Solves Status is 200': (r) => r.status === 200,
    });

    if (!fetchSuccess) {
        console.error(`Failed to fetch solves: ${fetchRes.body}`);
        return;
    }

    const solves = JSON.parse(fetchRes.body).data.solves;

    // Find our solve
    const foundSolve = solves.find(s => s.scramble === uniqueScramble);

    check(foundSolve, {
        'Solve persistence verified (Found by Scramble)': (s) => s !== undefined,
        'Solve time is correct': (s) => s && s.time === testTime,
        'Solve ID matches': (s) => s && s.id === createdSolveId
    });

    if (foundSolve) {
        console.log(`Step 2 Success: Solve found in DB! ID: ${foundSolve.id}, Time: ${foundSolve.time}, Scramble: ${foundSolve.scramble}`);
    } else {
        console.error(`Step 2 Failed: Solve with scramble ${uniqueScramble} NOT found in list.`);
    }
}
