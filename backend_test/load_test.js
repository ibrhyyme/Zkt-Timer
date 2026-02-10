import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 50 }, // Ramp up to 50 users over 30 seconds
        { duration: '30s', target: 100 }, // Ramp up to 100 users over the next 30 seconds
    ],
};

const query = `
  mutation CreateSolve($input: SolveInput!) {
    createSolve(input: $input) {
      id
      time
      scramble
      created_at
    }
  }
`;

export default function () {
    const url = 'http://localhost:3000/graphql';

    // Dummy data for the solve
    const now = Date.now();
    const payload = JSON.stringify({
        query: query,
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
                session_id: "test-session", // You might need a valid session ID if validation is strict
                is_smart_cube: false
            }
        }
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Cookie': 'session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZTc2YWU1ZDktN2Q0Zi00M2Q3LWEyZjctZjAwOThjMDk2YmFlIiwiY3JlYXRlZEF0IjoxNzY4Njk3Nzc3NTc0LCJpYXQiOjE3Njg2OTc3Nzd9.Q3rcaVoqrx_dsa8YLBheizMgVOcgcBSF-9E55bW9TS4',
        },
    };

    const res = http.post(url, payload, params);

    check(res, {
        'status is 200': (r) => r.status === 200,
        'response time < 200ms': (r) => r.timings.duration < 200,
    });

    if (res.timings.duration >= 200) {
        console.log(`Response time exceeded 200ms: ${res.timings.duration}ms`);
    }

    sleep(1);
}
