import { useState } from 'react';
import { ArrowLeft, Upload, FileJson, FileSpreadsheet, Trash2, Eye } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface DatasetManagementPageProps {
  onBack: () => void;
}

export function DatasetManagementPage({ onBack }: DatasetManagementPageProps) {
  const datasets = [
    { id: 1, name: 'Banking Phishing Dataset', type: 'Email', records: 234, format: 'CSV', uploaded: '2024-05-15' },
    { id: 2, name: 'SMS Scam Dataset', type: 'SMS', records: 156, format: 'JSON', uploaded: '2024-05-18' },
    { id: 3, name: 'Social Media Phishing', type: 'Email', records: 89, format: 'CSV', uploaded: '2024-05-20' },
    { id: 4, name: 'Corporate Email Threats', type: 'Email', records: 312, format: 'JSON', uploaded: '2024-05-22' },
  ];

  const stats = [
    { label: 'Total Datasets', value: '4' },
    { label: 'Total Records', value: '791' },
    { label: 'Email Scenarios', value: '635' },
    { label: 'SMS Scenarios', value: '156' },
  ];

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-semibold">Dataset Management</h2>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Dataset</CardTitle>
              <CardDescription>Import phishing datasets in CSV or JSON format</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="font-medium mb-2">Click to upload or drag and drop</p>
                <p className="text-sm text-muted-foreground">CSV or JSON files (max 10MB)</p>
                <Button className="mt-4">
                  <Upload className="w-4 h-4 mr-2" />
                  Select File
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Generate Dataset</CardTitle>
              <CardDescription>Create custom phishing scenarios</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="banking">Banking</SelectItem>
                    <SelectItem value="delivery">Delivery</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="social">Social Media</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty</Label>
                <Select>
                  <SelectTrigger id="difficulty">
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="count">Number of Scenarios</Label>
                <Input id="count" type="number" placeholder="10" min="1" max="100" />
              </div>

              <Button className="w-full">
                Generate Dataset
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Imported Datasets</CardTitle>
            <CardDescription>View and manage phishing datasets</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dataset Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datasets.map((dataset) => (
                  <TableRow key={dataset.id}>
                    <TableCell className="font-medium">{dataset.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{dataset.type}</Badge>
                    </TableCell>
                    <TableCell>{dataset.records}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {dataset.format === 'CSV' ? (
                          <FileSpreadsheet className="w-4 h-4" />
                        ) : (
                          <FileJson className="w-4 h-4" />
                        )}
                        {dataset.format}
                      </div>
                    </TableCell>
                    <TableCell>{dataset.uploaded}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="w-4 h-4" />
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

        <Card>
          <CardHeader>
            <CardTitle>Dataset Parsing</CardTitle>
            <CardDescription>Automatically extracted phishing indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span>Suspicious URLs detected</span>
                <span className="font-semibold">487</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Urgency keywords identified</span>
                <span className="font-semibold">312</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Sender spoofing patterns</span>
                <span className="font-semibold">156</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Malicious attachments</span>
                <span className="font-semibold">89</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
