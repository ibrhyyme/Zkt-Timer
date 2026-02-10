
// Removed the require because I am copying the function manually, triggering "already declared"
// const { convertTimeStringToSeconds } = require('./client/util/time'); 

function convertTimeStringToSeconds(timeString, requirePeriod = false) {
    timeString = timeString.trim().toLowerCase();
    let plusTwo = false;

    if (timeString.includes('dnf')) {
        return {
            timeSeconds: -1,
            timeMilli: -1,
            plusTwo,
            dnf: true,
        };
    }

    if (timeString.indexOf('.') > -1) {
        requirePeriod = true;
    }

    if (timeString.includes('+')) {
        plusTwo = true;
        timeString = timeString.replace(/\+2|\+/g, '');
    }

    let regex = /^(\d{1,2}:)?(\d{1,2}:)?\d{1,2}(\.\d{0,4})?$/;
    if (!requirePeriod) {
        regex = /^(\d{1,2}:)?(\d{1,2}:)?\d{1,4}(\.\d{0,4})?$/;
    }

    const test = regex.test(timeString);
    if (!test) {
        throw new Error("Regex failed");
    }

    let timeSeconds = 0;
    const parts = timeString.split(':');

    for (let i = parts.length - 1; i >= 0; i -= 1) {
        const val = parseFloat(parts[i]);
        switch (i) {
            case parts.length - 1: {
                // Seconds
                if (
                    (val >= 60 && (requirePeriod || parts.length > 1)) ||
                    (val >= 6000 && !requirePeriod && parts.length === 1)
                ) {
                    throw new Error("Seconds validation failed");
                }
                timeSeconds += val;
                break;
            }
            case parts.length - 2: {
                // Minutes
                if (val >= 60) {
                    throw new Error("Minutes validation failed");
                }
                timeSeconds += val * 60;
                break;
            }
            case parts.length - 3: {
                // Hours
                timeSeconds += val * 60 * 60;
                break;
            }
        }
    }

    if (!requirePeriod && parts.length === 1) {
        const val = parseInt(parts[0], 10);
        const centiseconds = val % 100;
        const seconds = Math.floor((val % 10000) / 100);
        const minutes = Math.floor(val / 10000);

        timeSeconds = minutes * 60 + seconds + centiseconds / 100;
    }

    const timeMilli = Math.floor(timeSeconds * 1000);
    timeSeconds = timeMilli / 1000;

    return {
        plusTwo,
        dnf: false,
        timeSeconds,
        timeMilli,
    };
}

console.log("700 ->", convertTimeStringToSeconds("700", false).timeSeconds);
console.log("1152 ->", convertTimeStringToSeconds("1152", false).timeSeconds);
console.log("5 ->", convertTimeStringToSeconds("5", false).timeSeconds);
console.log("0 ->", convertTimeStringToSeconds("0", false).timeSeconds);
