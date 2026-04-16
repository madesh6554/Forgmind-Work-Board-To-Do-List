(function (global) {
  const ACCOUNT_KEY = "forgmind.account.v1";
  const SESSION_KEY = "forgmind.session.v1";

  async function sha256(text) {
    const buf = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function getAccount() {
    try {
      const raw = localStorage.getItem(ACCOUNT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function setAccount(acc) {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(acc));
  }

  function hasAccount() {
    return !!getAccount();
  }

  function isLoggedIn() {
    const session = sessionStorage.getItem(SESSION_KEY);
    if (!session) return false;
    const acc = getAccount();
    return !!acc && session === acc.username;
  }

  function currentUser() {
    return sessionStorage.getItem(SESSION_KEY) || null;
  }

  async function register(username, password) {
    username = (username || "").trim();
    if (username.length < 3) return { ok: false, error: "Username must be at least 3 characters." };
    if ((password || "").length < 4) return { ok: false, error: "Password must be at least 4 characters." };
    if (hasAccount()) return { ok: false, error: "An account already exists. Please log in." };

    const salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const hash = await sha256(salt + ":" + password);
    setAccount({ username, salt, hash });
    sessionStorage.setItem(SESSION_KEY, username);
    return { ok: true };
  }

  async function login(username, password) {
    const acc = getAccount();
    if (!acc) return false;
    if ((username || "").trim() !== acc.username) return false;
    const hash = await sha256(acc.salt + ":" + (password || ""));
    if (hash !== acc.hash) return false;
    sessionStorage.setItem(SESSION_KEY, acc.username);
    return true;
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function requireLogin() {
    if (!isLoggedIn()) {
      window.location.replace("login.html");
      return false;
    }
    return true;
  }

  global.Auth = {
    hasAccount,
    isLoggedIn,
    currentUser,
    register,
    login,
    logout,
    requireLogin,
  };
})(window);
