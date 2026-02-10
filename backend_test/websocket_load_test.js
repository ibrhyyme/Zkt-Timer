import ws from 'k6/ws';
import { check, sleep } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 50 }, // Ramp up to 50 users
        { duration: '30s', target: 50 }, // Stay at 50
        { duration: '10s', target: 0 },  // Ramp down
    ],
};

const URL = 'ws://localhost:3000/socket.io/?EIO=4&transport=websocket';

// Using the hardcoded cookie
const COOKIE = 'session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZTc2YWU1ZDktN2Q0Zi00M2Q3LWEyZjctZjAwOThjMDk2YmFlIiwiY3JlYXRlZEF0IjoxNzY4Njk3Nzc3NTc0LCJpYXQiOjE3Njg2OTc3Nzd9.Q3rcaVoqrx_dsa8YLBheizMgVOcgcBSF-9E55bW9TS4';

export default function () {
    const params = {
        headers: {
            'Cookie': COOKIE,
        },
    };

    const res = ws.connect(URL, params, function (socket) {
        socket.on('open', function open() {
            // console.log('connected');
        });

        socket.on('message', function (message) {
            // Socket.IO Heartbeat Logic
            // 0: Open
            // 2: Ping
            // 3: Pong
            // 40: Connected
            // 42: Event

            if (message.startsWith('0')) {
                // Handshake open, looks like: 0{"sid":"...","upgrades":[],"pingInterval":25000,"pingTimeout":5000}
                // console.log('WS: Handshake received');

                // Send a test event after handshake: playerJoinedLobby
                // 42["playerJoinedLobby", { ...dummyOptions }]

                const eventData = [
                    "playerJoinedLobby",
                    {
                        game_type: "HEAD_TO_HEAD",
                        cube_type: "333",
                    }
                ];

                socket.send(`42${JSON.stringify(eventData)}`);
            }

            if (message.startsWith('2')) {
                // Ping received, send Pong
                socket.send('3');
            }

            // 40 means connected to the namespace (default /)
            // 42 means event received
        });

        socket.on('close', function () {
            // console.log('disconnected');
        });

        socket.on('error', function (e) {
            if (e.error() != 'websocket: close 1006 (abnormal closure): unexpected EOF') {
                console.log('An unexpected error occurred: ', e.error());
            }
        });

        // Keep connection alive for a bit
        socket.setTimeout(function () {
            socket.close();
        }, 10000);
    });

    check(res, { 'status is 101': (r) => r && r.status === 101 });

    sleep(1);
}
