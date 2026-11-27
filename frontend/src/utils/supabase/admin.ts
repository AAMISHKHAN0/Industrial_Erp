import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function getServiceRoleKey(): string {
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set in your environment. Add it to frontend/.env.local"
    );
  }
  return serviceRoleKey;
}

export function createAdminClient() {
  return createServerClient(supabaseUrl!, getServiceRoleKey(), {
    cookies: {
      // Service-role client never reads/writes browser cookies.
      getAll() {
        return [];
      },
      setAll() {},
    },
  });
}
