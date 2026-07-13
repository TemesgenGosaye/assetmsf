import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Save, User } from 'lucide-react';
import { isDemoMode } from '@/lib/demo';
import PageHeader from '@/components/layout/PageHeader';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { Badge } from '@/components/ui/badge';
import { listUsers, updateUser, type AppUser } from '@/services/users';
import { trackActivity } from '@/services/notifications';

export default function Profile() {
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const uid = localStorage.getItem('current_user_id');
        if (!uid) return;
        const allUsers = await listUsers();
        const me = allUsers.find(u => u.id === uid);
        if (me) {
          setCurrentUser(me);
          setName(me.name || '');
          setEmail(me.email || '');
        }
      } catch (e) {
        console.error('Failed to load current user', e);
      } finally {
        setLoading(false);
      }
    }
    loadCurrentUser();
  }, []);

  const handleSave = async () => {
    if (!currentUser?.id) return;
    setSaving(true);
    try {
      await updateUser(currentUser.id, { name, email });
      await trackActivity('user', 'update', { entityName: name || currentUser.name, entityId: currentUser.id, changes: ['Profile'] });
      toast({ title: 'Profile updated', description: 'Your profile has been updated successfully.' });
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to update profile', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6"><div className="h-8 w-64 bg-muted animate-pulse rounded" /></div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Breadcrumbs />
      <PageHeader title="My Profile" subtitle="Manage your personal information" />

      <div className="mt-6 grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <Separator />
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
