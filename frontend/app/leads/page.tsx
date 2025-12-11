"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Papa from "papaparse"; 
import { Upload, FileUp, Check, AlertCircle, Download } from "lucide-react"; // Added Download icon
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    const { data, error } = await supabase.from("leads").select("*").order('created_at', { ascending: false });
    if (data) setLeads(data);
  };

  // --- NEW FUNCTION: DOWNLOAD TEMPLATE ---
  const downloadTemplate = () => {
    // This creates a correct CSV file in the browser
    const csvContent = "Name,Phone,Address,Price\nJohn Doe,+352691123456,10 Avenue Monterey,850000\nJane Smith,+352661000000,5 Rue du Marche,1200000";
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "thavon_leads_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = (event: any) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check if file is actually CSV
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
        console.log("Raw CSV Data:", rows);
        
        const formattedData = rows
          .map((row: any) => {
            const name = row.Name || row.name || row['First Name'];
            const phone = row.Phone || row.phone || row.Mobile || row['Phone Number'];
            
            if (!phone) return null;

            return {
              name: name || "Unknown Lead",
              phone_number: phone.toString().trim(),
              address: row.Address || row.address || "",
              asking_price: row.Price || row.price || "",
              status: 'new',
            };
          })
          .filter(Boolean); 

        if (formattedData.length === 0) {
          setErrorMessage("No valid phone numbers found. Use the Download Template button!");
          setUploading(false);
          return;
        }

        setUploadStatus(`Uploading ${formattedData.length} valid leads...`);

        const { error } = await supabase.from("leads").insert(formattedData);

        if (error) {
          console.error("Supabase Error:", error);
          setErrorMessage(`Database rejected data: ${error.message}`);
          setUploadStatus("");
        } else {
          setUploadStatus("Success! Database updated.");
          fetchLeads(); 
        }
        setUploading(false);
      },
      error: (err) => {
          setErrorMessage("Failed to read CSV. Make sure it is not an Excel file.");
          setUploading(false);
      }
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
          
          {/* BUTTONS AREA */}
          <div className="flex gap-3">
            {/* NEW BUTTON HERE */}
            <Button 
                variant="outline" 
                onClick={downloadTemplate}
                className="border-slate-300 text-slate-700 bg-white hover:bg-slate-50 gap-2"
            >
                <Download className="w-4 h-4" /> Template
            </Button>

            <div className="relative">
                <input 
                type="file" 
                accept=".csv" 
                onChange={handleFileUpload} 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Button className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
                {uploading ? <FileUp className="animate-bounce w-4 h-4" /> : <Upload className="w-4 h-4" />}
                {uploading ? "Uploading..." : "Import CSV"}
                </Button>
            </div>
          </div>
        </div>

        {/* MESSAGES */}
        {errorMessage && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            {errorMessage}
          </div>
        )}
        {uploadStatus && !errorMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
            <Check className="w-5 h-5" />
            {uploadStatus}
          </div>
        )}

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
                                            {lead.status?.toUpperCase()}
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