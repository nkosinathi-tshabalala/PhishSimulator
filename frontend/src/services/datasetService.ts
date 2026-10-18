// API calls for datasets (admin only)

import { apiRequest } from "./api";

/** API calls for datasets. */
class DatasetService {
  /** Every uploaded dataset. */
  async getDatasets() {
    return await apiRequest(
      "/datasets",
      "GET",
      null
    );
  }

  /** Upload a CSV or JSON dataset. */
  async uploadDataset(formData: FormData) {
    return await apiRequest(
      "/datasets/upload",
      "POST",
      formData
    );
  }

  /** Delete a dataset. */
  async deleteDataset(datasetId: number) {
    return await apiRequest(
      `/datasets/${datasetId}`,
      "DELETE",
      null
    );
  }

  /** Re-apply the realism rules to a dataset's drafts. */
  async reprocessDataset(datasetId: number) {
    return await apiRequest(
      `/datasets/${datasetId}/reprocess`,
      "POST",
      null
    );
  }
}

export default new DatasetService();