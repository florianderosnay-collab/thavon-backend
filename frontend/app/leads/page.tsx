"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Papa from "papaparse"; // CSV Parser
import { Upload, FileUp, Check, AlertCircle, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  // 1. Fetch Leads on Load
  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    // In real version, we filter by authenticated Agency ID
    const { data, error } = await supabase.from("leads").select("*").order('created_at', { ascending: false });
    if (data) setLeads(data);
  };

  // 2. Handle CSV Upload
  const handleFileUpload = (event: any) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus("Parsing file...");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        console.log("Parsed CSV:", rows);
        
        setUploadStatus(`Uploading ${rows.length} contacts...`);

        // Map CSV columns to Database columns
        // Expects CSV headers: Name, Phone, Address, Price
        const formattedData = rows.map((row: any) => ({
          name: row.Name || row.name || "Unknown",
          phone_number: row.Phone || row.phone || row.phone_number,
          address: row.Address || row.address || "",
          asking_price: row.Price || row.price || "",
          status: 'new',
          // HARDCODED AGENCY ID FOR NOW - We fix this with Auth next
          // agency_id: 'YOUR_AGENCY_ID_FROM_SUPABASE' 
        }));

        // Insert into Supabase
        const { error } = await supabase.from("leads").insert(formattedData);

        if (error) {
          console.error(error);
          setUploadStatus("Error uploading.");
        } else {
          setUploadStatus("Success!");
          fetchLeads(); // Refresh list
        }
        setUploading(false);
      },
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Lead Management</h1>
            <p className="text-slate-500">Import and manage your prospecting list.</p>
          </div>
          
          {/* UPLOAD BUTTON WRAPPER */}
          <div className="relative">
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileUpload} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Button className="bg-violet-600 hover:bg-violet-700 text-white gap-2 pl-4 pr-6">
              {uploading ? <FileUp className="animate-bounce w-4 h-4" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Importing..." : "Import CSV"}
            </Button>
          </div>
        </div>

        {/* STATUS BAR */}
        {uploadStatus && (
          <div className="mb-6 p-4 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center gap-2 text-sm font-medium text-slate-700">
            <Check className="w-4 h-4 text-green-500" />
            {uploadStatus}
          </div>
        )}

        {/* DATA TABLE (Simple Version) */}
        <Card className="border-none shadow-sm">
            <CardHeader className="bg-white border-b border-slate-100 rounded-t-xl">
                <CardTitle className="text-lg">All Contacts ({leads.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0 bg-white rounded-b-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Phone</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Address</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {leads.map((lead) => (
                                <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-slate-900 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs">
                                            {lead.name?.charAt(0) || "U"}
                                        </div>
                                        {lead.name}
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 font-mono">{lead.phone_number}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium 
                                            ${lead.status === 'new' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 
                                              lead.status === 'called' ? 'bg-green-50 text-green-700 border border-green-100' : 
                                              'bg-slate-100 text-slate-600'}`}>
                                            {lead.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500">{lead.address}</td>
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