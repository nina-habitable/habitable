import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://enjqwfxtwokyeplwpzoi.supabase.co";

export const supabase = createClient(
  supabaseUrl,
  "sb_publishable_xmVwtEldnHRlGvJ4QHe6UQ_s-EtQC_a"
);

export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SECRET_KEY!
);
