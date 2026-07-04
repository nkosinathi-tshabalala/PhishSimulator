import { ArrowLeft, Search, Eye, UserX } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

interface UserMonitoringPageProps {
  onBack: () => void;
}

export function UserMonitoringPage({ onBack }: UserMonitoringPageProps) {
  const users = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john.doe@example.com',
      role: 'Student',
      level: 3,
      accuracy: 78,
      simulations: 35,
      lastActive: '2 hours ago',
      status: 'Active',
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      role: 'Employee',
      level: 5,
      accuracy: 92,
      simulations: 58,
      lastActive: '1 day ago',
      status: 'Active',
    },
    {
      id: 3,
      name: 'Mike Johnson',
      email: 'mike.j@example.com',
      role: 'Student',
      level: 2,
      accuracy: 65,
      simulations: 18,
      lastActive: '3 days ago',
      status: 'Inactive',
    },
    {
      id: 4,
      name: 'Sarah Williams',
      email: 'sarah.w@example.com',
      role: 'Employee',
      level: 4,
      accuracy: 85,
      simulations: 42,
      lastActive: '5 hours ago',
      status: 'Active',
    },
  ];

  const stats = [
    { label: 'Total Users', value: '142' },
    { label: 'Active Users', value: '98' },
    { label: 'Average Accuracy', value: '76%' },
    { label: 'Avg Simulations', value: '32' },
  ];

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
                <div className="text-3xl font-bold">{stat.value}</div>
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
              <Input placeholder="Search users..." className="pl-10" />
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
                  <TableHead>Level</TableHead>
                  <TableHead>Accuracy</TableHead>
                  <TableHead>Simulations</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>{user.level}</TableCell>
                    <TableCell>{user.accuracy}%</TableCell>
                    <TableCell>{user.simulations}</TableCell>
                    <TableCell>{user.lastActive}</TableCell>
                    <TableCell>
                      <Badge variant={user.status === 'Active' ? 'default' : 'secondary'}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <UserX className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Distribution</CardTitle>
            <CardDescription>Breakdown by role and performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold mb-1">78</div>
                <div className="text-sm text-muted-foreground">Students</div>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold mb-1">54</div>
                <div className="text-sm text-muted-foreground">Employees</div>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <div className="text-2xl font-bold mb-1">10</div>
                <div className="text-sm text-muted-foreground">Others</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
