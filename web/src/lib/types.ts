export type ColumnKey = "start" | "progress" | "completed";

export type Priority = "low" | "medium" | "high";

export type DiarySource = "manual" | "task";

export interface Task {
  id: string;
  user_id: string;
  text: string;
  priority: Priority;
  column_name: ColumnKey;
  created_at: string;
}

export interface DiaryEntry {
  id: string;
  user_id: string;
  title: string | null;
  content: string;
  entry_date: string;
  source: DiarySource;
  created_at: string;
  updated_at: string | null;
}

export const COLUMN_LABEL: Record<ColumnKey, string> = {
  start: "Work Start",
  progress: "In Progress",
  completed: "Completed",
};

export interface VaultKeyRow {
  user_id: string;
  salt: string;
  verifier_iv: string;
  verifier_ciphertext: string;
  created_at: string;
}

export interface VaultEntryRow {
  id: string;
  user_id: string;
  iv: string;
  ciphertext: string;
  created_at: string;
  updated_at: string;
}

export interface VaultEntry {
  id: string;
  name: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  updatedAt: string;
  createdAt: string;
}

export interface VaultEntryPlaintext {
  name: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
}
