"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Calendar, Clock, User, MapPin, Phone, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface Appointment {
  id: string;
  lead_id: string;
  agent_id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
  calendar_event_id: string | null;
  leads?: {
    name: string;
    phone_number: string;
    address: string;
  } | null;
  agents?: {
    name: string;
  } | null;
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("upcoming");

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
        await fetchAppointments(member.agency_id, member.role);
      }
    };
    init();
  }, []);

  useEffect(() => {
    filterAppointments();
  }, [appointments, statusFilter, dateFilter]);

  const fetchAppointments = async (id: string, role: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from("appointments")
        .select(`
          *,
          leads:lead_id (name, phone_number, address),
          agents:agent_id (name)
        `)
        .eq("agency_id", id)
        .order("scheduled_at", { ascending: true });

      // If user is an agent (not owner), filter by agent_id
      if (role !== "owner") {
        const { data: agent } = await supabase
          .from("agents")
          .select("id")
          .eq("agency_id", id)
          .single();

        if (agent) {
          query = query.eq("agent_id", agent.id);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setAppointments(data || []);
    } catch (error: any) {
      console.error("Error fetching appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterAppointments = () => {
    let filtered = [...appointments];

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((apt) => apt.status === statusFilter);
    }

    // Date filter
    const now = new Date();
    if (dateFilter === "upcoming") {
      filtered = filtered.filter(
        (apt) => new Date(apt.scheduled_at) >= now && apt.status !== "cancelled"
      );
    } else if (dateFilter === "past") {
      filtered = filtered.filter((apt) => new Date(apt.scheduled_at) < now);
    } else if (dateFilter === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      filtered = filtered.filter(
        (apt) =>
          new Date(apt.scheduled_at) >= today &&
          new Date(apt.scheduled_at) < tomorrow
      );
    }

    setFilteredAppointments(filtered);
  };

  const updateAppointmentStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from("appointments")
      .update({ status: newStatus })
      .eq("id", id);

    if (!error && agencyId) {
      const { data: member } = await supabase
        .from("agency_members")
        .select("role")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
        .single();
      
      if (member) {
        await fetchAppointments(agencyId, member.role);
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      scheduled: { label: "Scheduled", variant: "default" },
      completed: { label: "Completed", variant: "secondary" },
      cancelled: { label: "Cancelled", variant: "destructive" },
      no_show: { label: "No Show", variant: "outline" },
      rescheduled: { label: "Rescheduled", variant: "outline" },
    };

    const config = statusConfig[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const isUpcoming = (dateString: string) => {
    return new Date(dateString) >= new Date();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Appointments</h1>
          <p className="text-slate-500">
            Manage all scheduled appointments and view calendar events
          </p>
        </div>

        {/* Filters */}
        <Card className="mb-6 border-none shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                </SelectContent>
              </Select>

              {/* Date Filter */}
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="past">Past</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>

              {/* Results Count */}
              <div className="flex items-center text-sm text-slate-500">
                {filteredAppointments.length} {filteredAppointments.length === 1 ? "appointment" : "appointments"}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appointments List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-slate-400">Loading appointments...</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <Card className="border-none shadow-sm">
            <CardContent className="p-12 text-center">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-400">No appointments found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredAppointments.map((appointment) => (
              <Card
                key={appointment.id}
                className={`border-none shadow-sm hover:shadow-md transition-shadow ${
                  isUpcoming(appointment.scheduled_at) && appointment.status === "scheduled"
                    ? "border-l-4 border-l-violet-600"
                    : ""
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Header */}
                      <div className="flex items-center gap-3 mb-3">
                        {getStatusBadge(appointment.status)}
                        <div className="flex items-center gap-1 text-sm text-slate-500">
                          <Clock className="w-4 h-4" />
                          {formatDate(appointment.scheduled_at)}
                        </div>
                        {appointment.agents && (
                          <div className="flex items-center gap-1 text-sm text-slate-500">
                            <User className="w-4 h-4" />
                            {appointment.agents.name}
                          </div>
                        )}
                        {appointment.calendar_event_id && (
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="w-3 h-3 mr-1" />
                            Synced
                          </Badge>
                        )}
                      </div>

                      {/* Lead Info */}
                      {appointment.leads && (
                        <div className="mb-3">
                          <h3 className="font-semibold text-slate-900 text-lg mb-2">
                            {appointment.leads.name}
                          </h3>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Phone className="w-4 h-4" />
                              {appointment.leads.phone_number}
                            </div>
                            {appointment.leads.address && (
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <MapPin className="w-4 h-4" />
                                {appointment.leads.address}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {appointment.notes && (
                        <div className="mb-3 p-3 bg-slate-50 rounded text-sm text-slate-700">
                          <strong>Notes:</strong> {appointment.notes}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 ml-4">
                      {appointment.status === "scheduled" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateAppointmentStatus(appointment.id, "completed")}
                            className="w-full"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Mark Complete
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateAppointmentStatus(appointment.id, "cancelled")}
                            className="w-full text-red-600 hover:text-red-700"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Cancel
                          </Button>
                        </>
                      )}
                      {appointment.status === "scheduled" && appointment.calendar_event_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            window.open(
                              `https://calendar.google.com/calendar/event?eid=${appointment.calendar_event_id}`,
                              "_blank"
                            );
                          }}
                          className="w-full"
                        >
                          <Calendar className="w-4 h-4 mr-2" />
                          View in Calendar
                        </Button>
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

