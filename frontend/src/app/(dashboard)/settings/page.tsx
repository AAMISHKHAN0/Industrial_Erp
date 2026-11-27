"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { AppShell } from "@/components/layouts/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Building, Shield, Bell, Palette, Globe, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { UserManagement } from "@/components/shared/user-management";
import { api } from "@/lib/api/client";
import { getStoredCompany, saveStoredCompany, fetchCompanyProfile } from "@/lib/company";

const NOTIF_PREFS_KEY = "erp_notification_preferences";
const REGIONAL_PREFS_KEY = "erp_regional_preferences";
const APPEARANCE_PREFS_KEY = "erp_appearance_preferences";

function SettingsContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("profile");
  const tabParam = searchParams.get("tab");
  const { theme, setTheme } = useTheme();

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [profile, setProfile] = useState({
    id: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const [company, setCompany] = useState({
    id: "",
    name: "Industrial ERP",
    phone: "",
    email: "",
    taxId: "",
    address: "",
    city: "Karachi",
    country: "Pakistan",
  });

  const [security, setSecurity] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [notifPrefs, setNotifPrefs] = useState({
    email: true,
    push: true,
    poAlerts: true,
    lowStock: true,
    leaveAlerts: true,
  });
  const [appearance, setAppearance] = useState({ compactMode: false });
  const [regional, setRegional] = useState({
    timezone: "Asia/Karachi (UTC +5:00)",
    currency: "PKR (₨)",
    dateFormat: "DD/MM/YYYY",
    language: "English",
  });

  useEffect(() => {
    if (tabParam) setActiveTab(tabParam);
  }, [tabParam]);

  useEffect(() => {
    try {
      const savedNotif = localStorage.getItem(NOTIF_PREFS_KEY);
      if (savedNotif) {
        setNotifPrefs((prev) => ({ ...prev, ...JSON.parse(savedNotif) }));
      }
      const savedRegional = localStorage.getItem(REGIONAL_PREFS_KEY);
      if (savedRegional) {
        setRegional((prev) => ({ ...prev, ...JSON.parse(savedRegional) }));
      }
      const savedAppearance = localStorage.getItem(APPEARANCE_PREFS_KEY);
      if (savedAppearance) {
        setAppearance((prev) => ({ ...prev, ...JSON.parse(savedAppearance) }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    const loadProfileAndCompany = async () => {
      const cachedComp = getStoredCompany();
      setCompany((prev) => ({
        ...prev,
        id: cachedComp.id || prev.id,
        name: cachedComp.name || prev.name,
        phone: cachedComp.phone || prev.phone,
        email: cachedComp.email || prev.email,
        address: cachedComp.address || prev.address,
        taxId: cachedComp.taxNumber || prev.taxId,
        city: cachedComp.city || prev.city,
        country: cachedComp.country || prev.country,
      }));

      try {
        const me = await api.get<any>("/auth/me");
        if (me) {
          const userObj = me.user || me;
          const storedName = localStorage.getItem("user-fullName") || "";
          const fullName =
            userObj.fullName ||
            storedName ||
            userObj.email?.split("@")[0] ||
            "Administrator";
          const parts = fullName.split(" ");
          setProfile({
            id: userObj.id || "",
            firstName: parts[0] || "",
            lastName: parts.slice(1).join(" ") || "",
            email: userObj.email || localStorage.getItem("user-email") || "",
            phone: userObj.phone || localStorage.getItem("user-phone") || "",
          });

          if (me.company) {
            setCompany((prev) => ({
              ...prev,
              id: me.company.id || prev.id,
              name: me.company.name || prev.name,
              phone: me.company.phone || prev.phone,
              email: me.company.email || prev.email,
              address: me.company.address || prev.address,
              taxId: me.company.taxNumber || prev.taxId,
              city: me.company.city || prev.city,
              country: me.company.country || prev.country,
            }));
            saveStoredCompany(me.company);
          }
        }
      } catch {
        const storedEmail = localStorage.getItem("user-email") || "";
        const storedName = localStorage.getItem("user-fullName") || storedEmail.split("@")[0] || "";
        const parts = storedName.split(" ").filter(Boolean);
        if (storedEmail || storedName) {
          setProfile((prev) => ({
            ...prev,
            firstName: parts[0] || prev.firstName,
            lastName: parts.slice(1).join(" ") || prev.lastName,
            email: storedEmail || prev.email,
            phone: localStorage.getItem("user-phone") || prev.phone,
          }));
        }
      }

      try {
        const liveComp = await fetchCompanyProfile();
        if (liveComp && liveComp.name) {
          setCompany((prev) => ({
            ...prev,
            id: liveComp.id || prev.id,
            name: liveComp.name || prev.name,
            phone: liveComp.phone || prev.phone,
            email: liveComp.email || prev.email,
            address: liveComp.address || prev.address,
            taxId: liveComp.taxNumber || prev.taxId,
            city: liveComp.city || prev.city,
            country: liveComp.country || prev.country,
          }));
        }
      } catch {}
    };

    loadProfileAndCompany();
  }, []);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const fullName = `${profile.firstName} ${profile.lastName}`.trim();
      localStorage.setItem("user-fullName", fullName);
      localStorage.setItem("user-name", fullName);
      localStorage.setItem("user-email", profile.email.trim());
      localStorage.setItem("user-phone", profile.phone.trim());
      toast.success("Profile display preferences saved");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save profile preferences");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveCompany = async () => {
    if (!company.name.trim()) {
      toast.error("Company Name is required");
      return;
    }
    setSavingCompany(true);
    try {
      const payload: Record<string, string> = {
        name: company.name.trim(),
      };
      if (company.phone.trim()) payload.phone = company.phone.trim();
      if (company.email.trim()) payload.email = company.email.trim();
      if (company.address.trim()) payload.address = company.address.trim();
      if (company.taxId.trim()) payload.taxNumber = company.taxId.trim();
      if (company.city.trim()) payload.city = company.city.trim();
      if (company.country.trim()) payload.country = company.country.trim();

      let savedId = company.id;
      if (company.id) {
        const updated = await api.patch<any>(`/master-data/company/${company.id}`, payload);
        savedId = updated?.id || company.id;
      } else {
        const created = await api.post<any>("/master-data/company", payload);
        if (created && created.id) {
          savedId = created.id;
          setCompany((prev) => ({ ...prev, id: created.id }));
        }
      }

      saveStoredCompany({
        id: savedId,
        name: company.name.trim(),
        phone: company.phone.trim(),
        email: company.email.trim(),
        address: company.address.trim(),
        taxNumber: company.taxId.trim(),
        city: company.city.trim(),
        country: company.country.trim(),
      });

      toast.success("Company information saved to database");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save company information");
    } finally {
      setSavingCompany(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!security.currentPassword) {
      toast.error("Current password is required");
      return;
    }
    if (!security.newPassword || security.newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (security.newPassword !== security.confirmPassword) {
      toast.error("New password and confirmation do not match");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await api.post<{ success?: boolean; message?: string }>(
        "/auth/change-password",
        {
          currentPassword: security.currentPassword,
          newPassword: security.newPassword,
        }
      );
      setSecurity({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success(res?.message || "Password updated successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveNotifPrefs = (nextPrefs?: typeof notifPrefs) => {
    const toSave = nextPrefs || notifPrefs;
    try {
      localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(toSave));
      if (!nextPrefs) {
        toast.success("Notification preferences saved");
      }
    } catch {
      toast.error("Failed to save notification preferences");
    }
  };

  const handleSaveRegional = () => {
    try {
      localStorage.setItem(REGIONAL_PREFS_KEY, JSON.stringify(regional));
      toast.success("Regional settings saved");
    } catch {
      toast.error("Failed to save regional settings");
    }
  };

  const handleCompactModeChange = (checked: boolean) => {
    const next = { ...appearance, compactMode: checked };
    setAppearance(next);
    try {
      localStorage.setItem(APPEARANCE_PREFS_KEY, JSON.stringify(next));
    } catch {}
  };

  return (
    <AppShell title="Settings">
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Configure your system preferences</p>

        <Tabs value={activeTab} onValueChange={(v) => v !== null && setActiveTab(v)}>
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-7">
            <TabsTrigger value="profile" className="flex items-center gap-2"><User className="h-4 w-4" /> Profile</TabsTrigger>
            <TabsTrigger value="company" className="flex items-center gap-2"><Building className="h-4 w-4" /> Company</TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2"><Shield className="h-4 w-4" /> Security</TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2"><Palette className="h-4 w-4" /> Appearance</TabsTrigger>
            <TabsTrigger value="regional" className="flex items-center gap-2"><Globe className="h-4 w-4" /> Regional</TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2"><Users className="h-4 w-4" /> Role Management</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>Update your personal display information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input value={profile.firstName} onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input value={profile.lastName} onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={profile.email} disabled type="email" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone / Contact</Label>
                    <Input placeholder="e.g. +92 300 1234567" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
                  </div>
                </div>
                <Button onClick={handleSaveProfile} disabled={savingProfile} className="gap-2">
                  {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Profile Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="company" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>
                  Manage enterprise details printed on receipts, sales tax invoices, GRN slips, and official financial reports
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Company Name *</Label>
                    <Input placeholder="e.g. Al-Madina Textile Mills Ltd." value={company.name} onChange={(e) => setCompany((c) => ({ ...c, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone / Contact Number</Label>
                    <Input placeholder="e.g. +92 42 35912345 / 0300-1234567" value={company.phone} onChange={(e) => setCompany((c) => ({ ...c, phone: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Official Email</Label>
                    <Input placeholder="e.g. info@company.com" value={company.email} onChange={(e) => setCompany((c) => ({ ...c, email: e.target.value }))} type="email" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tax ID / NTN / STRN</Label>
                    <Input placeholder="e.g. 1234567-8 / STRN-987654" value={company.taxId} onChange={(e) => setCompany((c) => ({ ...c, taxId: e.target.value }))} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Full Factory / Office Address</Label>
                    <Input placeholder="e.g. Plot 45, Sector 15, Korangi Industrial Area" value={company.address} onChange={(e) => setCompany((c) => ({ ...c, address: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input value={company.city} onChange={(e) => setCompany((c) => ({ ...c, city: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input value={company.country} onChange={(e) => setCompany((c) => ({ ...c, country: e.target.value }))} />
                  </div>
                </div>
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                  <Button onClick={handleSaveCompany} disabled={savingCompany} className="gap-2">
                    {savingCompany && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save Company Profile
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Updates headers on all invoices, receipts, and PDF reports instantly
                  </span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Change your account password (minimum 8 characters)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Current Password</Label>
                    <Input
                      type="password"
                      value={security.currentPassword}
                      onChange={(e) => setSecurity((s) => ({ ...s, currentPassword: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>New Password</Label>
                    <Input
                      type="password"
                      value={security.newPassword}
                      onChange={(e) => setSecurity((s) => ({ ...s, newPassword: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm Password</Label>
                    <Input
                      type="password"
                      value={security.confirmPassword}
                      onChange={(e) => setSecurity((s) => ({ ...s, confirmPassword: e.target.value }))}
                    />
                  </div>
                </div>
                <Button onClick={handleUpdatePassword} disabled={savingPassword} className="gap-2">
                  {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                  Update Password
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose which workspace alerts you receive on this device</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Email Notifications</p>
                    <p className="text-xs text-muted-foreground">Receive email alerts for important events</p>
                  </div>
                  <Switch
                    checked={notifPrefs.email}
                    onCheckedChange={(v) => {
                      const next = { ...notifPrefs, email: v };
                      setNotifPrefs(next);
                      handleSaveNotifPrefs(next);
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Push Notifications</p>
                    <p className="text-xs text-muted-foreground">Receive browser push notifications</p>
                  </div>
                  <Switch
                    checked={notifPrefs.push}
                    onCheckedChange={(v) => {
                      const next = { ...notifPrefs, push: v };
                      setNotifPrefs(next);
                      handleSaveNotifPrefs(next);
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Purchase Order Alerts</p>
                    <p className="text-xs text-muted-foreground">Notify when new POs are created or approved</p>
                  </div>
                  <Switch
                    checked={notifPrefs.poAlerts}
                    onCheckedChange={(v) => {
                      const next = { ...notifPrefs, poAlerts: v };
                      setNotifPrefs(next);
                      handleSaveNotifPrefs(next);
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Low Stock Alerts</p>
                    <p className="text-xs text-muted-foreground">Alert when inventory falls below reorder level</p>
                  </div>
                  <Switch
                    checked={notifPrefs.lowStock}
                    onCheckedChange={(v) => {
                      const next = { ...notifPrefs, lowStock: v };
                      setNotifPrefs(next);
                      handleSaveNotifPrefs(next);
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Leave Request Alerts</p>
                    <p className="text-xs text-muted-foreground">Notify when employees submit leave requests</p>
                  </div>
                  <Switch
                    checked={notifPrefs.leaveAlerts}
                    onCheckedChange={(v) => {
                      const next = { ...notifPrefs, leaveAlerts: v };
                      setNotifPrefs(next);
                      handleSaveNotifPrefs(next);
                    }}
                  />
                </div>
                <div className="pt-2">
                  <Button onClick={() => handleSaveNotifPrefs()}>Save Preferences</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize the look and feel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Dark Mode</p>
                    <p className="text-xs text-muted-foreground">Toggle dark/light theme</p>
                  </div>
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={(v) => setTheme(v ? "dark" : "light")}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Compact Mode</p>
                    <p className="text-xs text-muted-foreground">Reduce spacing for dense data view</p>
                  </div>
                  <Switch checked={appearance.compactMode} onCheckedChange={handleCompactModeChange} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="regional" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Regional Settings</CardTitle>
                <CardDescription>Set your location and formatting preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Time Zone</Label>
                    <Input value={regional.timezone} onChange={(e) => setRegional((r) => ({ ...r, timezone: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Input value={regional.currency} onChange={(e) => setRegional((r) => ({ ...r, currency: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date Format</Label>
                    <Input value={regional.dateFormat} onChange={(e) => setRegional((r) => ({ ...r, dateFormat: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Input value={regional.language} onChange={(e) => setRegional((r) => ({ ...r, language: e.target.value }))} />
                  </div>
                </div>
                <Button onClick={handleSaveRegional}>Save Changes</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <UserManagement />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<AppShell title="Settings"><div className="p-6 text-muted-foreground">Loading settings...</div></AppShell>}>
      <SettingsContent />
    </Suspense>
  );
}
