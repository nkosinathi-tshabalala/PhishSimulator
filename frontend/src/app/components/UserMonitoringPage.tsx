// Admin page: see and manage users

import { useEffect, useState } from 'react';
import { Activity, Download, LifeBuoy, ShieldCheck, Target, TrendingUp, UserCheck, UserX, Users } from 'lucide-react';
import { toast } from 'sonner';
import { confirmToast } from './confirmToast';
import { StatCard, type StatTone } from './StatCard';
import { PageHeader } from './PageHeader';
import { SortButton, useSort } from './sorting';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Skeleton } from './ui/skeleton';
import { FilterBar, toOptions } from './FilterBar';
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
  /** The address as shown: a test player's alias of the demo inbox hides that inbox. */
  email_display?: string;
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

/** Admin page to see and manage every user. */
export function UserMonitoringPage({ onBack }: UserMonitoringPageProps) {
  const [monitoringData, setMonitoringData] = useState<MonitoringData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ role: '', occupation: '', performance: '', status: '' });
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

  const handleDeleteUser = (user: MonitoredUser) => {
    confirmToast({
      id: `confirm-delete-user-${user.user_id}`,
      title: `Delete ${user.full_name}'s account?`,
      description: "Their progress and history go with it. This cannot be undone.",
      onConfirm: () => deleteUser(user),
    });
  };

  const deleteUser = async (user: MonitoredUser) => {
    setDeletingUserId(user.user_id);
    try {
      const response = await AnalyticsService.deleteUser(user.user_id);

      if (response.ok && response.data.success) {
        if (selectedUser?.user_id === user.user_id) {
          setSelectedUser(null);
        }
        toast.success(`${user.full_name}'s account was deleted.`);
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

  const performanceBand = (accuracy: number) =>
    accuracy >= 80 ? 'High (80%+)' : accuracy >= 60 ? 'Okay (60-79%)' : 'Needs support (<60%)';

  const filteredUsers = (monitoringData?.users || []).filter((user) => {
    const query = searchTerm.toLowerCase();
    const matchesSearch = user.full_name.toLowerCase().includes(query) || (user.email_display ?? user.email).toLowerCase().includes(query);
    return matchesSearch
      && (!filters.role || user.role === filters.role)
      && (!filters.occupation || (user.occupation || 'Administrator') === filters.occupation)
      && (!filters.status || user.status === filters.status)
      && (!filters.performance || (user.role === 'PLAYER' && performanceBand(user.accuracy) === filters.performance));
  });

  const table = useSort(filteredUsers, {
    name: (user) => user.full_name,
    role: (user) => user.role,
    occupation: (user) => user.occupation || 'Administrator',
    accuracy: (user) => (user.role === 'PLAYER' ? user.accuracy : null),
    simulations: (user) => (user.role === 'PLAYER' ? user.simulations : null),
    lastActive: (user) => user.last_active,
    status: (user) => user.status,
  }, { key: 'name', direction: 'asc' });

  const setFilter = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  const stats: Array<{ label: string; value: string | number | undefined; icon: typeof Users; tone: StatTone; hint: string }> = [
    { label: 'Registered Players', value: monitoringData?.stats.total_players, icon: Users, tone: 'sky', hint: 'Player accounts' },
    { label: 'Active Users', value: monitoringData?.stats.active_users, icon: UserCheck, tone: 'green', hint: 'Signed in recently' },
    { label: 'Average Accuracy', value: monitoringData ? `${monitoringData.stats.average_accuracy}%` : undefined, icon: Target, tone: 'violet', hint: 'Across all players' },
    { label: 'Avg Simulations', value: monitoringData?.stats.average_simulations, icon: Activity, tone: 'amber', hint: 'Decisions per player' },
  ];

  const formatLastActive = (value: string | null) => value
    ? new Date(value).toLocaleString()
    : 'Never';

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="User Monitoring"
        description="Every account, its activity and accuracy"
        icon={Users}
        tone="bg-pink-500/20 text-pink-300"
        onBack={onBack}
        actions={(
          <Button
            variant="outline"
            title="Download every player's progress (the private skill rank is not included)"
            onClick={async () => {
              const saved = await AnalyticsService.exportPlayerProgress();
              if (saved) toast.success('Player progress exported.');
              else toast.error('Unable to export player progress.');
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        )}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} hint={stat.hint} icon={stat.icon} tone={stat.tone} />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>Click a user to see their details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FilterBar
              search={searchTerm}
              onSearchChange={setSearchTerm}
              searchPlaceholder="Search name or email"
              filters={[
                { key: 'role', label: 'Roles', value: filters.role, options: toOptions(['PLAYER', 'ADMIN']), onChange: (value) => setFilter('role', value) },
                { key: 'occupation', label: 'Occupations', value: filters.occupation, options: toOptions(['Student', 'Employee', 'Other', 'Administrator']), onChange: (value) => setFilter('occupation', value) },
                { key: 'performance', label: 'Performance', value: filters.performance, options: toOptions(['High (80%+)', 'Okay (60-79%)', 'Needs support (<60%)']), onChange: (value) => setFilter('performance', value) },
                { key: 'status', label: 'Statuses', value: filters.status, options: toOptions(['ACTIVE', 'LOGGED_OUT', 'INACTIVE']), onChange: (value) => setFilter('status', value) },
              ]}
              onClear={() => {
                setSearchTerm('');
                setFilters({ role: '', occupation: '', performance: '', status: '' });
              }}
              resultText={`${filteredUsers.length} user(s)`}
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortButton label="User" column="name" sort={table.sort} onSort={table.toggle} /></TableHead>
                  <TableHead><SortButton label="Role" column="role" sort={table.sort} onSort={table.toggle} /></TableHead>
                  <TableHead><SortButton label="Occupation" column="occupation" sort={table.sort} onSort={table.toggle} /></TableHead>
                  <TableHead><SortButton label="Accuracy" column="accuracy" sort={table.sort} onSort={table.toggle} /></TableHead>
                  <TableHead><SortButton label="Simulations" column="simulations" sort={table.sort} onSort={table.toggle} /></TableHead>
                  <TableHead><SortButton label="Last Active" column="lastActive" sort={table.sort} onSort={table.toggle} /></TableHead>
                  <TableHead><SortButton label="Status" column="status" sort={table.sort} onSort={table.toggle} /></TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!monitoringData && [1, 2, 3, 4].map((row) => (
                  <TableRow key={row}><TableCell colSpan={8}><Skeleton className="h-8" /></TableCell></TableRow>
                ))}
                {table.sorted.map((user) => (
                  <TableRow
                    key={user.user_id}
                    className="cursor-pointer hover:bg-sky-500/5"
                    onClick={() => handleViewUser(user.user_id)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.full_name}</div>
                        <div className="text-sm text-muted-foreground">{user.email_display ?? user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>{user.occupation || 'Administrator'}</TableCell>
                    <TableCell>
                      {user.role === 'PLAYER' ? (
                        <span className={user.accuracy >= 80 ? 'text-green-400' : user.accuracy >= 60 ? 'text-amber-300' : 'text-red-400'}>
                          {user.accuracy}%
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>{user.role === 'PLAYER' ? user.simulations : '—'}</TableCell>
                    <TableCell>{formatLastActive(user.last_active)}</TableCell>
                    <TableCell>
                      <Badge className={user.status === 'ACTIVE' ? 'bg-green-500/20 text-green-300 border-0' : 'bg-muted text-muted-foreground border-0'}>
                        {user.status === 'ACTIVE' ? '● Online' : user.status.replace('_', ' ').toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          title={`Delete ${user.full_name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteUser(user);
                          }}
                          disabled={deletingUserId === user.user_id}
                        >
                          <UserX className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {monitoringData && !filteredUsers.length && (
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
              <StatCard label="Administrators" value={monitoringData?.role_distribution.ADMIN} icon={ShieldCheck} tone="amber" />
              <StatCard label="Players" value={monitoringData?.role_distribution.PLAYER} icon={Users} tone="sky" />
              <StatCard label="High accuracy" value={monitoringData?.performance_distribution.high_accuracy} hint="80% or more" icon={TrendingUp} tone="green" />
              <StatCard label="Needs support" value={monitoringData?.performance_distribution.needs_support} hint="Below 60%" icon={LifeBuoy} tone="red" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={selectedUser !== null} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedUser?.full_name}</DialogTitle>
            <DialogDescription>{selectedUser?.email_display ?? selectedUser?.email}</DialogDescription>
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
