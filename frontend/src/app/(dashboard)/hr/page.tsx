"use client";

import { useState, useEffect } from "react";
import { Users, ClipboardCheck, CalendarClock, DollarSign, Briefcase, TrendingUp, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layouts/app-shell";
import { createCrudService } from "@/lib/api/crud";

interface AttendanceSummary {
  present: number;
  absent: number;
  halfDay: number;
  late: number;
  total: number;
}

export default function HRPage() {
  const [employeeCount, setEmployeeCount] = useState(0);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const employeeService = createCrudService<any>("/master-data/employee");
  const attendanceService = createCrudService<any>("/hr/attendance");
  const leaveService = createCrudService<any>("/hr/leaves");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [empRes, attRes, leaveRes] = await Promise.allSettled([
          employeeService.findAll({ limit: 1 }),
          attendanceService.findAll({ limit: 100 }),
          leaveService.findAll({ limit: 1, status: "PENDING" }),
        ]);

        if (empRes.status === "fulfilled") setEmployeeCount(empRes.value.meta?.total || 0);
        if (attRes.status === "fulfilled") {
          const records = attRes.value.data || [];
          const summary: AttendanceSummary = {
            present: records.filter((r: any) => r.status === "PRESENT").length,
            absent: records.filter((r: any) => r.status === "ABSENT").length,
            halfDay: records.filter((r: any) => r.status === "HALF_DAY").length,
            late: records.filter((r: any) => r.status === "LATE").length,
            total: records.length,
          };
          setAttendanceSummary(summary);
        }
        if (leaveRes.status === "fulfilled") setPendingLeaves(leaveRes.value.meta?.total || 0);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const stats = [
    {
      title: "Total Employees",
      value: loading ? "..." : String(employeeCount),
      icon: Users,
      color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30",
      description: "Active employees in system",
    },
    {
      title: "Present Today",
      value: loading ? "..." : attendanceSummary ? String(attendanceSummary.present) : "--",
      icon: ClipboardCheck,
      color: "bg-green-100 text-green-600 dark:bg-green-900/30",
      description: attendanceSummary ? `${((attendanceSummary.present / Math.max(attendanceSummary.total, 1)) * 100).toFixed(0)}% attendance rate` : "",
    },
    {
      title: "Pending Leaves",
      value: loading ? "..." : String(pendingLeaves),
      icon: CalendarClock,
      color: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30",
      description: "Awaiting approval",
    },
    {
      title: "Absent / Late",
      value: loading ? "..." : attendanceSummary ? `${attendanceSummary.absent} / ${attendanceSummary.late}` : "--",
      icon: Clock,
      color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30",
      description: "Today's absenteeism",
    },
  ];

  return (
    <AppShell title="HR">
      <div className="space-y-6 animate-in">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Human Resources overview and key metrics
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            <Briefcase className="h-3 w-3 mr-1" /> HR Module
          </Badge>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Failed to load some data: {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${stat.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Attendance Overview</CardTitle>
                <CardDescription>Today's attendance distribution</CardDescription>
              </CardHeader>
              <CardContent>
                {attendanceSummary ? (
                  <div className="space-y-4">
                    {[
                      { label: "Present", value: attendanceSummary.present, color: "bg-green-500" },
                      { label: "Absent", value: attendanceSummary.absent, color: "bg-red-500" },
                      { label: "Half Day", value: attendanceSummary.halfDay, color: "bg-yellow-500" },
                      { label: "Late", value: attendanceSummary.late, color: "bg-orange-500" },
                    ].map((item) => {
                      const pct = attendanceSummary.total > 0 ? (item.value / attendanceSummary.total) * 100 : 0;
                      return (
                        <div key={item.label} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{item.label}</span>
                            <span className="text-muted-foreground">{item.value}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-xs text-muted-foreground pt-2">
                      Total records today: {attendanceSummary.total}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                    {loading ? "Loading..." : "No attendance data for today"}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common HR operations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: "Mark Attendance", href: "/hr/attendance", icon: ClipboardCheck },
                  { label: "Approve Leaves", href: "/hr/leave", icon: CalendarClock },
                  { label: "Process Payroll", href: "/hr/payroll", icon: DollarSign },
                  { label: "Employee Records", href: "/master-data/employees", icon: Users },
                ].map((action) => {
                  const Icon = action.icon;
                  return (
                    <a
                      key={action.label}
                      href={action.href}
                      className="flex items-center gap-3 rounded-lg p-3 hover:bg-muted transition-colors group"
                    >
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{action.label}</p>
                        <p className="text-xs text-muted-foreground">Navigate to {action.label.toLowerCase()}</p>
                      </div>
                      <TrendingUp className="h-4 w-4 ml-auto text-muted-foreground" />
                    </a>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </AppShell>
  );
}
