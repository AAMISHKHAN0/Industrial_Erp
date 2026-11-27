"use client";

import { AppShell } from "@/components/layouts/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, GitBranch, FolderTree, BadgeCheck, Users, ArrowRight } from "lucide-react";
import Link from "next/link";

const modules = [
  { title: "Company", href: "/master-data/company", icon: Building2, desc: "Manage company information" },
  { title: "Branches", href: "/master-data/branches", icon: GitBranch, desc: "Manage branch locations" },
  { title: "Departments", href: "/master-data/departments", icon: FolderTree, desc: "Manage department structure" },
  { title: "Designations", href: "/master-data/designations", icon: BadgeCheck, desc: "Manage job designations" },
  { title: "Employees", href: "/master-data/employees", icon: Users, desc: "Manage employee records" },
];

export default function MasterDataPage() {
  return (
    <AppShell title="Master Data">
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Manage your organization's master data — companies, branches, departments, and employees</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => (
            <Link key={mod.href} href={mod.href}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <mod.icon className="h-6 w-6 text-primary" />
                    {mod.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{mod.desc}</p>
                  <div className="flex items-center gap-1 mt-3 text-sm text-primary font-medium">
                    Manage <ArrowRight className="h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
