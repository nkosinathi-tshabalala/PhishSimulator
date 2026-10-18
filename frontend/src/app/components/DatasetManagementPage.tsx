// Admin page: upload and manage datasets (CATCH "Approve")

import { useEffect, useRef, useState } from "react";
import {
  Upload,
  FileJson,
  FileSpreadsheet,
  Trash2,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  Database,
  Rows3,
  Mail,
  MessageSquare,
} from "lucide-react";
import { StatCard, type StatTone } from "./StatCard";
import { PageHeader } from "./PageHeader";
import { SortButton, useSort } from "./sorting";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import DatasetService from "../../services/datasetService";
import { deleteDataset, startUpload, useDatasetJobs, type QualityReport } from "../../services/datasetJobs";
import { toast } from "sonner";
import { confirmToast } from "./confirmToast";
import { FilterBar, toOptions } from "./FilterBar";
import { ChannelBadge, StatusBadge } from "./visuals";
import { Skeleton } from "./ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import type { ScenarioStatus } from "../../types/catch";
import { Progress } from "./ui/progress";

interface Dataset {
  dataset_id: number;
  name: string;
  dataset_type: string;
  file_format: string;
  record_count: number;
  uploaded_at: string;
  status: string;
  scenario_counts: Record<string, number>;
  quality_report: QualityReport | null;
}

interface DatasetManagementPageProps {
  onBack: () => void;
}


/** Admin page to upload, check and manage datasets. */
export function DatasetManagementPage({ onBack }: DatasetManagementPageProps) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [datasetType, setDatasetType] = useState("EMAIL");

  // Uploads and deletions run in a store outside this page, so leaving the page does not stop them
  const jobs = useDatasetJobs();
  const uploading = jobs.upload !== null;
  const uploadResult = jobs.result;
  const uploadError = jobs.error;
  const rejectedReport = jobs.rejectedReport;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isReprocessing, setIsReprocessing] = useState(false);

  /** Re-apply the realism rules to the dataset's drafts. */
  const handleReprocess = async (datasetId: number) => {
    setIsReprocessing(true);
    const response = await DatasetService.reprocessDataset(datasetId);
    setIsReprocessing(false);
    if (response.ok && response.data.success) toast.success(response.data.message);
    else toast.error(response.data.message || "Unable to re-run processing.");
  };

  const loadDatasets = async () => {
    const response = await DatasetService.getDatasets();

    if (response.ok && response.data.success) {
      setDatasets(response.data.data);
    }
    setIsLoadingList(false);
  };

  // Load the list, and again whenever an upload or deletion finishes (even one started before this page opened)
  useEffect(() => {
    loadDatasets();
  }, [jobs.version]);

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.warning("Please select a dataset first.");
      return;
    }
    const file = selectedFile;
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await startUpload(file, datasetType);
  };

  const visibleDatasets = datasets.filter((dataset) =>
    dataset.name.toLowerCase().includes(search.toLowerCase())
    && (!typeFilter || dataset.dataset_type === typeFilter)
    && (!statusFilter || dataset.status === statusFilter),
  );

  const totalRecords = datasets.reduce((total, dataset) => total + dataset.record_count, 0);
  const inReview = (dataset: Dataset) => (dataset.scenario_counts.DRAFT ?? 0) + (dataset.scenario_counts.APPROVED ?? 0);
  const table = useSort(visibleDatasets, {
    name: (dataset) => dataset.name,
    type: (dataset) => dataset.dataset_type,
    records: (dataset) => dataset.record_count,
    inReview,
    status: (dataset) => dataset.status,
    format: (dataset) => dataset.file_format,
    uploaded: (dataset) => dataset.uploaded_at,
  }, { key: "uploaded", direction: "desc" });

  const emailDatasets = datasets.filter((dataset) => dataset.dataset_type === "EMAIL").length;
  const smsDatasets = datasets.filter((dataset) => dataset.dataset_type === "SMS").length;
  const stats: Array<{ label: string; value: number; icon: typeof Database; tone: StatTone; hint: string }> = [
    { label: "Total Datasets", value: datasets.length, icon: Database, tone: "violet", hint: "Uploaded files" },
    { label: "Total Records", value: totalRecords, icon: Rows3, tone: "sky", hint: "Rows across all datasets" },
    { label: "Email Datasets", value: emailDatasets, icon: Mail, tone: "blue", hint: "Feed email training" },
    { label: "SMS Datasets", value: smsDatasets, icon: MessageSquare, tone: "green", hint: "Feed SMS training" },
  ];

  const handleDeleteDataset = (dataset: Dataset) => {
    confirmToast({
      id: `confirm-delete-dataset-${dataset.dataset_id}`,
      title: `Delete ${dataset.name}?`,
      description: "Its records, the scenarios made from it and players' attempts on them are removed. This cannot be undone.",
      onConfirm: () => deleteDataset(dataset.dataset_id, dataset.name),
    });
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title="Dataset Management"
        description="Upload phishing datasets; labelled rows become draft scenarios for review"
        icon={Database}
        tone="bg-emerald-500/15 text-emerald-300"
        onBack={onBack}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value.toLocaleString()} hint={stat.hint} icon={stat.icon} tone={stat.tone} />
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
                      {jobs.upload?.fileName} is being checked for quality and converted into draft{" "}
                      {jobs.upload?.datasetType.toLowerCase()} scenarios. Large files can take a few minutes; you can
                      leave this page and it keeps going.
                    </p>
                    <Progress className="mt-3 animate-pulse" value={65} />
                  </div>
                )}

                {uploadResult && (
                  <div className="mt-4 rounded-md border border-green-500/30 bg-green-500/10 p-4 text-left" role="status" aria-live="polite">
                    <div className="flex items-center gap-2 font-medium text-green-700 dark:text-green-400">
                      <CheckCircle2 className="w-4 h-4" />
                      Quality check passed: drafts are ready for review
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Processed {uploadResult.recordCount.toLocaleString()} records and created{" "}
                      {uploadResult.generatedScenarios.toLocaleString()} draft{" "}
                      {uploadResult.datasetType.toLowerCase()} scenarios. Review and activate them in
                      Scenario Review before players can see them.
                    </p>
                    <QualityReportSummary report={uploadResult.qualityReport} />
                    {uploadResult.generatedByCategory.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {uploadResult.generatedByCategory.map((item) => (
                          <Badge key={item.category} variant="secondary">
                            {item.category}: {item.count.toLocaleString()}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {uploadError && (
                  <div
                    className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-left text-sm text-destructive"
                    role="alert"
                  >
                    <p>{uploadError}</p>
                    {rejectedReport && <QualityReportSummary report={rejectedReport} />}
                  </div>
                )}

                <p className="text-sm text-muted-foreground">
                  Upload email or SMS examples from approved training datasets. Files are quality-checked,
                  analysed for clues, and labelled rows become draft scenarios for admin review.
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
              <p>
                1. <strong>Check file + quality report:</strong> empty, very short and duplicate rows are
                counted. If over half the rows are unusable, or none are labelled, the dataset is rejected.
              </p>
              <p>
                2. <strong>Clues and difficulty:</strong> links, look-alike senders, urgency, credential
                requests, threats and prizes become clues. Many obvious clues = Easy, few subtle clues = Hard.
              </p>
              <p>
                3. <strong>Draft scenarios:</strong> labelled rows become drafts under this dataset.
                Unlabelled rows are stored but never used.
              </p>
              <p>
                4. <strong>Admin review:</strong> preview each draft with the QA checklist, then Approve,
                then Activate. Only active scenarios reach players.
              </p>
              <p>Use approved training data such as the Phish No More collections or your organization&apos;s authorized examples.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Imported Datasets</CardTitle>
            <CardDescription>Click a dataset to see its quality report</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search dataset name"
              filters={[
                { key: "type", label: "Types", value: typeFilter, options: toOptions(["EMAIL", "SMS"]), onChange: setTypeFilter },
                {
                  key: "status",
                  label: "Statuses",
                  value: statusFilter,
                  options: toOptions([...new Set(datasets.map((dataset) => dataset.status))]),
                  onChange: setStatusFilter,
                },
              ]}
              onClear={() => {
                setSearch("");
                setTypeFilter("");
                setStatusFilter("");
              }}
              resultText={`${visibleDatasets.length} dataset(s)`}
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortButton label="Dataset Name" column="name" sort={table.sort} onSort={table.toggle} /></TableHead>
                  <TableHead><SortButton label="Type" column="type" sort={table.sort} onSort={table.toggle} /></TableHead>
                  <TableHead><SortButton label="Records" column="records" sort={table.sort} onSort={table.toggle} /></TableHead>
                  <TableHead><SortButton label="In review / Active" column="inReview" sort={table.sort} onSort={table.toggle} /></TableHead>
                  <TableHead><SortButton label="Status" column="status" sort={table.sort} onSort={table.toggle} /></TableHead>
                  <TableHead><SortButton label="Format" column="format" sort={table.sort} onSort={table.toggle} /></TableHead>
                  <TableHead><SortButton label="Uploaded" column="uploaded" sort={table.sort} onSort={table.toggle} /></TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingList && [1, 2].map((row) => (
                  <TableRow key={row}><TableCell colSpan={8}><Skeleton className="h-8" /></TableCell></TableRow>
                ))}
                {table.sorted.map((dataset) => (
                  <TableRow
                    key={dataset.dataset_id}
                    className="cursor-pointer hover:bg-sky-500/5"
                    onClick={() => setSelectedDataset(dataset)}
                  >
                    <TableCell className="font-medium">
                      {dataset.name}
                    </TableCell>
                    <TableCell>
                      <ChannelBadge channel={dataset.dataset_type} />
                    </TableCell>
                    <TableCell>{dataset.record_count}</TableCell>
                    <TableCell>
                      {inReview(dataset)}
                      {" / "}
                      {dataset.scenario_counts.ACTIVE ?? 0}
                    </TableCell>
                    <TableCell>
                      <Badge variant={dataset.status === "IN_REVIEW" ? "default" : "secondary"}>
                        {dataset.status === "IN_REVIEW" ? "In review" : dataset.status}
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
                        <Button
                          variant="ghost"
                          size="icon"
                          title={jobs.deleting.includes(dataset.dataset_id) ? `Deleting ${dataset.name}...` : `Delete ${dataset.name}`}
                          disabled={jobs.deleting.includes(dataset.dataset_id)}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteDataset(dataset);
                          }}
                        >
                          {jobs.deleting.includes(dataset.dataset_id)
                            ? <LoaderCircle className="w-4 h-4 animate-spin" aria-label="Deleting" />
                            : <Trash2 className="w-4 h-4" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoadingList && !visibleDatasets.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                      No datasets match these filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={Boolean(selectedDataset)} onOpenChange={(open) => !open && setSelectedDataset(null)}>
          <DialogContent className="max-w-xl">
            {selectedDataset && (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedDataset.name}</DialogTitle>
                  <DialogDescription>
                    {selectedDataset.record_count.toLocaleString()} records · uploaded{" "}
                    {new Date(selectedDataset.uploaded_at).toLocaleDateString()}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Scenarios by review stage</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedDataset.scenario_counts).map(([status, count]) => (
                        <span key={status} className="flex items-center gap-1 text-sm">
                          <StatusBadge status={status as ScenarioStatus} /> {count.toLocaleString()}
                        </span>
                      ))}
                      {!Object.keys(selectedDataset.scenario_counts).length && (
                        <span className="text-sm text-muted-foreground">No scenarios.</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">Quality report</h4>
                    {selectedDataset.quality_report
                      ? <QualityReportSummary report={selectedDataset.quality_report} />
                      : <p className="text-sm text-muted-foreground">Uploaded before quality reports existed.</p>}
                  </div>
                  <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 flex items-start gap-3">
                    <div className="flex-1 text-xs text-muted-foreground">
                      Re-run processing to give unreviewed drafts the latest realism rules: links hidden behind
                      button text, sender display names, attachments and a fresh quality score. Reviewed
                      scenarios keep their content and are only re-scored.
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isReprocessing}
                      onClick={() => handleReprocess(selectedDataset.dataset_id)}
                    >
                      {isReprocessing
                        ? <LoaderCircle className="w-4 h-4 mr-1 animate-spin" />
                        : <RefreshCw className="w-4 h-4 mr-1" />}
                      Re-run processing
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <CardTitle>Dataset Processing Summary</CardTitle>
            <CardDescription>
              Current stored dataset status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <SummaryRow
                label="Drafts awaiting review"
                value={datasets.reduce((total, dataset) => total + (dataset.scenario_counts.DRAFT ?? 0), 0)}
              />
              <SummaryRow
                label="Active scenarios from datasets"
                value={datasets.reduce((total, dataset) => total + (dataset.scenario_counts.ACTIVE ?? 0), 0)}
              />
              <SummaryRow
                label="Email records uploaded"
                value={datasets
                  .filter((dataset) => dataset.dataset_type === "EMAIL")
                  .reduce((total, dataset) => total + dataset.record_count, 0)}
              />
              <SummaryRow
                label="SMS records uploaded"
                value={datasets
                  .filter((dataset) => dataset.dataset_type === "SMS")
                  .reduce((total, dataset) => total + dataset.record_count, 0)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** A label and number in the dataset summary. */
function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-center">
      <span>{label}</span>
      <span className="font-semibold">{value.toLocaleString()}</span>
    </div>
  );
}

/** Why rows in an upload were kept or skipped. */
function QualityReportSummary({ report }: { report: QualityReport }) {
  const rows = [
    ["Rows in file", report.total_rows],
    ["Usable labelled rows", report.usable_labelled],
    ["Unlabelled (stored, not used)", report.unlabelled],
    ["Empty rows", report.empty_rows],
    ["Too short", report.too_short],
    ["Too long (raw mail dumps)", report.too_long ?? 0],
    ["Unreadable (pre-processed text)", report.unreadable ?? 0],
    ["Duplicates", report.duplicates],
    ["Contain emails / phone numbers", report.personal_data],
  ] as const;

  return (
    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-2">
          <span>{label}</span>
          <span className="font-medium text-foreground">{value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
