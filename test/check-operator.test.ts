import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("../scripts/check-operator.ts", import.meta.url));
const dirs: string[] = [];
after(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

/** Runs the check in a directory whose only operator details are the given `.env`. */
function check(dotenv: string) {
    const dir = mkdtempSync(join(tmpdir(), "petal-operator-"));
    dirs.push(dir);
    writeFileSync(join(dir, ".env"), dotenv);
    const env = Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.startsWith("VITE_OPERATOR_")),
    );
    return spawnSync(process.execPath, [SCRIPT], { cwd: dir, env, encoding: "utf8" });
}

const complete = [
    "VITE_OPERATOR_NAME=Name",
    "VITE_OPERATOR_STREET = Street 1  ",
    "VITE_OPERATOR_CITY=City",
    "VITE_OPERATOR_EMAIL=mail@example.com",
];

describe("check-operator", () => {
    it("accepts a complete .env with LF line endings", () => {
        assert.equal(check(`${complete.join("\n")}\n`).status, 0);
    });

    it("accepts a complete .env with CRLF line endings", () => {
        assert.equal(check(`${complete.join("\r\n")}\r\n`).status, 0);
    });

    it("names the variables that are missing or blank", () => {
        const result = check(`${complete.slice(0, 2).join("\r\n")}\r\nVITE_OPERATOR_CITY=   \r\n`);
        assert.equal(result.status, 1);
        assert.match(result.stderr, /VITE_OPERATOR_CITY, VITE_OPERATOR_EMAIL/);
    });
});
