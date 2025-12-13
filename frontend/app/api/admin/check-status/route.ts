import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  try {
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
      return NextResponse.json({
        authenticated: false,
        error: userError?.message || 'Not authenticated'
      });
    }

    // Check admin_users table with service role (bypasses RLS)
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    // SECURITY: Only return admin user list if the current user is an admin
    // This prevents information disclosure to non-admin users
    let allAdmins = null;
    if (adminUser && adminUser.is_active) {
      const { data: admins } = await supabaseAdmin
        .from('admin_users')
        .select('user_id, email, is_active');
      allAdmins = admins;
    }

    return NextResponse.json({
      authenticated: true,
      userId: user.id,
      userEmail: user.email,
      adminCheck: {
        found: !!adminUser,
        isActive: adminUser?.is_active || false,
        adminUser: adminUser ? {
          id: adminUser.id,
          user_id: adminUser.user_id,
          email: adminUser.email,
          is_active: adminUser.is_active,
          is_active_type: typeof adminUser.is_active
        } : null,
        error: adminError?.message,
        errorCode: adminError?.code,
        errorDetails: adminError
      },
      // Only return all admins if current user is an admin (security fix)
      allAdmins: allAdmins || []
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

