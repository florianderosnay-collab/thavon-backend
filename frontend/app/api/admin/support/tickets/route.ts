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

    // Check if user is admin - use direct table query (more reliable)
    // Try both boolean true and string 'true' for is_active (in case of data type mismatch)
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('id, user_id, email, is_active')
      .eq('user_id', user.id)
      .or('is_active.eq.true,is_active.eq."true"')
      .single();

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/admin/support/tickets/route.ts:40',message:'Admin check in API route',data:{userId:user.id,userEmail:user.email,hasAdminUser:!!adminUser,adminUserId:adminUser?.user_id,adminEmail:adminUser?.email,adminIsActive:adminUser?.is_active,error:adminError?.message,errorCode:adminError?.code},timestamp:Date.now(),sessionId:'debug-session',runId:'admin-api-check',hypothesisId:'H'})}).catch(()=>{});
    // #endregion

    if (adminError || !adminUser) {
      return { isAdmin: false, userId: user.id, error: adminError?.message || 'Not an admin' };
    }

    return { isAdmin: true, userId: user.id };
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

