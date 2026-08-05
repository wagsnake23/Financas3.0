import fs from "fs";
import path from "path";
import https from "https";

const envPath = path.join(process.cwd(), ".env");
let envContent = "";
try {
  envContent = fs.readFileSync(envPath, "utf-8");
} catch(e) {
  console.log("No .env found");
  process.exit(1);
}

const env = {};
envContent.split("\n").forEach(line => {
  const [key, ...rest] = line.split("=");
  if (key && rest) {
    env[key.trim()] = rest.join("=").trim();
  }
});

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log("Missing URL or KEY");
  process.exit(1);
}

function fetchSupabase(table) {
  return new Promise((resolve, reject) => {
    const req = https.request(`${url}/rest/v1/${table}?select=*`, {
      method: "GET",
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`
      }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function run() {
  const subs = await fetchSupabase("subscriptions");
  console.log("All Subscriptions:", subs);

  const profiles = await fetchSupabase("profiles");
  // Just show minimal info
  console.log("All Profiles (id only):", profiles.map(p => p.id));
}
run();
