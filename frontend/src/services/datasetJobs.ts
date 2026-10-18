// Dataset uploads and deletions that keep running while the admin moves to another page. Their state lives
// here, outside the Datasets page, so leaving the page neither stops the work nor loses its result; a toast
// (shown on every page) says when it is done. A full page reload still loses this state, though the server
// finishes the upload either way and the dataset then appears in the list.

import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import DatasetService from "./datasetService";

/** Result of the upload quality check (CATCH "Approve" stage). */
export interface QualityReport {
  total_rows: number;
  empty_rows: number;
  too_short: number;
  too_long?: number;
  unreadable?: number;
  duplicates: number;
  unlabelled: number;
  personal_data: number;
  usable_labelled: number;
  quality_ok: boolean;
}

export interface UploadResult {
  datasetType: string;
  recordCount: number;
  generatedScenarios: number;
  generatedByCategory: Array<{ category: string; count: number }>;
  qualityReport: QualityReport;
}

export interface DatasetJobs {
  // The upload in progress (one at a time)
  upload: { fileName: string; datasetType: string } | null;
  // The outcome of the last upload, kept until the next one starts
  result: UploadResult | null;
  error: string;
  rejectedReport: QualityReport | null;
  // Datasets being deleted right now
  deleting: number[];
  // Goes up whenever the list of datasets changed, so an open Datasets page reloads it
  version: number;
}

let state: DatasetJobs = { upload: null, result: null, error: "", rejectedReport: null, deleting: [], version: 0 };
const listeners = new Set<() => void>();

function update(changes: Partial<DatasetJobs>) {
  state = { ...state, ...changes };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current uploads and deletions; re-renders when they change. */
export function useDatasetJobs() {
  return useSyncExternalStore(subscribe, () => state);
}

const UPLOAD_TOAST = "dataset-upload";

/** Upload a file and turn it into draft scenarios. Keeps going if the admin leaves the Datasets page. */
export async function startUpload(file: File, datasetType: string) {
  if (state.upload) return false;
  update({ upload: { fileName: file.name, datasetType }, result: null, error: "", rejectedReport: null });
  toast.loading(`Processing ${file.name}...`, {
    id: UPLOAD_TOAST,
    description: "You can keep using the app; this message updates when it is done.",
    duration: Infinity,
  });

  const formData = new FormData();
  formData.append("file", file);
  formData.append("dataset_type", datasetType);
  const response = await DatasetService.uploadDataset(formData);

  if (response.ok && response.data.success) {
    const data = response.data.data;
    update({
      upload: null,
      version: state.version + 1,
      result: {
        datasetType,
        recordCount: data.record_count,
        generatedScenarios: data.generated_scenarios,
        generatedByCategory: data.generated_by_category || [],
        qualityReport: data.quality_report,
      },
    });
    toast.success(`${file.name}: ${data.generated_scenarios.toLocaleString()} draft scenarios are ready for review.`, {
      id: UPLOAD_TOAST, description: undefined, duration: 6000,
    });
    return true;
  }
  const message = response.data.message || "Dataset processing could not be completed.";
  update({ upload: null, error: message, rejectedReport: response.data.data?.quality_report ?? null });
  toast.error(`${file.name}: ${message}`, { id: UPLOAD_TOAST, description: undefined, duration: 8000 });
  return false;
}

/** Delete a dataset with its scenarios, showing a "Deleting..." toast until the server is done. */
export async function deleteDataset(datasetId: number, name: string) {
  if (state.deleting.includes(datasetId)) return;
  const id = `dataset-delete-${datasetId}`;
  update({ deleting: [...state.deleting, datasetId] });
  toast.loading(`Deleting ${name}...`, {
    id, description: "Removing its scenarios and the attempts on them.", duration: Infinity,
  });
  const response = await DatasetService.deleteDataset(datasetId);
  const deleting = state.deleting.filter((item) => item !== datasetId);
  if (response.ok && response.data.success) {
    update({ deleting, version: state.version + 1 });
    toast.success(`${name} and its scenarios were deleted.`, { id, description: undefined, duration: 5000 });
  } else {
    update({ deleting });
    toast.error(response.data.message || `Unable to delete ${name}.`, { id, description: undefined, duration: 8000 });
  }
}
