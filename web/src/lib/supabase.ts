import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bngmhykhjrupybbutzak.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZukSuCFRk1BERSdMcgeFUA_ARNvj3jC";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: globalThis.localStorage,
  },
});
