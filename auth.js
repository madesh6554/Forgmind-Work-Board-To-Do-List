(function (global) {
  const SUPABASE_URL = "https://bngmhykhjrupybbutzak.supabase.co";
  const SUPABASE_KEY = "sb_publishable_ZukSuCFRk1BERSdMcgeFUA_ARNvj3jC";

  if (!global.supabase || !global.supabase.createClient) {
    console.error("Supabase client library not loaded.");
    return;
  }

  const sb = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: global.localStorage,
    },
  });

  async function getSession() {
    const { data } = await sb.auth.getSession();
    return data.session || null;
  }

  async function isLoggedIn() {
    const s = await getSession();
    return !!s;
  }

  async function currentUser() {
    const s = await getSession();
    return s ? s.user : null;
  }

  async function register(email, password) {
    email = (email || "").trim();
    if (!email || !password) return { ok: false, error: "Email and password are required." };
    if (password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) return { ok: false, error: error.message };

    if (data.session) {
      return { ok: true, needsConfirm: false };
    }
    return { ok: true, needsConfirm: true };
  }

  async function login(email, password) {
    email = (email || "").trim();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  async function logout() {
    await sb.auth.signOut();
  }

  async function requireLogin() {
    const logged = await isLoggedIn();
    if (!logged) {
      window.location.replace("login.html");
      return false;
    }
    return true;
  }

  global.sb = sb;
  global.Auth = {
    isLoggedIn,
    currentUser,
    register,
    login,
    logout,
    requireLogin,
  };
})(window);
