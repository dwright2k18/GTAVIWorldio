import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { VERIFIED_EDITOR_HEADER } from "@/lib/auth/constants";

import { getSupabasePublicConfig, hasSupabasePublicConfig } from "./config";

export async function refreshSupabaseSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(VERIFIED_EDITOR_HEADER);
  let refreshedCookies: Array<{
    name: string;
    value: string;
    options?: Parameters<NextResponse["cookies"]["set"]>[2];
  }> = [];
  if (!hasSupabasePublicConfig()) {
    return {
      response: NextResponse.next({ request: { headers: requestHeaders } }),
      userId: null,
    };
  }
  const { url, publishableKey } = getSupabasePublicConfig();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        refreshedCookies = cookiesToSet;
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const userId = error ? null : (data?.claims?.sub ?? null);

  if (userId) {
    requestHeaders.set(VERIFIED_EDITOR_HEADER, userId);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  refreshedCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return {
    response,
    userId,
  };
}
