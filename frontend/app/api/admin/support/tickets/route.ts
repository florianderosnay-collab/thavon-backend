import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAdminAccess(request: Request): Promise<{ isAdmin: boolean; userId?: string; error?: string }> {
  try {
    // Get cookies from request
    const cookieStore = await cookies();
    const cookieHeader = request.headers.get('cookie') || '';

    // Create Supabase client with cookies
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
      return { isAdmin: false, error: 'Not authenticated' };
    }

    // Check if user is admin using the is_admin function
    const { data: isAdmin, error: adminError } = await supabaseAdmin
      .rpc('is_admin', { user_uuid: user.id })
      .single();

    if (adminError) {
      console.error('Error checking admin status:', adminError);
      // Fallback: check admin_users table directly
      const { data: adminUser, error: checkError } = await supabaseAdmin
        .from('admin_users')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (checkError || !adminUser) {
        return { isAdmin: false, userId: user.id, error: 'Not an admin' };
      }
      return { isAdmin: true, userId: user.id };
    }

    return { isAdmin: !!isAdmin, userId: user.id };
  } catch (error: any) {
    console.error('Error in checkAdminAccess:', error);
    return { isAdmin: false, error: error.message };
  }
}

export async function GET(request: Request) {
  try {
    // Check admin access
    const { isAdmin, userId, error } = await checkAdminAccess(request);

    if (!isAdmin) {
      console.log(`❌ Admin API access denied for user ${userId}:`, error);
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 403 }
      );
    }

    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from("support_tickets")
      .select(`
        *,
        agency:agencies(name)
      `)
      .order("created_at", { ascending: false });

    if (ticketsError) {
      console.error("Error fetching tickets:", ticketsError);
      return NextResponse.json(
        { error: "Failed to fetch tickets" },
        { status: 500 }
      );
    }

    return NextResponse.json(tickets || []);
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

