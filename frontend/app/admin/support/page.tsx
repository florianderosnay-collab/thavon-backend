"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Filter, CheckCircle2, XCircle, Clock, 
  AlertCircle, MessageSquare, Mail, Phone, Calendar,
  ChevronDown, ChevronUp, Eye, Edit
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

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    filterTickets();
  }, [searchQuery, statusFilter, priorityFilter, tickets]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      // Fetch all tickets (admin access - bypasses RLS with service role in API route)
      const { data, error } = await supabase
        .from("support_tickets")
        .select(`
          *,
          agency:agencies(name)
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching tickets:", error);
        // If direct access fails, use API route
        const response = await fetch("/api/admin/support/tickets");
        if (response.ok) {
          const ticketsData = await response.json();
          setTickets(ticketsData);
        }
      } else {
        setTickets(data || []);
      }
    } catch (error) {
      console.error("Error:", error);
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

