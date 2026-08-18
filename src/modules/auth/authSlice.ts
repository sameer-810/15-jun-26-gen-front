import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

export type Role = "admin" | "manager" | "sales" | "inventory";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;

  /**
   * Employment record (SRS 3.1). Present only on the admin user-management
   * responses — login and /auth/me deliberately do not carry it, so salary
   * figures are not sitting in every signed-in browser's cache.
   */
  joiningDate?: string | null;
  monthlyGross?: number;
  incentiveRate?: number;
  documents?: {
    aadhaarLast4?: string;
    aadhaarUrl?: string;
    panNumber?: string;
    panUrl?: string;
    utilityBillUrl?: string;
  };
};

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
};

const STORAGE_KEY = "powergen.auth";

function loadState(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { accessToken: null, user: null };
    const parsed = JSON.parse(raw) as AuthState;
    return { accessToken: parsed.accessToken ?? null, user: parsed.user ?? null };
  } catch {
    return { accessToken: null, user: null };
  }
}

const slice = createSlice({
  name: "auth",
  initialState: loadState(),
  reducers: {
    setAuth(state, action: PayloadAction<{ accessToken: string; user: AuthUser }>) {
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
    clearAuth(state) {
      state.accessToken = null;
      state.user = null;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    },
  },
});

export const { setAuth, clearAuth } = slice.actions;
export default slice.reducer;
