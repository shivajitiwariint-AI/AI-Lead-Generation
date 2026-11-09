const fs = require("fs");
const env = {};
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
console.log("key len from env file:", env.CREDENTIAL_ENCRYPTION_KEY?.length);
console.log("process.env len:", process.env.CREDENTIAL_ENCRYPTION_KEY?.length);
