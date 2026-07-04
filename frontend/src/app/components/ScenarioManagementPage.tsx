import { useState } from 'react';
import { ArrowLeft, Plus, Edit, Trash2, Play } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';

interface ScenarioManagementPageProps {
  onBack: () => void;
}

export function ScenarioManagementPage({ onBack }: ScenarioManagementPageProps) {
  const scenarios = [
    {
      id: 1,
      title: 'PayPal Account Verification',
      category: 'Banking',
      type: 'Email',
      difficulty: 'Medium',
      status: 'Active',
      uses: 45,
    },
    {
      id: 2,
      title: 'Bank Account Suspension SMS',
      category: 'Banking',
      type: 'SMS',
      difficulty: 'Hard',
      status: 'Active',
      uses: 32,
    },
    {
      id: 3,
      title: 'Package Delivery Notification',
      category: 'Delivery',
      type: 'Email',
      difficulty: 'Easy',
      status: 'Active',
      uses: 67,
    },
    {
      id: 4,
      title: 'IT Support Password Reset',
      category: 'Corporate',
      type: 'Email',
      difficulty: 'Medium',
      status: 'Draft',
      uses: 0,
    },
  ];

  const categories = [
    { name: 'Banking', count: 18 },
    { name: 'Delivery', count: 12 },
    { name: 'Corporate', count: 15 },
    { name: 'Social Media', count: 8 },
  ];

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-semibold">Scenario Management</h2>
        <Button className="ml-auto">
          <Plus className="w-4 h-4 mr-2" />
          Create Scenario
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Scenarios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">53</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Scenarios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">48</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Email Scenarios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">35</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                SMS Scenarios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">18</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Scenario Categories</CardTitle>
            <CardDescription>Distribution of scenarios by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categories.map((category) => (
                <div key={category.name} className="border rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold mb-1">{category.count}</div>
                  <div className="text-sm text-muted-foreground">{category.name}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Scenarios</CardTitle>
            <CardDescription>Manage and load scenarios into simulator</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scenario Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uses</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scenarios.map((scenario) => (
                  <TableRow key={scenario.id}>
                    <TableCell className="font-medium">{scenario.title}</TableCell>
                    <TableCell>{scenario.category}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{scenario.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          scenario.difficulty === 'Easy'
                            ? 'secondary'
                            : scenario.difficulty === 'Medium'
                            ? 'outline'
                            : 'default'
                        }
                      >
                        {scenario.difficulty}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={scenario.status === 'Active' ? 'default' : 'secondary'}>
                        {scenario.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{scenario.uses}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon">
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
