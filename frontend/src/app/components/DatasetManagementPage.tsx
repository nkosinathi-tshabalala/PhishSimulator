import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Upload,
  FileJson,
  FileSpreadsheet,
  Trash2,
  Eye,
  CheckCircle2,
  LoaderCircle,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import DatasetService from "../../services/datasetService";
import { Progress } from "./ui/progress";

interface Dataset {
  dataset_id: number;

  name: string;

  dataset_type: string;

  file_format: string;

  record_count: number;

  uploaded_at: string;

  status: string;
}

interface DatasetManagementPageProps {
  onBack: () => void;
}

interface UploadResult {
  datasetType: string;
  recordCount: number;
  generatedScenarios: number;
}

export function DatasetManagementPage({ onBack }: DatasetManagementPageProps) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [datasetType, setDatasetType] = useState("EMAIL");

  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDatasets = async () => {
    const response = await DatasetService.getDatasets();

    if (response.ok && response.data.success) {
      setDatasets(response.data.data);
    }
  };

  useEffect(() => {
    loadDatasets();
  }, []);

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("Please select a dataset first.");

      return;
    }

    try {
      setUploading(true);
      setUploadResult(null);
      setUploadError("");

      const formData = new FormData();

      formData.append("file", selectedFile);

      formData.append("dataset_type", datasetType);

      const response = await DatasetService.uploadDataset(formData);

      if (response.ok && response.data.success) {
        setUploadResult({
          datasetType,
          recordCount: response.data.data.record_count,
          generatedScenarios: response.data.data.generated_scenarios,
        });
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await loadDatasets();
      } else {
        setUploadError(response.data.message || "Dataset processing could not be completed.");
      }
    } catch (error) {
      console.error(error);
      setUploadError("Dataset upload failed. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  const totalRecords = datasets.reduce((total, dataset) => total + dataset.record_count, 0);
  const emailDatasets = datasets.filter((dataset) => dataset.dataset_type === "EMAIL").length;
  const smsDatasets = datasets.filter((dataset) => dataset.dataset_type === "SMS").length;
  const stats = [
    { label: "Total Datasets", value: datasets.length },
    { label: "Total Records", value: totalRecords },
    { label: "Email Datasets", value: emailDatasets },
    { label: "SMS Datasets", value: smsDatasets },
  ];

  const handleDeleteDataset = async (datasetId: number) => {
    if (!window.confirm("Delete this uploaded dataset and its stored records?")) return;

    const response = await DatasetService.deleteDataset(datasetId);

    if (response.ok && response.data.success) {
      await loadDatasets();
      return;
    }

    alert(response.data.message || "Unable to delete dataset.");
  };

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
              <CardDescription>
                Import phishing datasets in CSV or JSON format
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed rounded-lg p-8 text-center transition-colors">
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />

                <p className="font-medium mb-2">
                  Click to upload or drag and drop
                </p>
                {selectedFile && (
                  <div className="mt-3 rounded-md border border-green-500/30 bg-green-500/10 p-3">
                    <p className="text-sm font-medium">
                      Selected:
                      {selectedFile.name}
                    </p>

                    <Button
                      variant="destructive"
                      size="sm"
                      className="mt-2"
                      onClick={() => setSelectedFile(null)}
                      disabled={uploading}
                    >
                      Remove File
                    </Button>
                    <Button
                      className="mt-4 w-full"
                      onClick={handleUpload}
                      disabled={!selectedFile || uploading}
                    >
                      {uploading ? (
                        <><LoaderCircle className="w-4 h-4 mr-2 animate-spin" />Processing dataset...</>
                      ) : "Upload and Generate Scenarios"}
                    </Button>
                  </div>
                )}

                {uploading && (
                  <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-4 text-left" role="status" aria-live="polite">
                    <div className="flex items-center gap-2 font-medium">
                      <LoaderCircle className="w-4 h-4 animate-spin" />
                      Uploading and generating simulations
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      The dataset is being saved, normalised, analysed, and converted into active {datasetType.toLowerCase()} scenarios. Large email collections can take a few minutes.
                    </p>
                    <Progress className="mt-3 animate-pulse" value={65} />
                  </div>
                )}

                {uploadResult && (
                  <div className="mt-4 rounded-md border border-green-500/30 bg-green-500/10 p-4 text-left" role="status" aria-live="polite">
                    <div className="flex items-center gap-2 font-medium text-green-700 dark:text-green-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Simulations are ready for players
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Processed {uploadResult.recordCount.toLocaleString()} records and generated {uploadResult.generatedScenarios.toLocaleString()} active {uploadResult.datasetType.toLowerCase()} scenarios. Players can take them from the Simulations page now.
                    </p>
                  </div>
                )}

                {uploadError && (
                  <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
                    {uploadError}
                  </p>
                )}

                <p className="text-sm text-muted-foreground">
                  Upload source email or SMS examples from approved training datasets. CSV/JSON files are normalized, analyzed for phishing cues, and labeled rows become simulator scenarios.
                </p>

                <div className="mt-4 text-left">
                  <Label htmlFor="dataset-type">Simulation Type</Label>
                  <Select value={datasetType} onValueChange={setDatasetType} disabled={uploading}>
                    <SelectTrigger id="dataset-type" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMAIL">Email</SelectItem>
                      <SelectItem value="SMS">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.json"
                    hidden
                    onChange={(e) => {
                      if (e.target.files?.length) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                  />

                  <Button
                    className="mt-4"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Select File
                  </Button>
                </>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What Happens After Upload</CardTitle>
              <CardDescription>
                Dataset processing workflow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>1. Common columns such as sender/from, subject/title, body/content/text, and label/is_phishing are mapped to the training schema.</p>
              <p>2. The processor identifies URLs, urgency language, and credential requests to set phishing cues and an initial difficulty.</p>
              <p>3. Records with a phishing or legitimate label become Email or SMS scenarios. Unlabeled records remain stored for review and are not used in simulations.</p>
              <p>Use approved training data such as the Phish No More collections or your organization&apos;s authorized examples.</p>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datasets.map((dataset) => (
                  <TableRow key={dataset.dataset_id}>
                    <TableCell className="font-medium">
                      {dataset.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{dataset.dataset_type}</Badge>
                    </TableCell>
                    <TableCell>{dataset.record_count}</TableCell>
                    <TableCell>
                      <Badge variant={dataset.status === "GENERATED" ? "default" : "secondary"}>
                        {dataset.status === "GENERATED" ? "Scenarios ready" : dataset.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {dataset.file_format === "CSV" ? (
                          <FileSpreadsheet className="w-4 h-4" />
                        ) : (
                          <FileJson className="w-4 h-4" />
                        )}
                        {dataset.file_format}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(dataset.uploaded_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" title={`View ${dataset.name}`} onClick={() => alert(`${dataset.name}: ${dataset.record_count} records, status ${dataset.status}`)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title={`Delete ${dataset.name}`} onClick={() => handleDeleteDataset(dataset.dataset_id)}>
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
            <CardTitle>Dataset Processing Summary</CardTitle>
            <CardDescription>
              Current stored dataset status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center"><span>Generated datasets</span><span className="font-semibold">{datasets.filter((dataset) => dataset.status === "GENERATED").length}</span></div>
              <div className="flex justify-between items-center"><span>Datasets needing labels</span><span className="font-semibold">{datasets.filter((dataset) => dataset.status === "NEEDS_LABELS").length}</span></div>
              <div className="flex justify-between items-center"><span>Email records uploaded</span><span className="font-semibold">{datasets.filter((dataset) => dataset.dataset_type === "EMAIL").reduce((total, dataset) => total + dataset.record_count, 0)}</span></div>
              <div className="flex justify-between items-center"><span>SMS records uploaded</span><span className="font-semibold">{datasets.filter((dataset) => dataset.dataset_type === "SMS").reduce((total, dataset) => total + dataset.record_count, 0)}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
