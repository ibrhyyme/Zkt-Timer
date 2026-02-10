import http from 'k6/http';
import { check, sleep, group } from 'k6';

export const options = {
  scenarios: {
    readers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 60 },
      ],
      exec: 'readerUser',
    },
    solvers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 30 },
      ],
      exec: 'solverUser',
    },
    searchers: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },
      ],
      exec: 'searcherUser',
    },
  },
  thresholds: {
    'http_req_failed': ['rate<0.01'], // Global error rate should be less than 1%
    'http_req_duration{group:Searchers}': ['p(95)<500'], // 95% of Search requests should be under 500ms
  },
};

const BASE_URL = 'http://localhost:3000/graphql';

// Using the hardcoded cookie from previous instructions
const PARAMS = {
  headers: {
    'Content-Type': 'application/json',
    'Cookie': 'session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZTc2YWU1ZDktN2Q0Zi00M2Q3LWEyZjctZjAwOThjMDk2YmFlIiwiY3JlYXRlZEF0IjoxNzY4Njk3Nzc3NTc0LCJpYXQiOjE3Njg2OTc3Nzd9.Q3rcaVoqrx_dsa8YLBheizMgVOcgcBSF-9E55bW9TS4',
  },
};

// --- GQL Queries ---

const ME_QUERY = `
  query Me {
    me {
      id
      username
      email
      created_at
    }
  }
`;

const SESSIONS_QUERY = `
  query Sessions {
    sessions {
      id
      name
      order
      created_at
    }
  }
`;

const ELO_QUERY = `
  query EloLeaderboards($pageArgs: PaginationArgsInput!) {
    eloLeaderboards(pageArgs: $pageArgs) {
      items {
        user {
          username
        }
        elo_333_rating
      }
      total
    }
  }
`;

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

const SEARCH_QUERY = `
  query UserSearch($pageArgs: PaginationArgsInput!) {
    userSearch(pageArgs: $pageArgs) {
      items {
        id
        username
      }
      total
    }
  }
`;

// --- Scenarios ---

export function readerUser() {
  group('Readers', function () {

    // 1. Fetch Profile (Me)
    let resMe = http.post(BASE_URL, JSON.stringify({ query: ME_QUERY }), PARAMS);
    if (!check(resMe, { 'status is 200': (r) => r.status === 200 })) {
      console.log(`Reader Error (Me): ${resMe.status} - ${resMe.body}`);
    }

    // 2. Fetch Sessions History
    let resSessions = http.post(BASE_URL, JSON.stringify({ query: SESSIONS_QUERY }), PARAMS);
    if (!check(resSessions, { 'status is 200': (r) => r.status === 200 })) {
      console.log(`Reader Error (Sessions): ${resSessions.status} - ${resSessions.body}`);
    }

    // 3. Fetch Global ELO
    const eloPayload = JSON.stringify({
      query: ELO_QUERY,
      variables: {
        pageArgs: { page: 0, pageSize: 10 }
      }
    });
    let resElo = http.post(BASE_URL, eloPayload, PARAMS);
    if (!check(resElo, { 'status is 200': (r) => r.status === 200 })) {
      console.log(`Reader Error (Elo): ${resElo.status} - ${resElo.body}`);
    }
  });

  sleep(Math.random() * 2 + 1); // Random sleep between 1-3s
}

export function solverUser() {
  group('Solvers', function () {
    const now = Date.now();
    // Generate a random session ID or use a dynamic one if needed. 
    // Note: If the backend checks for existence, a random ID might fail with "Session not found".
    // If checking for uniqueness, random is good. 
    // Re-adding session_id with a random value for uniqueness check.
    const randomSessionId = `test-sess-${Math.random().toString(36).substring(7)}`;

    const payload = JSON.stringify({
      query: CREATE_SOLVE_MUTATION,
      variables: {
        input: {
          time: 15.50,
          raw_time: 15.50,
          cube_type: "333",
          scramble: "R U R' U'",
          started_at: now - 15500,
          ended_at: now,
          dnf: false,
          plus_two: false,
          from_timer: true,
          session_id: randomSessionId,
          is_smart_cube: false
        }
      }
    });

    let res = http.post(BASE_URL, payload, PARAMS);
    if (!check(res, { 'status is 200': (r) => r.status === 200 })) {
      console.log(`Solver Error: ${res.status} - ${res.body}`);
    }
  });

  sleep(Math.random() * 1 + 0.5); // Faster pace for solvers
}

export function searcherUser() {
  group('Searchers', function () {
    const payload = JSON.stringify({
      query: SEARCH_QUERY,
      variables: {
        pageArgs: {
          page: 0,
          pageSize: 10,
          searchQuery: "demo" // Searching for something generic
        }
      }
    });

    // Tagging this request specifically for threshold check if needed, 
    // but the group tag implies group="Searchers" in k6 metrics
    let res = http.post(BASE_URL, payload, {
      headers: PARAMS.headers,
      tags: { group: 'Searchers' }
    });

    check(res, { 'status is 200': (r) => r.status === 200 });
  });

  sleep(Math.random() * 3 + 2); // Slower pace for searchers
}
