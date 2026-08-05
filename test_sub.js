import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking subscriptions...");
  const { data: subs, error: errSubs } = await supabase.from("subscriptions").select("*");
  console.log("Subscriptions Table:", subs);
  console.log("Subs Error:", errSubs);

  if (subs && subs.length > 0) {
    const userId = subs[0].user_id;
    console.log("Testing join on user_id:", userId);
    const { data: joinData, error: joinErr } = await supabase
        .from("profiles")
        .select("*, subscriptions(subscription_type, subscription_status, expires_at)")
        .eq("id", userId);
    console.log("Join Data:", JSON.stringify(joinData, null, 2));
    console.log("Join Error:", joinErr);
  }
}

run();
