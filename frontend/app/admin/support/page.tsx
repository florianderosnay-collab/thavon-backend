"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Filter, CheckCircle2, XCircle, Clock, 
  AlertCircle, MessageSquare, Mail, Phone, Calendar,
  ChevronDown, ChevronUp, Eye, Edit, Loader2
} from "lucide-react";

interface SupportTicket {
  id: string;
  agency_id: string;
  name: string;
  email: string;
  subject: string;
  category: string;
  priority: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  admin_notes: string | null;
  agency?: {
    name: string;
  };
}

const PRIORITY_COLORS = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const STATUS_COLORS = {
  open: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-blue-100 text-blue-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-slate-100 text-slate-700",
};

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [updating, setUpdating] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  // Check admin access on mount
  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin/support/page.tsx:64',message:'Checking admin access - user fetch',data:{hasUser:!!user,userId:user?.id,userEmail:user?.email,userError:userError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'admin-check',hypothesisId:'D'})}).catch(()=>{});
        // #endregion

        if (!user) {
          console.error('❌ No authenticated user found');
          setIsAdmin(false);
          setCheckingAccess(false);
          return;
        }

        // Log user ID for debugging
        console.log('🔍 Checking admin access for user:', {
          userId: user.id,
          userEmail: user.email,
          expectedUserId: '745e11f8-6665-4f7d-8845-bb0225b4b164' // From SQL file
        });

        // Check if user is admin - try without is_active filter first to see what we get
        const { data: adminUserWithoutFilter, error: errorWithoutFilter } = await supabase
          .from('admin_users')
          .select('id, user_id, email, is_active')
          .eq('user_id', user.id)
          .maybeSingle();

        console.log('🔍 Admin check (without is_active filter):', {
          found: !!adminUserWithoutFilter,
          adminUser: adminUserWithoutFilter,
          error: errorWithoutFilter?.message,
          errorCode: errorWithoutFilter?.code
        });

        // Now try with is_active filter
        const { data: adminUser, error } = await supabase
          .from('admin_users')
          .select('id, user_id, email, is_active')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin/support/page.tsx:95',message:'Admin check result',data:{userId:user.id,hasAdminUser:!!adminUser,adminUserId:adminUser?.user_id,adminEmail:adminUser?.email,adminIsActive:adminUser?.is_active,isActiveType:typeof adminUser?.is_active,error:error?.message,errorCode:error?.code,errorDetails:error,withoutFilter:!!adminUserWithoutFilter},timestamp:Date.now(),sessionId:'debug-session',runId:'admin-check',hypothesisId:'E'})}).catch(()=>{});
        // #endregion

        console.log('🔍 Admin check (with is_active=true filter):', {
          found: !!adminUser,
          adminUser: adminUser,
          error: error?.message,
          errorCode: error?.code
        });

        // If no admin user found, check if it's because is_active is a string
        if (!adminUser && adminUserWithoutFilter) {
          console.log('⚠️ Admin user found but is_active filter failed. Checking is_active value:', {
            is_active: adminUserWithoutFilter.is_active,
            is_active_type: typeof adminUserWithoutFilter.is_active,
            is_active_value: JSON.stringify(adminUserWithoutFilter.is_active)
          });
          
          // If is_active is string 'true', use that user
          if (adminUserWithoutFilter.is_active === 'true' || adminUserWithoutFilter.is_active === true) {
            console.log('✅ Using admin user despite is_active filter issue');
            setIsAdmin(true);
            setCheckingAccess(false);
            fetchTickets();
            return;
          }
        }

        if (error || !adminUser) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin/support/page.tsx:120',message:'Admin access denied',data:{userId:user.id,reason:error?.message || 'No admin user found',errorCode:error?.code,hasUserWithoutFilter:!!adminUserWithoutFilter},timestamp:Date.now(),sessionId:'debug-session',runId:'admin-check',hypothesisId:'F'})}).catch(()=>{});
          // #endregion
          
          console.error('❌ Admin access denied:', {
            userId: user.id,
            reason: error?.message || 'No admin user found',
            errorCode: error?.code,
            foundWithoutFilter: !!adminUserWithoutFilter
          });
          
          setIsAdmin(false);
          setCheckingAccess(false);
          // Show alert with user ID for debugging
          alert(`Admin access denied.\n\nYour User ID: ${user.id}\n\nPlease verify this matches the user_id in the admin_users table.\n\nExpected: 745e11f8-6665-4f7d-8845-bb0225b4b164`);
          // Redirect to dashboard with error message
          window.location.href = '/?error=admin-access-denied';
          return;
        }

        setIsAdmin(true);
        setCheckingAccess(false);
        fetchTickets();
      } catch (error: any) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/da82e913-c8ed-438b-b73c-47e584596160',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin/support/page.tsx:140',message:'Error in admin check',data:{errorMessage:error?.message,errorStack:error?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'admin-check',hypothesisId:'G'})}).catch(()=>{});
        // #endregion
        console.error('❌ Error checking admin access:', error);
        setIsAdmin(false);
        setCheckingAccess(false);
        window.location.href = '/?error=admin-access-denied';
      }
    };

    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      filterTickets();
    }
  }, [searchQuery, statusFilter, priorityFilter, tickets, isAdmin]);

  const fetchTickets = async () => {
    if (!isAdmin) return; // Don't fetch if not admin
    
    try {
      setLoading(true);
      // Use API route which has admin authentication
      const response = await fetch("/api/admin/support/tickets");
      
      if (!response.ok) {
        if (response.status === 403) {
          // Not authorized - redirect to dashboard
          window.location.href = '/?error=admin-access-denied';
          return;
        }
        throw new Error(`Failed to fetch tickets: ${response.statusText}`);
      }

      const ticketsData = await response.json();
      setTickets(ticketsData || []);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      alert("Failed to load support tickets. You may not have admin access.");
    } finally {
      setLoading(false);
    }
  };

  const filterTickets = () => {
    let filtered = [...tickets];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (ticket) =>
          ticket.name.toLowerCase().includes(query) ||
          ticket.email.toLowerCase().includes(query) ||
          ticket.subject.toLowerCase().includes(query) ||
          ticket.message.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((ticket) => ticket.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== "all") {
      filtered = filtered.filter((ticket) => ticket.priority === priorityFilter);
    }

    setFilteredTickets(filtered);
  };

  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      setUpdating(true);
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === "resolved" || newStatus === "closed") {
        updateData.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("support_tickets")
        .update(updateData)
        .eq("id", ticketId);

      if (error) throw error;

      // Update local state
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === ticketId ? { ...ticket, ...updateData } : ticket
        )
      );

      if (selectedTicket?.id === ticketId) {
        setSelectedTicket((prev) =>
          prev ? { ...prev, ...updateData } : null
        );
      }
    } catch (error: any) {
      alert(`Error updating ticket: ${error.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const saveAdminNotes = async (ticketId: string) => {
    try {
      setUpdating(true);
      const { error } = await supabase
        .from("support_tickets")
        .update({
          admin_notes: adminNotes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ticketId);

      if (error) throw error;

      // Update local state
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === ticketId
            ? { ...ticket, admin_notes: adminNotes }
            : ticket
        )
      );

      if (selectedTicket?.id === ticketId) {
        setSelectedTicket((prev) =>
          prev ? { ...prev, admin_notes: adminNotes } : null
        );
      }

      alert("Admin notes saved successfully!");
    } catch (error: any) {
      alert(`Error saving notes: ${error.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    inProgress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    critical: tickets.filter((t) => t.priority === "critical").length,
  };

  // Show loading state while checking admin access
  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto mb-4" />
            <p className="text-slate-600">Verifying admin access...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show access denied if not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="border-none shadow-sm bg-white">
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
            <p className="text-slate-600 mb-6">
              You don't have permission to access the admin dashboard.
            </p>
            <Button onClick={() => window.location.href = '/'} className="bg-violet-600 hover:bg-violet-700 text-white">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Support Tickets</h1>
          <p className="text-slate-600 text-lg">
            Manage and respond to customer support requests
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
              <div className="text-sm text-slate-600">Total Tickets</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">{stats.open}</div>
              <div className="text-sm text-slate-600">Open</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
              <div className="text-sm text-slate-600">In Progress</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
              <div className="text-sm text-slate-600">Resolved</div>
            </CardContent>
          </Card>
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
              <div className="text-sm text-slate-600">Critical</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6 border-none shadow-sm bg-white">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search tickets by name, email, subject..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Tickets List */}
        {loading ? (
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-12 text-center">
              <div className="text-slate-400">Loading tickets...</div>
            </CardContent>
          </Card>
        ) : filteredTickets.length === 0 ? (
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-12 text-center">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <div className="text-slate-400">No tickets found</div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredTickets.map((ticket) => (
              <Card
                key={ticket.id}
                className={`border-none shadow-sm bg-white cursor-pointer hover:shadow-md transition-shadow ${
                  selectedTicket?.id === ticket.id ? "ring-2 ring-violet-500" : ""
                }`}
                onClick={() => {
                  setSelectedTicket(ticket);
                  setAdminNotes(ticket.admin_notes || "");
                }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-slate-900">{ticket.subject}</h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            PRIORITY_COLORS[ticket.priority as keyof typeof PRIORITY_COLORS]
                          }`}
                        >
                          {ticket.priority}
                        </span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            STATUS_COLORS[ticket.status as keyof typeof STATUS_COLORS]
                          }`}
                        >
                          {ticket.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {ticket.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {getTimeAgo(ticket.created_at)}
                        </span>
                        <span className="capitalize">{ticket.category}</span>
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2">{ticket.message}</p>
                    </div>
                    <div className="ml-4">
                      {selectedTicket?.id === ticket.id ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded View */}
                  {selectedTicket?.id === ticket.id && (
                    <div className="mt-6 pt-6 border-t border-slate-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-semibold text-slate-900 mb-4">Ticket Details</h4>
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="text-slate-500">From:</span>
                              <div className="font-medium text-slate-900">{ticket.name}</div>
                              <div className="text-slate-600">{ticket.email}</div>
                            </div>
                            <div>
                              <span className="text-slate-500">Category:</span>
                              <div className="font-medium text-slate-900 capitalize">{ticket.category}</div>
                            </div>
                            <div>
                              <span className="text-slate-500">Created:</span>
                              <div className="font-medium text-slate-900">
                                {new Date(ticket.created_at).toLocaleString()}
                              </div>
                            </div>
                            {ticket.resolved_at && (
                              <div>
                                <span className="text-slate-500">Resolved:</span>
                                <div className="font-medium text-slate-900">
                                  {new Date(ticket.resolved_at).toLocaleString()}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900 mb-4">Message</h4>
                          <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">
                            {ticket.message}
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 pt-6 border-t border-slate-200">
                        <h4 className="font-semibold text-slate-900 mb-4">Admin Notes</h4>
                        <textarea
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          className="w-full min-h-[100px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
                          placeholder="Add internal notes about this ticket..."
                        />
                        <div className="flex gap-3 mt-4">
                          <Button
                            size="sm"
                            onClick={() => saveAdminNotes(ticket.id)}
                            disabled={updating}
                            className="bg-violet-600 hover:bg-violet-700 text-white"
                          >
                            Save Notes
                          </Button>
                        </div>
                      </div>

                      <div className="mt-6 pt-6 border-t border-slate-200">
                        <h4 className="font-semibold text-slate-900 mb-4">Actions</h4>
                        <div className="flex flex-wrap gap-3">
                          {ticket.status !== "in_progress" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateTicketStatus(ticket.id, "in_progress")}
                              disabled={updating}
                            >
                              Mark In Progress
                            </Button>
                          )}
                          {ticket.status !== "resolved" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateTicketStatus(ticket.id, "resolved")}
                              disabled={updating}
                              className="border-green-200 text-green-700 hover:bg-green-50"
                            >
                              Mark Resolved
                            </Button>
                          )}
                          {ticket.status !== "closed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateTicketStatus(ticket.id, "closed")}
                              disabled={updating}
                            >
                              Close Ticket
                            </Button>
                          )}
                          <a href={`mailto:${ticket.email}?subject=Re: ${ticket.subject}`}>
                            <Button size="sm" variant="outline">
                              <Mail className="w-4 h-4 mr-2" />
                              Reply via Email
                            </Button>
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

