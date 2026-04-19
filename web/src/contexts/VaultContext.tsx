import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  deriveKey,
  makeVerifier,
  randomSaltB64,
  verifyKey,
} from "@/lib/crypto";

export type VaultStatus = "loading" | "no-vault" | "locked" | "unlocked";

interface VaultContextValue {
  status: VaultStatus;
  key: CryptoKey | null;
  createVault: (masterPassword: string) => Promise<{ ok: boolean; error?: string }>;
  unlock: (masterPassword: string) => Promise<{ ok: boolean; error?: string }>;
  lock: () => void;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function VaultProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<VaultStatus>("loading");
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [salt, setSalt] = useState<string>("");
  const [verifierIv, setVerifierIv] = useState<string>("");
  const [verifierCiphertext, setVerifierCiphertext] = useState<string>("");

  useEffect(() => {
    if (!user) {
      setStatus("loading");
      setKey(null);
      return;
    }
    loadVaultKey();
  }, [user]);

  async function loadVaultKey() {
    if (!user) return;
    setStatus("loading");
    setKey(null);
    const { data, error } = await supabase
      .from("vault_keys")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error && error.code !== "PGRST116") {
      console.error("Vault key load failed:", error);
    }
    if (data) {
      setSalt(data.salt);
      setVerifierIv(data.verifier_iv);
      setVerifierCiphertext(data.verifier_ciphertext);
      setStatus("locked");
    } else {
      setSalt("");
      setVerifierIv("");
      setVerifierCiphertext("");
      setStatus("no-vault");
    }
  }

  async function createVault(masterPassword: string) {
    if (!user) return { ok: false, error: "Not logged in." };
    if (masterPassword.length < 8) {
      return { ok: false, error: "Master password must be at least 8 characters." };
    }
    try {
      const newSalt = randomSaltB64();
      const derived = await deriveKey(masterPassword, newSalt);
      const verifier = await makeVerifier(derived);
      const { error } = await supabase.from("vault_keys").insert({
        user_id: user.id,
        salt: newSalt,
        verifier_iv: verifier.verifier_iv,
        verifier_ciphertext: verifier.verifier_ciphertext,
      });
      if (error) return { ok: false, error: error.message };
      setSalt(newSalt);
      setVerifierIv(verifier.verifier_iv);
      setVerifierCiphertext(verifier.verifier_ciphertext);
      setKey(derived);
      setStatus("unlocked");
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async function unlock(masterPassword: string) {
    if (!user || !salt) return { ok: false, error: "Vault not initialized." };
    try {
      const derived = await deriveKey(masterPassword, salt);
      const ok = await verifyKey(derived, verifierIv, verifierCiphertext);
      if (!ok) return { ok: false, error: "Incorrect master password." };
      setKey(derived);
      setStatus("unlocked");
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  function lock() {
    setKey(null);
    if (salt) setStatus("locked");
    else setStatus("no-vault");
  }

  return (
    <VaultContext.Provider value={{ status, key, createVault, unlock, lock }}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used within VaultProvider");
  return ctx;
}
