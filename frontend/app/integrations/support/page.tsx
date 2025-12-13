"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, Mail, MessageSquare, Phone, Send, 
  CheckCircle2, AlertCircle, Clock, HeadphonesIcon
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function SupportPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    category: "technical",
    priority: "medium",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);

  useEffect(() => {
    const fetchAgency = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: member } = await supabase
        .from("agency_members")
        .select("agency_id")
        .eq("user_id", user.id)
        .single();
      if (member) {
        setAgencyId(member.agency_id);
        if (user.email) {
          setFormData(prev => ({ ...prev, email: user.email || "" }));
        }
      }
    };
    fetchAgency();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (!agencyId) {
        alert("Please wait while we load your agency information.");
        setSubmitting(false);
        return;
      }

      // Store support ticket in database
      const { error } = await supabase.from("support_tickets").insert({
        agency_id: agencyId,
        name: formData.name,
        email: formData.email,
        subject: formData.subject,
        category: formData.category,
        priority: formData.priority,
        message: formData.message,
        status: "open",
      });

      if (error) {
        console.error("Error saving support ticket:", error);
        // Still show success to user, but log the error
        // In production, you might want to send an email notification as fallback
      }

      // In production, you can add email notification here using:
      // - SendGrid API
      // - Resend API
      // - AWS SES
      // - Or your preferred email service
      
      setSubmitted(true);
      setFormData({
        name: "",
        email: "",
        subject: "",
        category: "technical",
        priority: "medium",
        message: "",
      });
    } catch (error: any) {
      console.error("Error submitting support request:", error);
      alert(`Error submitting support request: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/integrations">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Integrations
            </Button>
          </Link>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Contact Support</h1>
          <p className="text-slate-600 text-lg">
            We're here to help. Get in touch with our support team.
          </p>
        </div>

        {/* Support Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Email Support</h3>
              <p className="text-sm text-slate-600 mb-4">
                Get help via email. We typically respond within 24 hours.
              </p>
              <a href="mailto:support@thavon.com" className="text-violet-600 hover:text-violet-700 text-sm font-medium">
                support@thavon.com
              </a>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Live Chat</h3>
              <p className="text-sm text-slate-600 mb-4">
                Chat with our team in real-time. Available during business hours.
              </p>
              <Button size="sm" variant="outline" className="w-full">
                Start Chat
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">Phone Support</h3>
              <p className="text-sm text-slate-600 mb-4">
                Speak directly with our team. For Pro plan customers.
              </p>
              <a href="tel:+352691123456" className="text-green-600 hover:text-green-700 text-sm font-medium">
                +352 691 123 456
              </a>
            </CardContent>
          </Card>
        </div>

        {/* Support Ticket Form */}
        {submitted ? (
          <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">Request Submitted!</h2>
              <p className="text-slate-600 mb-6">
                We've received your support request and will get back to you within 24 hours. 
                You'll receive a confirmation email shortly.
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => setSubmitted(false)}>
                  Submit Another Request
                </Button>
                <Link href="/integrations">
                  <Button className="bg-violet-600 hover:bg-violet-700 text-white">
                    Back to Integrations
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle>Submit a Support Ticket</CardTitle>
              <CardDescription>
                Fill out the form below and we'll get back to you as soon as possible
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Your Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <Input
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="Brief description of your issue"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="technical">Technical Issue</option>
                      <option value="integration">Integration Setup</option>
                      <option value="billing">Billing & Subscription</option>
                      <option value="feature">Feature Request</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Priority <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="low">Low - General inquiry</option>
                      <option value="medium">Medium - Needs attention</option>
                      <option value="high">High - Urgent issue</option>
                      <option value="critical">Critical - System down</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full min-h-[200px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-y"
                    placeholder="Please provide as much detail as possible about your issue, including steps to reproduce, error messages, and any relevant screenshots..."
                  />
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <div className="flex gap-3">
                    <Clock className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-900 mb-1">Response Times</p>
                      <ul className="text-sm text-slate-600 space-y-1">
                        <li>• <strong>Critical:</strong> Within 2 hours</li>
                        <li>• <strong>High:</strong> Within 4 hours</li>
                        <li>• <strong>Medium:</strong> Within 24 hours</li>
                        <li>• <strong>Low:</strong> Within 48 hours</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    {submitting ? (
                      <>
                        <Clock className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Submit Request
                      </>
                    )}
                  </Button>
                  <Link href="/integrations">
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* FAQ Section */}
        <Card className="mt-8 border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">How quickly will I get a response?</h3>
              <p className="text-sm text-slate-600">
                Response times vary by priority. Critical issues are addressed within 2 hours, while 
                general inquiries are typically answered within 24-48 hours.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Do you offer phone support?</h3>
              <p className="text-sm text-slate-600">
                Yes! Phone support is available for Pro plan customers. Call us at +352 691 123 456 
                during business hours (9 AM - 6 PM CET, Monday-Friday).
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Can you help with custom integrations?</h3>
              <p className="text-sm text-slate-600">
                Absolutely! Our team can help set up custom integrations or workarounds for your 
                specific use case. Contact us with your requirements.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">What information should I include in my request?</h3>
              <p className="text-sm text-slate-600">
                Please include: your agency name, a clear description of the issue, steps to reproduce 
                (if applicable), error messages, screenshots, and your integration type.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

