"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Phone, Play, Download, Search, Filter, Calendar, User, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface CallLog {
  id: string;
  lead_id: string | null;
  agent_id: string | null;
  status: string;
  duration_seconds: number | null;
  recording_url: string | null;
  transcript: string | null;
  summary: string | null;
  language: string | null;
  created_at: string;
  leads?: {
    name: string;
    phone_number: string;
  } | null;
  agents?: {
    name: string;
  } | null;
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [filteredCalls, setFilteredCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from("agency_members")
        .select("agency_id, role")
        .eq("user_id", user.id)
        .single();

      if (member) {
        setAgencyId(member.agency_id);
        await fetchCalls(member.agency_id, member.role);
      }
    };
    init();
  }, []);

  useEffect(() => {
    filterCalls();
  }, [calls, searchQuery, statusFilter, dateFilter]);

  const fetchCalls = async (id: string, role: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from("call_logs")
        .select(`
          *,
          leads:lead_id (name, phone_number),
          agents:agent_id (name)
        `)
        .eq("agency_id", id)
        .order("created_at", { ascending: false });

      // If user is an agent (not owner), filter by agent_id
      if (role !== "owner") {
        // Get agent ID for this user
        const { data: agent } = await supabase
          .from("agents")
          .select("id")
          .eq("agency_id", id)
          .single(); // This assumes one agent per user - adjust if needed

        if (agent) {
          query = query.eq("agent_id", agent.id);
        }
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;
      setCalls(data || []);
    } catch (error: any) {
      console.error("Error fetching calls:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterCalls = () => {
    let filtered = [...calls];

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((call) => call.status === statusFilter);
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const filterDate = new Date();
      
      if (dateFilter === "today") {
        filterDate.setHours(0, 0, 0, 0);
        filtered = filtered.filter(
          (call) => new Date(call.created_at) >= filterDate
        );
      } else if (dateFilter === "week") {
        filterDate.setDate(now.getDate() - 7);
        filtered = filtered.filter(
          (call) => new Date(call.created_at) >= filterDate
        );
      } else if (dateFilter === "month") {
        filterDate.setMonth(now.getMonth() - 1);
        filtered = filtered.filter(
          (call) => new Date(call.created_at) >= filterDate
        );
      }
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (call) =>
          call.leads?.name?.toLowerCase().includes(query) ||
          call.leads?.phone_number?.includes(query) ||
          call.transcript?.toLowerCase().includes(query) ||
          call.summary?.toLowerCase().includes(query) ||
          call.agents?.name?.toLowerCase().includes(query)
      );
    }

    setFilteredCalls(filtered);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      completed: { label: "Completed", variant: "default" },
      no_answer: { label: "No Answer", variant: "secondary" },
      busy: { label: "Busy", variant: "secondary" },
      failed: { label: "Failed", variant: "destructive" },
      cancelled: { label: "Cancelled", variant: "outline" },
    };

    const config = statusConfig[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Call History</h1>
          <p className="text-slate-500">
            View all call recordings, transcripts, and summaries
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6 border-none shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search calls..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="no_answer">No Answer</SelectItem>
                  <SelectItem value="busy">Busy</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {/* Date Filter */}
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>

              {/* Results Count */}
              <div className="flex items-center text-sm text-slate-500">
                {filteredCalls.length} {filteredCalls.length === 1 ? "call" : "calls"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Calls List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-400">Loading calls...</p>
          </div>
        ) : filteredCalls.length === 0 ? (
          <Card className="border-none shadow-sm">
            <CardContent className="p-12 text-center">
              <Phone className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-400">No calls found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredCalls.map((call) => (
              <Card key={call.id} className="border-none shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-3">
                        {getStatusBadge(call.status)}
                        <span className="text-sm text-slate-500">
                          {formatDate(call.created_at)}
                        </span>
                        {call.duration_seconds && (
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <Clock className="w-4 h-4" />
                            {formatDuration(call.duration_seconds)}
                          </div>
                        )}
                        {call.language && (
                          <Badge variant="outline" className="text-xs">
                            {call.language.toUpperCase()}
                          </Badge>
                        )}
                      </div>

                      {/* Lead Info */}
                      {call.leads && (
                        <div className="mb-3">
                          <h3 className="font-semibold text-slate-900">
                            {call.leads.name}
                          </h3>
                          <p className="text-sm text-slate-500">
                            {call.leads.phone_number}
                          </p>
                        </div>
                      )}

                      {/* Agent Info */}
                      {call.agents && (
                        <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
                          <User className="w-4 h-4" />
                          <span>Agent: {call.agents.name}</span>
                        </div>
                      )}

                      {/* Summary */}
                      {call.summary && (
                        <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                          {call.summary}
                        </p>
                      )}

                      {/* Transcript Preview */}
                      {call.transcript && (
                        <details className="mb-3">
                          <summary className="text-sm text-violet-600 cursor-pointer hover:text-violet-700">
                            View Transcript
                          </summary>
                          <div className="mt-2 p-3 bg-slate-50 rounded text-sm text-slate-700 max-h-40 overflow-y-auto">
                            {call.transcript}
                          </div>
                        </details>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 ml-4">
                      {call.recording_url && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(call.recording_url!, "_blank")}
                            className="w-full"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Play
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const link = document.createElement("a");
                              link.href = call.recording_url!;
                              link.download = `call-${call.id}.mp3`;
                              link.click();
                            }}
                            className="w-full"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

