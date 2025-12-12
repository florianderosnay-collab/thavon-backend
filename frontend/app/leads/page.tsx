"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Papa from "papaparse";
import { 
  Upload, Search, Plus, Download, Trash2, Edit, 
  ChevronDown, Loader2, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";

export default function LeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    propertyType: "",
    propertyValue: "",
    leadSource: "",
    notes: "",
  });

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
        fetchLeads(member.agency_id);
      }
    };
    init();
  }, []);

  useEffect(() => {
    filterLeads();
  }, [searchQuery, statusFilter, leads]);

  const fetchLeads = async (id: string) => {
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("agency_id", id)
      .order("created_at", { ascending: false });

    if (data) {
      setLeads(data);
      setFilteredLeads(data);
    }
  };

  const filterLeads = () => {
    let filtered = [...leads];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (lead) =>
          lead.name?.toLowerCase().includes(query) ||
          lead.phone_number?.toLowerCase().includes(query) ||
          lead.address?.toLowerCase().includes(query) ||
          lead.email?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((lead) => lead.status === statusFilter);
    }

    setFilteredLeads(filtered);
  };

  const deleteLead = async (id: string) => {
    if (!confirm("Are you sure you want to delete this lead?")) return;
    
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (!error) {
      setLeads(leads.filter((lead) => lead.id !== id));
    }
  };

  const handleAddLead = async () => {
    if (!agencyId || !formData.firstName || !formData.lastName) {
      alert("First Name and Last Name are required");
      return;
    }

    const fullName = `${formData.firstName} ${formData.lastName}`.trim();
    const fullAddress = [formData.address, formData.city, formData.state, formData.zip]
      .filter(Boolean)
      .join(", ");

    const leadData = {
      agency_id: agencyId,
      name: fullName,
      phone_number: formData.phone || "",
      email: formData.email || null,
      address: fullAddress || formData.address || "",
      asking_price: formData.propertyValue || "0",
      status: "new",
      source: formData.leadSource || "manual",
      metadata: {
        property_type: formData.propertyType,
        notes: formData.notes,
      },
    };

    const { error } = await supabase.from("leads").insert(leadData);

    if (error) {
      alert(`Error adding lead: ${error.message}`);
    } else {
      setShowAddModal(false);
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        zip: "",
        propertyType: "",
        propertyValue: "",
        leadSource: "",
        notes: "",
      });
      if (agencyId) fetchLeads(agencyId);
    }
  };

  const downloadTemplate = async () => {
    try {
      // Dynamically import xlsx for template generation
      const XLSX = (await import("xlsx")).default;
      
      // Create a workbook
      const workbook = XLSX.utils.book_new();
      
      // Define the template data with headers and example row
      const templateData = [
        // Headers
        [
          "First Name",
          "Last Name",
          "Email",
          "Phone",
          "Address",
          "City",
          "State",
          "ZIP",
          "Property Type",
          "Property Value",
          "Lead Source"
        ],
        // Example row
        [
          "John",
          "Doe",
          "john@example.com",
          "+352 691 123 456",
          "10 Avenue Monterey",
          "Luxembourg",
          "Luxembourg",
          "2163",
          "House",
          "850000",
          "Website"
        ],
        // Empty rows for user to fill
        ["", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", ""],
      ];
      
      // Create worksheet from data
      const worksheet = XLSX.utils.aoa_to_sheet(templateData);
      
      // Set column widths for better readability
      worksheet["!cols"] = [
        { wch: 12 }, // First Name
        { wch: 12 }, // Last Name
        { wch: 25 }, // Email
        { wch: 18 }, // Phone
        { wch: 25 }, // Address
        { wch: 15 }, // City
        { wch: 12 }, // State
        { wch: 8 },  // ZIP
        { wch: 15 }, // Property Type
        { wch: 15 }, // Property Value
        { wch: 15 }, // Lead Source
      ];
      
      // Style the header row (bold)
      const headerRange = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!worksheet[cellAddress]) continue;
        worksheet[cellAddress].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "E5E7EB" } }, // Light gray background
        };
      }
      
      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, "Leads Template");
      
      // Generate Excel file and download
      XLSX.writeFile(workbook, "thavon_leads_template.xlsx");
    } catch (error) {
      console.error("Error generating template:", error);
      // Fallback to CSV if Excel generation fails
      const csvContent = "First Name,Last Name,Email,Phone,Address,City,State,ZIP,Property Type,Property Value,Lead Source\nJohn,Doe,john@example.com,+352691123456,10 Avenue Monterey,Luxembourg,Luxembourg,2163,House,850000,Website";
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "thavon_leads_template.csv";
      a.click();
    }
  };

  const handleFileUpload = async (event: any) => {
    if (!agencyId) {
      alert("Critical Error: No Agency ID found. Try logging out and back in.");
      return;
    }

    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);

    try {
      let rows: any[] = [];

      // Handle Excel files (.xlsx, .xls)
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const XLSX = (await import("xlsx")).default;
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        rows = XLSX.utils.sheet_to_json(worksheet);
      }
      // Handle CSV files
      else if (file.name.endsWith(".csv") || file.type === "text/csv") {
        const text = await file.text();
        const parsed = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
        });
        rows = parsed.data as any[];
      } else {
        alert("Please upload a .csv or .xlsx file");
        setUploading(false);
        return;
      }

      const formattedData = rows
        .map((row: any) => {
          // Flexible column name matching
          const firstName = row["First Name"] || row["first_name"] || row["FirstName"] || row["First Name"] || "";
          const lastName = row["Last Name"] || row["last_name"] || row["LastName"] || row["Last Name"] || "";
          const name = row["Name"] || row["name"] || (firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName) || "";
          const phone = row["Phone"] || row["phone"] || row["Phone Number"] || row["phone_number"] || row["Mobile"] || "";
          const email = row["Email"] || row["email"] || "";
          const address = row["Address"] || row["address"] || "";
          const city = row["City"] || row["city"] || "";
          const state = row["State"] || row["state"] || "";
          const zip = row["ZIP"] || row["zip"] || row["Zip"] || row["Postal Code"] || "";
          const propertyType = row["Property Type"] || row["property_type"] || row["PropertyType"] || "";
          const propertyValue = row["Property Value"] || row["property_value"] || row["PropertyValue"] || row["Price"] || row["price"] || row["Asking Price"] || "0";
          const leadSource = row["Lead Source"] || row["lead_source"] || row["LeadSource"] || row["Source"] || row["source"] || "imported";

          if (!phone && !name) return null;

          const fullAddress = [address, city, state, zip].filter(Boolean).join(", ") || address;

          return {
            agency_id: agencyId,
            name: name || "Unknown Lead",
            phone_number: phone.toString().trim(),
            email: email || null,
            address: fullAddress,
            asking_price: propertyValue.toString().replace(/[€,$,\s]/g, "") || "0",
            status: "new",
            source: leadSource,
            metadata: {
              property_type: propertyType,
            },
          };
        })
        .filter(Boolean);

      if (formattedData.length === 0) {
        alert("No valid data found in the file.");
        setUploading(false);
        return;
      }

      const { error } = await supabase.from("leads").insert(formattedData);

      if (error) {
        alert(`Error importing leads: ${error.message}`);
      } else {
        alert(`Successfully imported ${formattedData.length} leads!`);
        fetchLeads(agencyId);
      }
    } catch (error: any) {
      alert(`Error processing file: ${error.message}`);
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = "";
    }
  };

  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "new", label: "New" },
    { value: "called", label: "Called" },
    { value: "appointment_booked", label: "Appointment Booked" },
    { value: "voicemail", label: "Voicemail" },
    { value: "no_answer", label: "No Answer" },
    { value: "callback", label: "Callback" },
  ];

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      new: { bg: "bg-blue-50", text: "text-blue-700", label: "New" },
      called: { bg: "bg-green-50", text: "text-green-700", label: "Called" },
      appointment_booked: { bg: "bg-violet-50", text: "text-violet-700", label: "Appointment" },
      voicemail: { bg: "bg-yellow-50", text: "text-yellow-700", label: "Voicemail" },
      no_answer: { bg: "bg-slate-50", text: "text-slate-700", label: "No Answer" },
      callback: { bg: "bg-orange-50", text: "text-orange-700", label: "Callback" },
    };

    const config = statusConfig[status] || { bg: "bg-slate-50", text: "text-slate-700", label: status };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Leads</h1>
          <p className="text-slate-600">Manage and track your real estate leads</p>
        </div>

        {/* Action Bar */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-4 flex-1 max-w-md">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full"
              />
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="appearance-none bg-white border border-slate-200 rounded-md px-4 py-2 pr-8 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent cursor-pointer"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={downloadTemplate}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download Template
            </Button>
            <Button 
              variant="outline" 
              onClick={() => document.getElementById("file-upload")?.click()}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </Button>
            <Button onClick={() => setShowAddModal(true)} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
              <Plus className="w-4 h-4" />
              Add Lead
            </Button>
          </div>
        </div>

        {/* File Upload Input (Hidden) */}
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileUpload}
          className="hidden"
          id="file-upload"
        />

        {/* Table */}
        <Card className="border-none shadow-sm">
          <CardContent className="p-0">
            {filteredLeads.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-slate-500 mb-2">
                  {leads.length === 0
                    ? "No leads yet. Add your first lead or import from CSV."
                    : "No leads match your search criteria."}
                </p>
                {leads.length === 0 && (
                  <div className="mt-4 flex gap-3 justify-center">
                    <Button
                      variant="outline"
                      onClick={downloadTemplate}
                      className="gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download Template
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById("file-upload")?.click()}
                      className="gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Import CSV
                    </Button>
                    <Button onClick={() => setShowAddModal(true)} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
                      <Plus className="w-4 h-4" />
                      Add Lead
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Property
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Source
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-slate-900">{lead.name || "Unknown"}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-600">{lead.phone_number || "-"}</div>
                          {lead.email && (
                            <div className="text-xs text-slate-400">{lead.email}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-600">
                            {lead.address || "-"}
                          </div>
                          {lead.metadata?.property_type && (
                            <div className="text-xs text-slate-400">{lead.metadata.property_type}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(lead.status || "new")}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-slate-600 capitalize">{lead.source || "manual"}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => deleteLead(lead.id)}
                            className="text-slate-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Lead Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-3xl">
          <DialogClose onClose={() => setShowAddModal(false)} />
          <DialogHeader>
            <DialogTitle>Enter the lead's information below</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+352 691 123 456"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="10 Avenue Monterey"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Luxembourg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                <Input
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="Luxembourg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">ZIP</label>
                <Input
                  value={formData.zip}
                  onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                  placeholder="2163"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Property Type</label>
                <select
                  value={formData.propertyType}
                  onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">Select type</option>
                  <option value="House">House</option>
                  <option value="Apartment">Apartment</option>
                  <option value="Condo">Condo</option>
                  <option value="Townhouse">Townhouse</option>
                  <option value="Land">Land</option>
                  <option value="Commercial">Commercial</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Property Value ($)</label>
                <Input
                  type="number"
                  value={formData.propertyValue}
                  onChange={(e) => setFormData({ ...formData, propertyValue: e.target.value })}
                  placeholder="850000"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Lead Source</label>
              <select
                value={formData.leadSource}
                onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Select source</option>
                <option value="website">Website</option>
                <option value="referral">Referral</option>
                <option value="facebook">Facebook</option>
                <option value="zapier">Zapier</option>
                <option value="hubspot">HubSpot</option>
                <option value="salesforce">Salesforce</option>
                <option value="manual">Manual Entry</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full min-h-[100px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
                placeholder="Additional notes about this lead..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddLead} className="bg-violet-600 hover:bg-violet-700 text-white">
                Add Lead
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Loading Overlay */}
      {uploading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center gap-4">
              <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
              <div>
                <p className="font-medium text-slate-900">Importing leads...</p>
                <p className="text-sm text-slate-500">Please wait while we process your file</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
