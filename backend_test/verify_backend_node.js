
const BASE_URL = 'http://localhost:3000/graphql';

// Using the cookie from the previous test file
const COOKIE = 'session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZTc2YWU1ZDktN2Q0Zi00M2Q3LWEyZjctZjAwOThjMDk2YmFlIiwiY3JlYXRlZEF0IjoxNzY4Njk3Nzc3NTc0LCJpYXQiOjE3Njg2OTc3Nzd9.Q3rcaVoqrx_dsa8YLBheizMgVOcgcBSF-9E55bW9TS4';

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

async function runTest() {
    console.log("🚀 Starting Backend Health Check...");

    const now = Date.now();
    const uniqueScramble = `TEST_SCRAMBLE_${now}`;
    const testTime = 12.34;

    console.log(`\n🔹 Step 1: Creating solve with scramble: ${uniqueScramble}`);

    try {
        const createRes = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': COOKIE
            },
            body: JSON.stringify({
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
            })
        });

        if (createRes.status !== 200) {
            console.error(`❌ Failed to connect or error. Status: ${createRes.status}`);
            const text = await createRes.text();
            console.error(text);
            return;
        }

        const createData = await createRes.json();

        if (createData.errors) {
            console.error("❌ GraphQL Errors during creation:", JSON.stringify(createData.errors, null, 2));
            return;
        }

        const createdSolveId = createData.data.createSolve.id;
        console.log(`✅ Create Success! ID: ${createdSolveId}`);

        console.log(`\n🔹 Step 2: Verifying persistence...`);

        // Small delay to ensure DB commit (usually not needed but good for tests)
        await new Promise(r => setTimeout(r, 500));

        const fetchRes = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': COOKIE
            },
            body: JSON.stringify({ query: SOLVES_QUERY })
        });

        const fetchData = await fetchRes.json();
        const solves = fetchData.data.solves;

        const found = solves.find(s => s.scramble === uniqueScramble);

        if (found) {
            console.log(`✅ Persistence Verified! Found solve:`);
            console.log(`   ID: ${found.id}`);
            console.log(`   Time: ${found.time}`);
            console.log(`   Scramble: ${found.scramble}`);
            console.log(`\n🎉 BACKEND IS WORKING CORRECTLY!`);
        } else {
            console.error("❌ Persistence Failed: Solve not found in the list.");
        }

    } catch (error) {
        console.error("❌ Script Execution Error:", error);
    }
}

runTest();
