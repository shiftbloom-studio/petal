// Stops a production build when the imprint would be incomplete. The operator details are build
// variables (see .env.example), so a missing one would otherwise ship an empty imprint.
import { existsSync, readFileSync } from "node:fs";

const fromFile: Record<string, string> = {};
if (existsSync(".env")) {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (match) fromFile[match[1]] = match[2];
    }
}

const required = [
    "VITE_OPERATOR_NAME",
    "VITE_OPERATOR_STREET",
    "VITE_OPERATOR_CITY",
    "VITE_OPERATOR_EMAIL",
];
const missing = required.filter((key) => !(process.env[key] ?? fromFile[key])?.trim());
if (missing.length > 0) {
    console.error(`Missing imprint build variables: ${missing.join(", ")}. See .env.example.`);
    process.exit(1);
}
