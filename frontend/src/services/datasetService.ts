// API calls for datasets (admin only)

import { apiRequest } from "./api";

/** API calls for datasets. */
class DatasetService {
  /** Every uploaded dataset. */
  async getDatasets() {
    const token = localStorage.getItem("access_token");

    return await apiRequest(
      "/datasets",
      "GET",
      null,
      token
    );
  }

  /** Upload a CSV or JSON dataset. */
  async uploadDataset(formData: FormData) {
    const token = localStorage.getItem("access_token");

    return await apiRequest(
      "/datasets/upload",
      "POST",
      formData,
      token
    );
  }

  /** Delete a dataset. */
  async deleteDataset(datasetId: number) {
    const token = localStorage.getItem("access_token");

    return await apiRequest(
      `/datasets/${datasetId}`,
      "DELETE",
      null,
      token
    );
  }

  /** Re-apply the realism rules to a dataset's drafts. */
  async reprocessDataset(datasetId: number) {
    const token = localStorage.getItem("access_token");

    return await apiRequest(
      `/datasets/${datasetId}/reprocess`,
      "POST",
      null,
      token
    );
  }

  /** One dataset's details. */
  async getDataset(datasetId: number) {
    const token = localStorage.getItem("access_token");

    return await apiRequest(
      `/datasets/${datasetId}`,
      "GET",
      null,
      token
    );
  }

}

export default new DatasetService();