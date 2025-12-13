import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Verifies that the authenticated user owns the specified agency
 * @param userId - The authenticated user's ID
 * @param agencyId - The agency ID to verify ownership for
 * @returns true if user owns the agency, false otherwise
 */
export async function verifyAgencyOwnership(
  userId: string,
  agencyId: string
): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieHeader.split('; ').find(row => row.startsWith(`${name}=`))?.split('=')[1];
          },
          set() {},
          remove() {},
        },
      }
    );

    const { data: member, error } = await supabase
      .from("agency_members")
      .select("agency_id")
      .eq("user_id", userId)
      .eq("agency_id", agencyId)
      .single();

    return !!member && !error;
  } catch (error) {
    console.error("Error verifying agency ownership:", error);
    return false;
  }
}

/**
 * Gets the authenticated user and their agency ID
 * @param request - The incoming request
 * @returns Object with user and agencyId, or null if not authenticated/not a member
 */
export async function getAuthenticatedUserAndAgency(
  request: Request
): Promise<{ user: any; agencyId: string } | null> {
  try {
    const cookieHeader = request.headers.get('cookie') || '';

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieHeader.split('; ').find(row => row.startsWith(`${name}=`))?.split('=')[1];
          },
          set() {},
          remove() {},
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return null;
    }

    // Get user's agency membership
    const { data: member, error: memberError } = await supabase
      .from("agency_members")
      .select("agency_id")
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return null;
    }

    return { user, agencyId: member.agency_id };
  } catch (error) {
    console.error("Error getting authenticated user and agency:", error);
    return null;
  }
}

