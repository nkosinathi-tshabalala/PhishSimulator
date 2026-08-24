import { useEffect, useState } from 'react';
import { ArrowLeft, Search, Eye, UserX } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import AnalyticsService from '../../services/analyticsService';

interface UserMonitoringPageProps {
  onBack: () => void;
}

interface MonitoredUser {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
  occupation: string | null;
  accuracy: number;
  simulations: number;
  last_active: string | null;
  status: string;
  created_at: string;
}

interface MonitoringData {
  users: MonitoredUser[];
  stats: {
    total_users: number;
    total_players: number;
    active_users: number;
    average_accuracy: number;
    average_simulations: number;
  };
  role_distribution: Record<string, number>;
  performance_distribution: Record<string, number>;
}

export function UserMonitoringPage({ onBack }: UserMonitoringPageProps) {
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<MonitoredUser | null>(null);
  const [error, setError] = useState('');
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);

  const loadUsers = async () => {
    try {
      const response = await AnalyticsService.getMonitoredUsers();

      if (response.ok) {
        setMonitoringData(response.data.data);
        setError('');
        return;
      }

      setError(response.data.message || 'Unable to load users.');
    } catch (loadError) {
      console.error('Unable to load monitored users.', loadError);
      setError('Unable to load users.');
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleViewUser = async (userId: number) => {
    try {
      const response = await AnalyticsService.getMonitoredUser(userId);

      if (response.ok && response.data.success) {
        setSelectedUser(response.data.data);
        setError('');
        return;
      }

      setError(response.data.message || 'Unable to load user details.');
    } catch {
      setError('Unable to load user details.');
    }
  };

  const handleDeleteUser = async (user: MonitoredUser) => {
    if (!window.confirm(`Delete ${user.full_name}'s account? This cannot be undone.`)) {
      return;
    }

    setDeletingUserId(user.user_id);
    try {
      const response = await AnalyticsService.deleteUser(user.user_id);

      if (response.ok && response.data.success) {
        if (selectedUser?.user_id === user.user_id) {
          setSelectedUser(null);
        }
        await loadUsers();
        return;
      }

      setError(response.data.message || 'Unable to delete user.');
    } catch {
      setError('Unable to delete user.');
    } finally {
      setDeletingUserId(null);
    }
  };

  const filteredUsers = (monitoringData?.users || []).filter((user) => {
    const query = searchTerm.toLowerCase();
    return user.full_name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query);
  });

  const stats = [
    { label: 'Registered Players', value: monitoringData?.stats.total_players },
    { label: 'Active Users', value: monitoringData?.stats.active_users },
    { label: 'Average Accuracy', value: monitoringData ? `${monitoringData.stats.average_accuracy}%` : undefined },
    { label: 'Avg Simulations', value: monitoringData?.stats.average_simulations },
  ];

  const formatLastActive = (value: string | null) => value
    ? new Date(value).toLocaleString()
    : 'Never';

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-semibold">User Monitoring</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value ?? '...'}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search Users</CardTitle>
            <CardDescription>Find users by name or email</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                className="pl-10"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>Monitor user activity and performance</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Occupation</TableHead>
                  <TableHead>Accuracy</TableHead>
                  <TableHead>Simulations</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.full_name}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>{user.occupation || 'Administrator'}</TableCell>
                    <TableCell>{user.role === 'PLAYER' ? `${user.accuracy}%` : '—'}</TableCell>
                    <TableCell>{user.role === 'PLAYER' ? user.simulations : '—'}</TableCell>
                    <TableCell>{formatLastActive(user.last_active)}</TableCell>
                    <TableCell>
                      <Badge variant={user.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" title={`View ${user.full_name}`} onClick={() => handleViewUser(user.user_id)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title={`Delete ${user.full_name}`} onClick={() => handleDeleteUser(user)} disabled={deletingUserId === user.user_id}>
                          <UserX className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {!filteredUsers.length && (
              <p className="py-6 text-center text-sm text-muted-foreground">No users found.</p>
            )}
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Card>
          <CardHeader>
            <CardTitle>User Distribution</CardTitle>
            <CardDescription>Breakdown by role and performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold mb-1">{monitoringData?.role_distribution.ADMIN ?? '...'}</div>
                <div className="text-sm text-muted-foreground">Administrators</div>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold mb-1">{monitoringData?.role_distribution.PLAYER ?? '...'}</div>
                <div className="text-sm text-muted-foreground">Players</div>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold mb-1">{monitoringData?.performance_distribution.high_accuracy ?? '...'}</div>
                <div className="text-sm text-muted-foreground">High Accuracy (80%+)</div>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold mb-1">{monitoringData?.performance_distribution.needs_support ?? '...'}</div>
                <div className="text-sm text-muted-foreground">Needs Support (&lt;60%)</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={selectedUser !== null} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedUser?.full_name}</DialogTitle>
            <DialogDescription>{selectedUser?.email}</DialogDescription>
          </DialogHeader>
          {selectedUser && <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">Role: </span>{selectedUser.role}</div>
            <div><span className="text-muted-foreground">Occupation: </span>{selectedUser.occupation || 'Administrator'}</div>
            <div><span className="text-muted-foreground">Accuracy: </span>{selectedUser.role === 'PLAYER' ? `${selectedUser.accuracy}%` : '—'}</div>
            <div><span className="text-muted-foreground">Simulations: </span>{selectedUser.role === 'PLAYER' ? selectedUser.simulations : '—'}</div>
            <div><span className="text-muted-foreground">Last active: </span>{formatLastActive(selectedUser.last_active)}</div>
            <div><span className="text-muted-foreground">Account status: </span>{selectedUser.status}</div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
