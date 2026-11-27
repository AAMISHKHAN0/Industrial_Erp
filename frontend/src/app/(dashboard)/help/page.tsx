"use client";

import { useState } from "react";
import { AppShell } from "@/components/layouts/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, BookOpen, Video, FileText, LifeBuoy, MessageCircle, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";

const faqs = [
  {
    question: "How do I create a new purchase order?",
    answer: "Go to Purchase > Purchase Orders and click 'Add Purchase Order'. Fill in vendor details, add line items, and submit for approval.",
  },
  {
    question: "How do I track inventory levels?",
    answer: "Navigate to Inventory > Stock Ledger to view real-time stock levels across all warehouses. Use filters to find specific items.",
  },
  {
    question: "How do I generate a payslip?",
    answer: "Go to HR > Payroll, select the Pay Slips tab, and click 'Generate'. Select the employee and payroll period to create the slip.",
  },
  {
    question: "How do I record attendance?",
    answer: "Navigate to HR > Attendance. You can record attendance individually or use the bulk entry feature for multiple employees.",
  },
  {
    question: "How do I create a journal entry?",
    answer: "Go to Finance > Journal Entries and click 'Add Entry'. Enter the entry number, date, and line items with debit/credit amounts.",
  },
  {
    question: "How do I manage user roles and permissions?",
    answer: "Contact your system administrator. Role management is available in the admin panel under Settings > Security.",
  },
];

const guides = [
  { title: "Getting Started Guide", description: "Learn the basics of Textile ERP", icon: BookOpen },
  { title: "Video Tutorials", description: "Watch step-by-step video guides", icon: Video },
  { title: "API Documentation", description: "Developer API reference", icon: FileText },
  { title: "Support Portal", description: "Submit a support ticket", icon: LifeBuoy },
  { title: "Community Forum", description: "Discuss with other users", icon: MessageCircle },
];

export default function HelpCenterPage() {
  const [search, setSearch] = useState("");
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(search.toLowerCase()) ||
      faq.answer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell title="Help Center">
      <div className="space-y-6">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search help articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 text-lg"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {guides.map((guide) => (
            <Card key={guide.title} className="hover:bg-muted/50 transition-colors cursor-pointer">
              <CardContent className="p-6">
                <guide.icon className="h-8 w-8 text-primary mb-3" />
                <h3 className="font-semibold">{guide.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{guide.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
            <CardDescription>Quick answers to common questions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredFaqs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No results found for "{search}"</p>
            ) : (
              filteredFaqs.map((faq) => (
                <div key={faq.question} className="border rounded-lg">
                  <button
                    className="flex items-center justify-between w-full p-4 text-left cursor-pointer hover:bg-muted/50 rounded-lg transition-colors"
                    onClick={() => setOpenFaq(openFaq === faq.question ? null : faq.question)}
                  >
                    <span className="font-medium text-sm">{faq.question}</span>
                    {openFaq === faq.question ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {openFaq === faq.question && (
                    <div className="px-4 pb-4">
                      <p className="text-sm text-muted-foreground">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Still need help?</CardTitle>
            <CardDescription>Contact our support team</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button><MessageCircle className="h-4 w-4 mr-2" /> Live Chat</Button>
            <Button variant="outline"><ExternalLink className="h-4 w-4 mr-2" /> Email Support</Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
