"use client";

import { api } from "@/lib/api/client";

export interface CompanyProfile {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  city?: string;
  country?: string;
}

const STORAGE_KEY = "active_company_profile";

/**
 * Synchronously retrieves cached company profile from localStorage.
 * Guaranteed to return safe fallback values.
 */
export function getStoredCompany(): CompanyProfile {
  if (typeof window === "undefined") {
    return {
      name: "Industrial ERP",
      email: "",
      phone: "",
      address: "",
      taxNumber: "",
      city: "",
      country: "",
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.name) {
        return {
          id: parsed.id || "",
          name: parsed.name,
          email: parsed.email || "",
          phone: parsed.phone || "",
          address: parsed.address || "",
          taxNumber: parsed.taxNumber || parsed.taxId || "",
          city: parsed.city || "",
          country: parsed.country || "",
        };
      }
    }
  } catch {}

  return {
    name: "Industrial ERP",
    email: "",
    phone: "",
    address: "",
    taxNumber: "",
    city: "",
    country: "",
  };
}

/**
 * Persists updated company profile to localStorage and broadcasts update event.
 */
export function saveStoredCompany(profile: Partial<CompanyProfile>): CompanyProfile {
  const current = getStoredCompany();
  const updated: CompanyProfile = {
    ...current,
    ...profile,
    name: (profile.name || current.name || "Industrial ERP").trim(),
    taxNumber: (profile.taxNumber || (profile as any).taxId || current.taxNumber || "").trim(),
  };

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("company-profile-updated", { detail: updated }));
    } catch {}
  }

  return updated;
}

/**
 * Fetches the active company profile from the database via REST API
 * and refreshes the localStorage cache.
 */
export async function fetchCompanyProfile(): Promise<CompanyProfile> {
  try {
    const res = await api.getWithMeta<any[]>("/master-data/company?limit=1");
    if (res && res.data && res.data.length > 0) {
      const raw = res.data[0];
      return saveStoredCompany({
        id: raw.id,
        name: raw.name,
        email: raw.email || "",
        phone: raw.phone || "",
        address: raw.address || "",
        taxNumber: raw.taxNumber || "",
        city: raw.city || "",
        country: raw.country || "",
      });
    }
  } catch {
    // If not reachable, check /auth/me fallback
    try {
      const meRes = await api.get<any>("/auth/me");
      if (meRes && meRes.company) {
        return saveStoredCompany(meRes.company);
      }
    } catch {}
  }

  return getStoredCompany();
}
