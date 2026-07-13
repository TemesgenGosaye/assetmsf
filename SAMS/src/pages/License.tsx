import { cn } from '@/lib/utils';
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { listProperties, createProperty as sbCreateProperty, type Property } from '@/services/properties';
import { trackActivity } from '@/services/notifications';
import { listAssets } from '@/services/assets';
import { getPropertyLicense, listPropertyLicenses, upsertPropertyLicense, type LicensePlan } from '@/services/license';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { Building2, ShieldCheck, Save, RefreshCw, Lock, Plus, Eye, EyeOff, AlertCircle, Loader2, CheckCircle2, XCircle, MoreHorizontal, Edit, Crown, MapPin, Hash, Users, Maximize2, Minimize2 } from 'lucide-react';
import { loginWithPassword } from '@/services/auth';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface PropertyRow extends Property { assetCount: number; licenseLimit: number; plan?: LicensePlan | null; derived?: number | null; }

export default function LicensePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  
  // Edit Dialog State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<PropertyRow | null>(null);
  const [editForm, setEditForm] = useState<{ plan: LicensePlan | 'none'; limit: string }>({ plan: 'none', limit: '0' });
  const [saving, setSaving] = useState(false);
  const [role, setRole] = useState<string>('');
  const [addOpen, setAddOpen] = useState(false);
  const [editExpanded, setEditExpanded] = useState(false);
  const [addExpanded, setAddExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState<{ id: string; name: string; address: string; type: string; status: string; manager: string }>({ id: '', name: '', address: '', type: 'Office', status: 'Active', manager: '' });
  const [newPlan, setNewPlan] = useState<LicensePlan | 'none'>('none');
  const [newLimit, setNewLimit] = useState<string>('0');
  
  // Detail sheet state
  const [detailProperty, setDetailProperty] = useState<PropertyRow | null>(null);

  // Password confirmation gate
  const [authOpen, setAuthOpen] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const SESSION_KEY = 'license_access_verified_at';

  const reload = async () => {
    setLoading(true);
    try {
      const [props, assets, propLicenses] = await Promise.all([
        listProperties().catch(() => []),
        listAssets().catch(() => []),
        listPropertyLicenses().catch(() => [])
      ]);
      const mapLic: Record<string, { limit: number; plan?: LicensePlan | null; } > = {};
      for (const l of propLicenses as any[]) mapLic[l.property_id] = { limit: l.asset_limit, plan: l.plan };
      const assetCounts: Record<string, number> = {};
      for (const a of assets) {
        const pid = a.property_id || a.property;
        if (!pid) continue;
        assetCounts[pid] = (assetCounts[pid] || 0) + 1;
      }
      
      const rows: PropertyRow[] = props.map(p => {
        const entry = mapLic[p.id];
        const plan = entry?.plan;
        const rawLimit = entry?.limit ?? 0;
        const derived = rawLimit === 0 ? derivedFromPlan(plan) : null;
        const effective = rawLimit > 0 ? rawLimit : (derived ?? 0);
        return { ...p, assetCount: assetCounts[p.id] || 0, licenseLimit: effective, plan, derived };
      });
      setProperties(rows);
    } catch (e:any) {
      console.error(e);
      toast.error('Failed to load license data');
    } finally {
      setLoading(false);
    }
  };

  function derivedFromPlan(plan?: LicensePlan | null): number | null {
    switch (plan) {
      case 'free': return 100;
      case 'standard': return 500;
      case 'pro': return 2500;
      case 'business': return null;
      default: return null;
    }
  }

  function LicenseDetailSheet({ property, open, onClose }: {
    property: PropertyRow | null; open: boolean; onClose: () => void;
  }) {
    if (!property) return null;
    const limit = property.licenseLimit;
    const usage = property.assetCount;
    const pct = limit > 0 ? Math.min(100, Math.round((usage / limit) * 100)) : 0;
    const isUnlimited = limit === 0;
    const Field = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) => (
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <div className="mt-0.5 text-sm font-medium break-words">{value}</div>
        </div>
      </div>
    );
    return (
      <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 overflow-hidden">
          <div className="relative bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent px-6 pt-8 pb-6 border-b border-border/60">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-violet-500/15 flex items-center justify-center shadow-sm ring-2 ring-violet-500/20">
                <Crown className="h-8 w-8 text-violet-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold">{property.name}</p>
                <p className="mt-1 text-sm text-muted-foreground font-mono">{property.id}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> {property.status}
                  </span>
                  {property.plan && (
                    <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary capitalize">{property.plan}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Property Details</p>
              <div className="space-y-3">
                <Field icon={Building2}     label="Property" value={property.name} />
                <Field icon={Hash}          label="ID"       value={<span className="font-mono">{property.id}</span>} />
                <Field icon={MapPin}        label="Type"     value={property.type} />
                <Field icon={MapPin}        label="Address"  value={property.address || <span className="text-muted-foreground/40">—</span>} />
                <Field icon={ShieldCheck}   label="Plan"     value={property.plan ? <span className="capitalize">{property.plan}</span> : <span className="text-muted-foreground/40">Not set</span>} />
              </div>
            </div>
            <Separator />
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Utilization</p>
              <div className="space-y-3">
                <Field icon={Users} label="Assets" value={`${usage} used${isUnlimited ? " · Unlimited" : ` · Limit: ${limit}`}`} />
                {!isUnlimited && (
                  <div className="pl-11">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Capacity used</span>
                      <span className={pct >= 90 ? "text-destructive font-medium" : "text-muted-foreground"}>{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                )}
              </div>
            </div>
            {property.manager && (
              <>
                <Separator />
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Management</p>
                  <Field icon={ShieldCheck} label="Manager" value={property.manager} />
                </div>
              </>
            )}
          </div>
          <div className="border-t border-border/60 bg-muted/10 px-6 py-4 space-y-2">
            <Button className="w-full gap-2" variant="default" onClick={() => { onClose(); openEditDialog(property); }}>
              <Edit className="h-4 w-4" /> Edit License
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Determine current user and role; only admins allowed and require password confirmation
  useEffect(() => {
    try {
      const raw = localStorage.getItem('auth_user');
      const u = raw ? JSON.parse(raw) : null;
      const role = ((u?.role || '') as string).toLowerCase();
      const email = (u?.email || '') as string;
      if (!email) {
        toast.error('Not signed in');
        navigate('/login');
        return;
      }
      setAdminEmail(email);
      if (role !== 'admin') {
        toast.error('Unauthorized');
        navigate('/');
        return;
      }
      // If recently verified in this session (5 min), skip prompt
      try {
        const ts = Number(sessionStorage.getItem(SESSION_KEY) || '0');
        if (ts && Date.now() - ts < 5 * 60 * 1000) {
          setAuthorized(true);
          setAuthOpen(false);
        }
      } catch {}
    } catch {}
  }, [navigate]);

  // Load only after authorization
  useEffect(() => { if (authorized) reload(); }, [authorized]);

  const totalUsage = useMemo(() => properties.reduce((s,p)=> s + p.assetCount, 0), [properties]);
  const totalLimit = useMemo(() => properties.reduce((s,p)=> s + (p.licenseLimit || 0), 0), [properties]); // Note: 0 means unlimited, so this sum is just for finite limits

  const openEditDialog = (prop: PropertyRow) => {
    setSelectedProperty(prop);
    setEditForm({
      plan: (prop.plan || 'none') as LicensePlan | 'none',
      limit: prop.derived != null ? '0' : String(prop.licenseLimit)
    });
    setEditDialogOpen(true);
  };

  const handleSaveLicense = async () => {
    if (!selectedProperty) return;
    setSaving(true);
    try {
      const plan = editForm.plan === 'none' ? null : editForm.plan;
      let n = Number(editForm.limit);
      if (!Number.isFinite(n) || n < 0) n = 0;
      
      // For non-business plans numeric should be 0 (derive on read) unless explicitly overriding? 
      // Logic from before: "For non-business plans numeric should be 0"
      const toStore = plan && plan !== 'business' ? 0 : n;
      
      await upsertPropertyLicense(selectedProperty.id, toStore, plan);
      toast.success('License updated successfully');
      await trackActivity("license", "update", { entityName: selectedProperty.name, entityId: selectedProperty.id });
      setEditDialogOpen(false);
      await reload();
    } catch (e:any) {
      toast.error(e.message || 'Failed to update license');
    } finally {
      setSaving(false);
    }
  };

  async function handleCreateProperty() {
    try {
      if (!newForm.name.trim()) { toast.error('Enter a property name'); return; }
      setAdding(true);
      // Generate ID if missing
      const id = newForm.id.trim() || `PROP-${Math.floor(Math.random()*900+100)}`;
      let created: Property | null = null;
      created = await sbCreateProperty({
        id,
        name: newForm.name.trim(),
        address: newForm.address.trim() || null,
        type: newForm.type,
        status: newForm.status,
        manager: newForm.manager.trim() || null,
      } as Property);

      // Compute license store values
      const plan = newPlan === 'none' ? null : newPlan;
      let n = Number(newLimit);
      if (!Number.isFinite(n) || n < 0) n = 0;
      const toStore = plan && plan !== 'business' ? 0 : n;
      await upsertPropertyLicense(id, toStore, plan);

      await reload();

      setAddOpen(false);
      setNewForm({ id: '', name: '', address: '', type: 'Office', status: 'Active', manager: '' });
      setNewPlan('none');
      setNewLimit('0');
      toast.success('Property created');
      await trackActivity("property", "create", { entityName: newForm.name.trim(), entityId: id });
    } catch (e:any) {
      console.error(e);
      toast.error(e?.message || 'Failed to create property');
    } finally {
      setAdding(false);
    }
  }

  if (!authorized) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-4">
        <Card className="w-full max-w-md border bg-card shadow-lg">
          <CardHeader className="space-y-1 text-center pb-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Lock className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Admin Verification</CardTitle>
            <CardDescription>
              Please verify your identity to access license management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!adminEmail) { toast.error('Not signed in'); return; }
                try {
                  setVerifying(true);
                  setAuthError(null);
                  const u = await loginWithPassword(adminEmail, password);
                  if (!u || (u.role || '').toLowerCase() !== 'admin') {
                    const msg = 'Invalid password. Please try again.';
                    setAuthError(msg);
                    toast.error(msg);
                    setVerifying(false);
                    return;
                  }
                  setAuthorized(true);
                  setAuthOpen(false);
                  try { sessionStorage.setItem(SESSION_KEY, String(Date.now())); } catch {}
                } catch (e:any) {
                  const msg = e?.message || 'Verification failed';
                  setAuthError(String(msg));
                  toast.error(msg);
                } finally {
                  setVerifying(false);
                  setPassword('');
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={verifying}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {authError && (
                  <p className="text-sm text-destructive flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {authError}
                  </p>
                )}
              </div>
              <Button className="w-full" type="submit" disabled={!password || verifying}>
                {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {verifying ? "Verifying..." : "Verify Access"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center border-t bg-muted/50 py-4">
            <p className="text-xs text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{adminEmail}</span>
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="space-y-4 print:hidden">
        <Breadcrumbs items={[{ label: "Dashboard", to: "/" }, { label: "License" }]} />
        
        <div className="relative overflow-hidden rounded-3xl border bg-card px-8 py-10 shadow-sm sm:px-12 sm:py-12">
          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl space-y-4">
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                License Management
              </h1>
              <p className="text-lg text-muted-foreground">
                Configure global and per-property asset allowances and plans.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setAddOpen(true)} className="gap-2 shadow-md">
                <Plus className="h-4 w-4" />
                Add Property
              </Button>
              <Button variant="outline" onClick={reload} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
          <div className="absolute right-0 top-0 -z-10 h-full w-1/3 bg-gradient-to-l from-primary/5 to-transparent" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{properties.length}</div>
            <p className="text-xs text-muted-foreground">Active locations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Assets Managed</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsage}</div>
            <p className="text-xs text-muted-foreground">Across all properties</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Global Status</CardTitle>
            <Crown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">Unlimited</div>
            <p className="text-xs text-muted-foreground">Enterprise License Active</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="bg-muted/30 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Property Licenses</CardTitle>
              <CardDescription>Manage plans and asset limits for each property</CardDescription>
            </div>
          </div>
        </CardHeader>
        <div className="relative overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[250px]">Property</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Current Plan</TableHead>
                <TableHead className="w-[200px]">Utilization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : properties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No properties found.
                  </TableCell>
                </TableRow>
              ) : (
                properties.map((prop) => {
                  const limit = prop.licenseLimit;
                  const usage = prop.assetCount;
                  const pct = limit > 0 ? Math.min(100, Math.round((usage / limit) * 100)) : 0;
                  const isUnlimited = limit === 0;
                  
                  return (
                    <TableRow key={prop.id} className="hover:bg-muted/5 cursor-pointer select-none" onDoubleClick={() => setDetailProperty(prop)}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{prop.name}</span>
                          <span className="text-xs text-muted-foreground font-mono">{prop.id}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {prop.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {prop.plan ? (
                          <Badge variant="secondary" className="capitalize">
                            {prop.plan}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">{usage} assets</span>
                            <span className="text-muted-foreground">
                              {isUnlimited ? "Unlimited" : `Limit: ${limit}`}
                            </span>
                          </div>
                          {!isUnlimited && (
                            <Progress value={pct} className="h-1.5" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {prop.status === 'Active' ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm">{prop.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(prop)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit License
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Edit License Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(o) => { setEditDialogOpen(o); if (!o) setEditExpanded(false); }}>
        <DialogContent className={cn(
          "p-0 gap-0 overflow-hidden transition-all duration-200",
          editExpanded
            ? "w-full h-full max-w-none max-h-none rounded-none sm:w-[95vw] sm:max-w-[95vw] sm:h-[95vh] sm:max-h-[95vh] sm:rounded-lg"
            : "sm:max-w-md max-h-[90vh]"
        )}>
          <DialogHeader className="flex flex-row items-start justify-between space-y-0 pr-14 text-left border-b border-border/60 bg-muted/10 px-6 py-5">
            <div className="space-y-0.5">
              <DialogTitle>Edit License</DialogTitle>
              <DialogDescription>Update plan and limits for <span className="font-medium text-foreground">{selectedProperty?.name}</span></DialogDescription>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditExpanded(!editExpanded)} title={editExpanded ? "Collapse" : "Expand"}>
              {editExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>License Plan</Label>
              <Select 
                value={editForm.plan} 
                onValueChange={(v) => {
                  const p = v as LicensePlan | 'none';
                  setEditForm(prev => ({
                    ...prev,
                    plan: p,
                    limit: p !== 'business' && p !== 'none' ? '0' : prev.limit
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Custom Limit)</SelectItem>
                  <SelectItem value="free">Free (100 Assets)</SelectItem>
                  <SelectItem value="standard">Standard (500 Assets)</SelectItem>
                  <SelectItem value="pro">Pro (2,500 Assets)</SelectItem>
                  <SelectItem value="business">Business (Custom)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Asset Limit</Label>
              <Input
                value={editForm.limit}
                onChange={(e) => setEditForm(prev => ({ ...prev, limit: e.target.value.replace(/[^0-9]/g, '') }))}
                disabled={editForm.plan !== 'business' && editForm.plan !== 'none'}
                placeholder="0 for unlimited"
              />
              <p className="text-xs text-muted-foreground">
                {editForm.plan !== 'business' && editForm.plan !== 'none' 
                  ? `Limit is derived from ${editForm.plan} plan.` 
                  : "Set to 0 for unlimited assets."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveLicense} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LicenseDetailSheet property={detailProperty} open={!!detailProperty} onClose={() => setDetailProperty(null)} />

      {/* Add Property Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Property</DialogTitle>
            <DialogDescription>Create a property and assign an initial license.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Property ID</Label>
                <Input 
                  placeholder="Auto-generated" 
                  value={newForm.id} 
                  onChange={(e) => setNewForm(prev => ({ ...prev, id: e.target.value }))} 
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newForm.type} onValueChange={(v) => setNewForm(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Office">Office</SelectItem>
                    <SelectItem value="Storage">Storage</SelectItem>
                    <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="Site Office">Site Office</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Property Name</Label>
              <Input 
                placeholder="e.g. Head Office" 
                value={newForm.name} 
                onChange={(e) => setNewForm(prev => ({ ...prev, name: e.target.value }))} 
              />
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input 
                placeholder="Optional address" 
                value={newForm.address} 
                onChange={(e) => setNewForm(prev => ({ ...prev, address: e.target.value }))} 
              />
            </div>

            <div className="rounded-lg border p-4 space-y-4 bg-muted/30">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Initial License</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Plan</Label>
                  <Select 
                    value={newPlan} 
                    onValueChange={(v) => {
                      const p = v as LicensePlan | 'none';
                      setNewPlan(p);
                      if (p !== 'business' && p !== 'none') setNewLimit('0');
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="pro">Pro</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Limit</Label>
                  <Input 
                    className="h-9"
                    value={newLimit}
                    onChange={(e) => setNewLimit(e.target.value.replace(/[^0-9]/g, ''))}
                    disabled={newPlan !== 'business' && newPlan !== 'none'}
                    placeholder="0 = unlimited"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateProperty} disabled={adding}>
              {adding ? "Creating..." : "Create Property"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
