import { crudToast } from "@/lib/enterprise-feedback";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Bell, Shield, Save, Settings as SettingsIcon, Layout, Monitor, Volume2, Menu, Lock, User, Mail } from "lucide-react";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { getUserSettings, upsertUserSettings } from "@/services/settings";
import { getUserPreferences, peekCachedUserPreferences, upsertUserPreferences } from "@/services/userPreferences";
import { refreshSoundPreference } from "@/lib/sound";
import { changeOwnPassword } from "@/services/auth";
import { Palette, Moon } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";
// Audit controls have moved to the main Audit page
import Breadcrumbs from "@/components/layout/Breadcrumbs";
import { ACCENT_COLORS, DARK_LEVELS } from "@/lib/theme-config";
import { trackActivity } from "@/services/notifications";

export default function Settings() {
  const { toast } = useToast();
  const cachedPrefs = useMemo(() => {
    try {
      const uid = localStorage.getItem("current_user_id");
      return peekCachedUserPreferences(uid);
    } catch {
      return null;
    }
  }, []);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  // Personalization preferences
  const [showNewsletter, setShowNewsletter] = useState(() => Boolean(cachedPrefs?.show_newsletter));
  const [compactMode, setCompactMode] = useState(() => Boolean(cachedPrefs?.compact_mode)); // legacy
  const [betaFeatures, setBetaFeatures] = useState(() => Boolean(cachedPrefs?.enable_beta_features));
  const [defaultLanding, setDefaultLanding] = useState<string>(() => cachedPrefs?.default_landing_page || "");
  // New personalization fields
  const [density, setDensity] = useState<'comfortable' | 'compact' | 'ultra'>(() => {
    if (cachedPrefs?.density) return cachedPrefs.density;
    return cachedPrefs?.compact_mode ? 'compact' : 'comfortable';
  });
  const [autoTheme, setAutoTheme] = useState(() => Boolean(cachedPrefs?.auto_theme));
  const [enableSounds, setEnableSounds] = useState(() => (typeof cachedPrefs?.enable_sounds === 'boolean' ? Boolean(cachedPrefs?.enable_sounds) : true));
  const [sidebarCollapsedPref, setSidebarCollapsedPref] = useState(() => Boolean(cachedPrefs?.sidebar_collapsed));
  const [showAnnouncements, setShowAnnouncements] = useState(() => cachedPrefs?.show_announcements !== false);
  const [stickyHeader, setStickyHeader] = useState(() => Boolean(cachedPrefs?.sticky_header));
  const [topNavMode, setTopNavMode] = useState(() => Boolean(cachedPrefs?.top_nav_mode));
  const [showHelpCenter, setShowHelpCenter] = useState(() => cachedPrefs?.show_help_center !== false);

  // Theme customization
  const [enableAccentColor, setEnableAccentColor] = useState(() => localStorage.getItem('theme_accent_enabled') !== 'false');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('theme_accent') || 'orange');
  const [darkLevel, setDarkLevel] = useState(() => localStorage.getItem('theme_dark_level') || 'standard');

  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Apply theme changes
  useEffect(() => {
    const root = document.documentElement;
    const accent = ACCENT_COLORS.find(c => c.id === accentColor) || ACCENT_COLORS[0];

    // Main accent colors
    root.style.setProperty('--primary', accent.value);
    root.style.setProperty('--primary-hover', accent.hover);
    root.style.setProperty('--ring', accent.value);

    // Sidebar accent colors
    root.style.setProperty('--sidebar-primary', accent.value);
    root.style.setProperty('--sidebar-ring', accent.value);
    // In light mode, sidebar accent is a light tint. In dark mode, it might be overridden by class .dark
    // but setting it here ensures it updates dynamically.
    // We need to check if we are in dark mode to decide what --sidebar-accent should be, 
    // OR we rely on the fact that .dark redefines it.
    // However, .dark defines --sidebar-accent as a specific color.
    // If we set it on :root (inline style), it overrides the class definition.
    // So we should set it conditionally or set a separate variable.

    // Actually, looking at index.css:
    // Light mode: --sidebar-accent: 16 52% 92%;
    // Dark mode: --sidebar-accent: 60 3% 20%; (neutral)

    // If we want the sidebar selection to follow the accent color in light mode, we set it to accent.light.
    // In dark mode, usually sidebar selection is just a lighter grey or the accent color itself with opacity.
    // But let's stick to the pattern.

    if (!darkMode) {
      root.style.setProperty('--sidebar-accent', accent.light);
      if (accent.sidebar) {
        root.style.setProperty('--sidebar-background', accent.sidebar);
      }
      root.style.setProperty('--accent', accent.light);
      root.style.setProperty('--accent-foreground', accent.value);
    } else {
      // In dark mode, we might want to keep it neutral or use the accent?
      // The original css had neutral for dark mode. Let's reset it to neutral if dark mode, 
      // or just remove the property to let CSS take over if we switch to dark.
      root.style.removeProperty('--sidebar-accent');
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-foreground');
    }

    localStorage.setItem('theme_accent', accentColor);
  }, [accentColor, darkMode]);

  useEffect(() => {
    localStorage.setItem('theme_accent_enabled', String(enableAccentColor));
    // When disabled, revert to the default orange accent
    if (!enableAccentColor) {
      const root = document.documentElement;
      const fallback = ACCENT_COLORS.find(c => c.id === 'orange') || ACCENT_COLORS[0];
      root.style.setProperty('--primary', fallback.value);
      root.style.setProperty('--primary-hover', fallback.hover);
      root.style.setProperty('--ring', fallback.value);
      root.style.setProperty('--sidebar-primary', fallback.value);
      root.style.setProperty('--sidebar-ring', fallback.value);
    }
  }, [enableAccentColor]);

  useEffect(() => {
    const root = document.documentElement;
    const level = DARK_LEVELS.find(l => l.id === darkLevel) || DARK_LEVELS[0];
    
    let bgValue = '0 0% 100%';

    // Only apply if in dark mode, but we set the variables on a special class or just override
    // Since .dark class sets these variables, we need to override them with higher specificity or inline styles on body/root when dark
    if (darkMode) {
      bgValue = level.bg;
      root.style.setProperty('--background', level.bg);
      root.style.setProperty('--card', level.card);
      root.style.setProperty('--popover', level.card);
      root.style.setProperty('--sidebar-background', level.card);

      // Adjust dashboard card headers for dark mode depth
      // @ts-ignore - headerOpacity is new
      const opacity = level.headerOpacity || 0.1;
      root.style.setProperty('--header-amc', `hsl(30 100% 50% / ${opacity})`);
      root.style.setProperty('--header-food', `hsl(150 100% 50% / ${opacity})`);
    } else {
      root.style.removeProperty('--background');
      root.style.removeProperty('--card');
      root.style.removeProperty('--popover');

      // Light mode sidebar background
      const accent = ACCENT_COLORS.find(c => c.id === accentColor) || ACCENT_COLORS[0];
      if (accent.sidebar) {
        root.style.setProperty('--sidebar-background', accent.sidebar);
      } else {
        root.style.removeProperty('--sidebar-background');
      }

      // Light mode defaults
      root.style.setProperty('--header-amc', 'hsl(33 100% 96%)'); // orange-50
      root.style.setProperty('--header-food', 'hsl(150 100% 96%)'); // emerald-50
    }

    // Update theme-color meta tag to match background
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', `hsl(${bgValue})`);
    }

    localStorage.setItem('theme_dark_level', darkLevel);
  }, [darkLevel, darkMode, accentColor]);

  // Initialize dark mode from existing theme preference immediately (before async load)
  useEffect(() => {
    const syncDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setDarkMode(isDark);
    };

    // Sync immediately
    syncDarkMode();

    // Also listen for storage events (in case changed in another tab)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'theme') {
        syncDarkMode();
      }
    };
    window.addEventListener('storage', handleStorage);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          syncDarkMode();
        }
      });
    });

    observer.observe(document.documentElement, { attributes: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Demo current user id (wire to auth user/app user as needed)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Password change fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<string>("");
  // Audit controls moved to /audit


  const baseTabs = [
    { value: "notifications", label: "Notifications", icon: Bell },
    { value: "security", label: "Security", icon: Shield },
    { value: "personalization", label: "Personalization", icon: SettingsIcon },
  ];
  const tabItems = baseTabs;

  // Load settings
  useEffect(() => {
    (async () => {
      // current user from auth storage
      try {
        const uid = localStorage.getItem("current_user_id");
        const authRaw = localStorage.getItem("auth_user");
        if (uid) setCurrentUserId(uid);
        if (authRaw) {
          const au = JSON.parse(authRaw) as { email?: string };
          setCurrentUserEmail(au?.email || null);
        }
      } catch { }

      // user settings
      try {
        if (currentUserId) {
          const us = await getUserSettings(currentUserId);
          setNotifications(us.notifications ?? true);
          setEmailNotifications(us.email_notifications ?? true);
          // Do NOT overwrite darkMode from DB if we are already observing the DOM
          // setDarkMode(us.dark_mode ?? false); 
        }
      } catch { }

      // load user personalization preferences
      try {
        if (currentUserId) {
          const p = await getUserPreferences(currentUserId);
          setShowNewsletter(!!p.show_newsletter);
          setCompactMode(!!p.compact_mode);
          setBetaFeatures(!!p.enable_beta_features);
          setDefaultLanding(p.default_landing_page || "");
          if (p.density) setDensity(p.density);
          if (typeof p.auto_theme === 'boolean') setAutoTheme(p.auto_theme);
          if (typeof p.enable_sounds === 'boolean') setEnableSounds(p.enable_sounds);
          if (typeof p.sidebar_collapsed === 'boolean') setSidebarCollapsedPref(p.sidebar_collapsed);
          if (typeof p.show_announcements === 'boolean') setShowAnnouncements(p.show_announcements);
          if (typeof p.sticky_header === 'boolean') setStickyHeader(p.sticky_header);
          if (typeof p.top_nav_mode === 'boolean') setTopNavMode(p.top_nav_mode);
          if (typeof p.show_help_center === 'boolean') setShowHelpCenter(p.show_help_center);
        }
      } catch { }
      finally { setPrefsLoaded(true); }

      // role
      try {
        const authRaw = localStorage.getItem("auth_user");
        if (authRaw) {
          const au = JSON.parse(authRaw) as { role?: string };
          setRole((au.role || "").toLowerCase());
        }
      } catch { }

      // departments management moved to Users page

      // MFA status check not implemented in this app currently.
    })();
  }, [currentUserId]);

  const handleSave = async () => {
    try {
      // Validate default landing page against whitelist
      const allowedLanding = new Set(["/dashboard", "/assets", "/properties", "/tickets", "/reports", "/newsletter", "/settings", "/approvals"]);
      let landingToSave: string | null = (defaultLanding || "") || null;
      if (landingToSave && !allowedLanding.has(landingToSave)) {
        landingToSave = null; // coerce invalid to null (system default)
      }
      // Gate approvals landing if user lacks role
      if (landingToSave === "/approvals") {
        try {
          const raw = localStorage.getItem('auth_user');
          const r = raw ? (JSON.parse(raw).role || '').toLowerCase() : '';
          if (!['admin', 'manager'].includes(r)) landingToSave = null;
        } catch { }
      }
      // Only user settings persisted (system config removed from UI)
      if (currentUserId) {
        await upsertUserSettings(currentUserId, { notifications, email_notifications: emailNotifications, dark_mode: darkMode });
        await upsertUserPreferences(currentUserId, {
          show_newsletter: showNewsletter,
          compact_mode: density === 'compact' || density === 'ultra' ? true : compactMode,
          enable_beta_features: betaFeatures,
          default_landing_page: landingToSave,
          density,
          auto_theme: autoTheme,
          enable_sounds: enableSounds,
          sidebar_collapsed: sidebarCollapsedPref,
          show_announcements: showAnnouncements,
          sticky_header: stickyHeader,
          top_nav_mode: topNavMode,
          show_help_center: showHelpCenter,
        });
      }
      
      // Track that settings were changed!
      await trackActivity('setting', 'update', { 
        entityName: 'System Preferences'
      });
      // apply theme preference globally ONLY if it changed to avoid accidental resets
      try {
        const root = document.documentElement;
        const currentlyDark = root.classList.contains('dark');
        if (darkMode !== currentlyDark) {
          if (darkMode) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
          } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
          }
        }
        // Density classes
        try {
          root.classList.remove('compact-ui');
          root.classList.remove('ultra-ui');
          if (density === 'compact') root.classList.add('compact-ui');
          else if (density === 'ultra') { root.classList.add('compact-ui'); root.classList.add('ultra-ui'); }
        } catch { }
      } catch { }
      try { refreshSoundPreference(); } catch { }
      // Broadcast preference delta for live layout adjustments (same-tab + cross-tab)
      try {
        const patch = {
          top_nav_mode: topNavMode,
          sticky_header: stickyHeader,
          auto_theme: autoTheme,
          density,
          show_newsletter: showNewsletter,
          show_help_center: showHelpCenter,
          show_announcements: showAnnouncements,
          sidebar_collapsed: sidebarCollapsedPref,
          enable_sounds: enableSounds,
        };
        // Cross-tab broadcast
        localStorage.setItem('user_preferences_patch', JSON.stringify(patch));
        // Same-tab broadcast
        try { window.dispatchEvent(new CustomEvent('user-preferences-changed', { detail: patch })); } catch { }
      } catch { }
      crudToast.settingsSaved("Your theme, sound, and workspace preferences have been saved.");
    } catch (e: any) {
      crudToast.failed("save settings", e.message || String(e));
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      crudToast.warning("Missing Fields", "Please complete all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      crudToast.warning("Passwords Do Not Match", "New password and confirmation password must match.");
      return;
    }
    try {
      const uid = currentUserId || localStorage.getItem("current_user_id");
      let emailForValidation = currentUserEmail;
      if (!emailForValidation) {
        try {
          const raw = localStorage.getItem("auth_user");
          if (raw) {
            const parsed = JSON.parse(raw) as { email?: string };
            emailForValidation = parsed?.email || null;
          }
        } catch { }
      }
      if (!uid || !emailForValidation) {
        crudToast.error("Authentication Error", "No current signed-in user session found.");
        return;
      }
      // Use secure RPC to change own password server-side (validates current password)
      await changeOwnPassword(emailForValidation, currentPassword, newPassword);
      
      // Track this important security change!
      await trackActivity('user', 'update', { 
        entityName: 'Password',
        changes: ['Password'] 
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      crudToast.success("Password Updated", "Your account password has been changed successfully.");
    } catch (e: any) {
      crudToast.failed("change password", e?.message || String(e));
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <Breadcrumbs items={[{ label: "Dashboard", to: "/dashboard" }, { label: "Settings" }]} />

      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl border bg-card px-8 py-10 shadow-sm sm:px-12 sm:py-12">
        <div className="relative z-10 max-w-3xl space-y-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Settings & Configuration
          </h1>
          <p className="text-lg text-muted-foreground">
            Manage your account security, customize your interface, and control how you receive notifications.
          </p>
        </div>
        {/* Decorative background element */}
        <div className="absolute right-0 top-0 -z-10 h-full w-1/3 bg-gradient-to-l from-primary/5 to-transparent" />
      </div>

      <Tabs defaultValue="personalization" className="space-y-8">
        <TabsList className="flex h-auto w-full flex-col gap-2 rounded-3xl bg-muted/50 p-2 sm:w-auto sm:flex-row sm:rounded-full sm:p-1.5">
          {tabItems.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="group flex w-full items-center justify-start gap-3 rounded-full px-5 py-3 text-sm font-medium text-muted-foreground transition-all hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:w-auto sm:justify-center sm:gap-2 sm:px-6 sm:py-2.5"
            >
              <Icon className="h-4 w-4 transition-colors group-hover:text-foreground group-data-[state=active]:text-primary" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="notifications" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Channels</CardTitle>
                <CardDescription>
                  Choose how you want to be notified.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label className="text-base">Push Notifications</Label>
                    <p className="text-xs text-muted-foreground">
                      Receive notifications in your browser
                    </p>
                  </div>
                  <Switch checked={notifications} onCheckedChange={setNotifications} />
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label className="text-base">Email Notifications</Label>
                    <p className="text-xs text-muted-foreground">
                      Get notified via email for important updates
                    </p>
                  </div>
                  <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Subscriptions</CardTitle>
                <CardDescription>
                  Select the types of alerts you want to receive.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="asset-expiry" className="font-normal">Asset Expiry Alerts</Label>
                  <Switch id="asset-expiry" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="low-stock" className="font-normal">Low Stock Warnings</Label>
                  <Switch id="low-stock" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="new-assets" className="font-normal">New Asset Additions</Label>
                  <Switch id="new-assets" />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="system-updates" className="font-normal">System Updates</Label>
                  <Switch id="system-updates" defaultChecked />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} size="lg" className="gap-2">
              <Save className="h-4 w-4" />
              Save Preferences
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Password & Authentication</CardTitle>
              <CardDescription>
                Update your password to keep your account secure.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleChangePassword}>
                  Update Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personalization" className="space-y-8">
          {!prefsLoaded && <div className="text-sm text-muted-foreground">Loading preferences...</div>}
          {prefsLoaded && (
            <>
              {/* Appearance Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <h3 className="text-lg font-medium">Appearance</h3>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Theme Mode</CardTitle>
                      <CardDescription>Light or dark interface</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="font-normal">Dark Mode</Label>
                        <Switch
                          checked={darkMode}
                          disabled={autoTheme}
                          onCheckedChange={(checked) => {
                            setDarkMode(checked);
                            if (checked) {
                              document.documentElement.classList.add('dark');
                            } else {
                              document.documentElement.classList.remove('dark');
                            }
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="font-normal">Auto (System)</Label>
                        <Switch checked={autoTheme} onCheckedChange={setAutoTheme} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Density & Depth</CardTitle>
                      <CardDescription>Spacing and contrast</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Interface Density</Label>
                        <Select value={density} onValueChange={(v) => setDensity(v as any)}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="comfortable">Comfortable</SelectItem>
                            <SelectItem value="compact">Compact</SelectItem>
                            <SelectItem value="ultra">Ultra Dense</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Dark Mode Depth</Label>
                        <Select value={darkLevel} onValueChange={setDarkLevel} disabled={!darkMode}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {DARK_LEVELS.map((level) => (
                              <SelectItem key={level.id} value={level.id}>{level.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="md:col-span-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">Accent Color</CardTitle>
                          <CardDescription>Primary brand color for your interface</CardDescription>
                        </div>
                        <Switch
                          checked={enableAccentColor}
                          onCheckedChange={setEnableAccentColor}
                        />
                      </div>
                    </CardHeader>
                    {enableAccentColor && (
                      <CardContent>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-3">
                          {ACCENT_COLORS.map((color) => (
                            <button
                              key={color.id}
                              onClick={() => setAccentColor(color.id)}
                              className={`group relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all hover:scale-105 ${
                                accentColor === color.id
                                  ? 'border-primary bg-primary/5 shadow-md'
                                  : 'border-border/60 hover:border-border hover:bg-muted/30'
                              }`}
                              title={color.label}
                            >
                              <span
                                className="h-8 w-8 rounded-full shadow-sm ring-2 ring-background"
                                style={{ backgroundColor: `hsl(${color.value})` }}
                              />
                              <span className="text-xs font-medium text-foreground/80">{color.label}</span>
                              {accentColor === color.id && (
                                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                  <Palette className="h-3 w-3" />
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                </div>
              </section>

              {/* Navigation Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <h3 className="text-lg font-medium">Navigation & Layout</h3>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Menu Visibility</CardTitle>
                      <CardDescription>Control what appears in your sidebar</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="font-normal">Show Newsletter</Label>
                        <Switch checked={showNewsletter} onCheckedChange={setShowNewsletter} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="font-normal">Show Help Center</Label>
                        <Switch checked={showHelpCenter} onCheckedChange={setShowHelpCenter} />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Layout Behavior</CardTitle>
                      <CardDescription>Customize how the app behaves</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="font-normal">Start Collapsed</Label>
                        <Switch checked={sidebarCollapsedPref} onCheckedChange={setSidebarCollapsedPref} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="font-normal">Sticky Header</Label>
                        <Switch checked={stickyHeader} onCheckedChange={setStickyHeader} />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="font-normal">Top Nav Mode</Label>
                        <Switch checked={topNavMode} onCheckedChange={setTopNavMode} />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </section>

              {/* System Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <h3 className="text-lg font-medium">System & Defaults</h3>
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Default Landing Page</CardTitle>
                      <CardDescription>Where you land after logging in</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        try {
                          const authRaw = (() => { try { return localStorage.getItem('auth_user'); } catch { return null; } })();
                          const r = authRaw ? ((): string => { try { return (JSON.parse(authRaw).role || '').toLowerCase(); } catch { return ''; } })() : '';
                          const canSeeApprovals = ['admin', 'manager'].includes(r);
                          return (
                            <Select value={defaultLanding || undefined} onValueChange={(v) => setDefaultLanding(v)}>
                              <SelectTrigger id="default-landing" className="w-full">
                                <SelectValue placeholder="System Default (Dashboard)" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="/dashboard">Dashboard</SelectItem>
                                <SelectItem value="/assets">Assets</SelectItem>
                                <SelectItem value="/properties">Properties</SelectItem>
                                {canSeeApprovals && <SelectItem value="/approvals">Approvals</SelectItem>}
                                <SelectItem value="/tickets">Tickets</SelectItem>
                                <SelectItem value="/reports">Reports</SelectItem>
                                <SelectItem value="/newsletter">Newsletter</SelectItem>
                                <SelectItem value="/settings">Settings</SelectItem>
                              </SelectContent>
                            </Select>
                          );
                        } catch (e) {
                          return <div className="text-xs text-destructive">Error loading options</div>;
                        }
                      })()}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Misc. Preferences</CardTitle>
                      <CardDescription>Other system toggles</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="font-normal">Beta Features</Label>
                          <p className="text-xs text-muted-foreground">Enable experimental UI</p>
                        </div>
                        <Switch checked={betaFeatures} onCheckedChange={setBetaFeatures} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="font-normal">Sound Effects</Label>
                          <p className="text-xs text-muted-foreground">UI interaction sounds</p>
                        </div>
                        <Switch checked={enableSounds} onCheckedChange={setEnableSounds} />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="font-normal">Announcements</Label>
                          <p className="text-xs text-muted-foreground">Show dashboard banner</p>
                        </div>
                        <Switch checked={showAnnouncements} onCheckedChange={setShowAnnouncements} />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </section>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={handleSave}
                  size="lg"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <Save className="h-4 w-4" />
                    Save All Changes
                  </span>
                </Button>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
