"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Trash2, User, MapPin, Calendar, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function TeamPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form State
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newZip, setNewZip] = useState("");
  const [newCalendar, setNewCalendar] = useState("");

  useEffect(() => {
    const init = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: member } = await supabase
            .from("agency_members")
            .select("agency_id")
            .eq("user_id", user.id)
            .single();
        
        if (member) {
            setAgencyId(member.agency_id);
            fetchAgents(member.agency_id);
        }
    };
    init();
  }, []);

  const fetchAgents = async (id: string) => {
    const { data } = await supabase
        .from("agents")
        .select("*")
        .eq("agency_id", id)
        .order('created_at', { ascending: false });
    if (data) setAgents(data);
  };

  const addAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyId) return;
    setLoading(true);

    const { error } = await supabase.from("agents").insert({
        agency_id: agencyId,
        name: newName,
        phone_number: newPhone,
        territory_zip: newZip || null, // Optional
        calendar_link: newCalendar
    });

    if (!error) {
        // Reset form and refresh
        setNewName("");
        setNewPhone("");
        setNewZip("");
        setNewCalendar("");
        fetchAgents(agencyId);
    } else {
        alert("Error adding agent: " + error.message);
    }
    setLoading(false);
  };

  const deleteAgent = async (id: string) => {
    await supabase.from("agents").delete().eq("id", id);
    setAgents(agents.filter(a => a.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Team Management</h1>
            <p className="text-slate-500">Add your agents to the "Bullpen". The AI will route appointments to them.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* LEFT: ADD AGENT FORM */}
            <Card className="h-fit border-none shadow-sm">
                <CardHeader>
                    <CardTitle>Add New Agent</CardTitle>
                    <CardDescription>Enter their details for the dispatcher.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={addAgent} className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Full Name</label>
                            <Input placeholder="e.g. John Doe" value={newName} onChange={e => setNewName(e.target.value)} required />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Phone (WhatsApp Capable)</label>
                            <Input placeholder="+352..." value={newPhone} onChange={e => setNewPhone(e.target.value)} required />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Calendar Link</label>
                            <Input placeholder="cal.com/john" value={newCalendar} onChange={e => setNewCalendar(e.target.value)} required />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase">Territory Zip (Optional)</label>
                            <Input placeholder="e.g. 8001" value={newZip} onChange={e => setNewZip(e.target.value)} />
                            <p className="text-[10px] text-slate-400 mt-1">Leave empty if they cover all areas.</p>
                        </div>
                        <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white" disabled={loading}>
                            {loading ? "Adding..." : "Add to Team"}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* RIGHT: AGENT LIST */}
            <div className="lg:col-span-2 space-y-4">
                {agents.length === 0 && (
                    <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-xl">
                        <p className="text-slate-400">No agents found. Add one to start routing calls.</p>
                    </div>
                )}
                
                {agents.map((agent) => (
                    <Card key={agent.id} className="border-none shadow-sm hover:shadow-md transition-all">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center font-bold text-lg">
                                    {agent.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">{agent.name}</h3>
                                    <div className="flex items-center gap-4 mt-1">
                                        <div className="flex items-center gap-1 text-xs text-slate-500">
                                            <Phone className="w-3 h-3" /> {agent.phone_number}
                                        </div>
                                        {agent.territory_zip ? (
                                            <div className="flex items-center gap-1 text-xs text-violet-600 font-medium bg-violet-50 px-2 py-0.5 rounded">
                                                <MapPin className="w-3 h-3" /> Area: {agent.territory_zip}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                                <MapPin className="w-3 h-3" /> Global
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => deleteAgent(agent.id)} className="text-slate-300 hover:text-red-500 transition-colors p-2">
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
}