"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Papa from "papaparse"; 
import { Upload, FileUp, Check, AlertCircle, Download, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [agencyId, setAgencyId] = useState<string | null>(null);

  useEffect(() => {
    // 1. On load, find out WHICH agency this user belongs to
    const init = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch the agency link
        const { data: member } = await supabase
            .from("agency_members")
            .select("agency_id")
            .eq("user_id", user.id)
            .single();
        
        if (member) {
            setAgencyId(member.agency_id);
            fetchLeads(member.agency_id);
        }
    };
    init();
  }, []);

  const fetchLeads = async (id: string) => {
    // 2. Only fetch leads for THIS agency
    const { data } = await supabase
        .from("leads")
        .select("*")
        .eq("agency_id", id) 
        .order('created_at', { ascending: false });
        
    if (data) setLeads(data);
  };

  const deleteLead = async (id: string) => {
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (!error) setLeads(leads.filter(lead => lead.id !== id));
  };

  const downloadTemplate = () => {
    const csvContent = "Name,Phone,Address,Price\nJohn Doe,+352691123456,10 Avenue Monterey,850000";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "thavon_leads_template.csv";
    a.click();
  };

  const handleFileUpload = (event: any) => {
    if (!agencyId) {
        setErrorMessage("Critical Error: No Agency ID found. Try logging out and back in.");
        return;
    }

    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
        setErrorMessage("Please upload a .csv file (not .xlsx). Use the template!");
        return;
    }

    setUploading(true);
    setUploadStatus("Parsing file...");
    setErrorMessage("");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        
        const formattedData = rows.map((row: any) => {
            const name = row.Name || row.name || row['First Name'];
            const phone = row.Phone || row.phone || row.Mobile || row['Phone Number'];
            
            if (!phone) return null;

            return {
              agency_id: agencyId, // <--- THE SECRET SAUCE: Tagging the data
              name: name || "Unknown Lead",
              phone_number: phone.toString().trim(),
              address: row.Address || row.address || "",
              asking_price: row.Price || row.price || "",
              status: 'new',
            };
          }).filter(Boolean); 

        if (formattedData.length === 0) {
          setErrorMessage("No valid data found.");
          setUploading(false);
          return;
        }

        const { error } = await supabase.from("leads").insert(formattedData);

        if (error) {
          setErrorMessage(`Database rejected data: ${error.message}`);
        } else {
          setUploadStatus("Success! Database updated.");
          fetchLeads(agencyId); 
        }
        setUploading(false);
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Lead Management</h1>
            <p className="text-slate-500">Import and manage your prospecting list.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={downloadTemplate} className="bg-white gap-2">
                <Download className="w-4 h-4" /> Template
            </Button>
            <div className="relative">
                <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <Button className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
                {uploading ? <Loader2 className="animate-spin w-4 h-4" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Uploading..." : "Import CSV"}
                </Button>
            </div>
          </div>
        </div>

        {errorMessage && <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2"><AlertCircle className="w-5 h-5" />{errorMessage}</div>}
        {uploadStatus && !errorMessage && <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg flex items-center gap-2"><Check className="w-5 h-5" />{uploadStatus}</div>}

        <Card className="border-none shadow-sm">
            <CardHeader className="bg-white border-b border-slate-100 rounded-t-xl"><CardTitle>All Contacts ({leads.length})</CardTitle></CardHeader>
            <CardContent className="p-0 bg-white rounded-b-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                            <tr><th className="px-6 py-4">Name</th><th className="px-6 py-4">Phone</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Address</th><th className="px-6 py-4 text-right"></th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {leads.map((lead) => (
                                <tr key={lead.id} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-4 font-medium text-slate-900">{lead.name}</td>
                                    <td className="px-6 py-4 font-mono text-slate-600">{lead.phone_number}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${lead.status === 'new' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{lead.status?.toUpperCase()}</span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">{lead.address}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => deleteLead(lead.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}