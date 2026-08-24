import { apiRequest } from "./api";

class DatasetService {

  async getDatasets() {

    const token = localStorage.getItem("access_token");

    return await apiRequest(
      "/datasets",
      "GET",
      null,
      token
    );
  }

  async uploadDataset(formData: FormData) {

    const token = localStorage.getItem("access_token");

    return await apiRequest(
      "/datasets/upload",
      "POST",
      formData,
      token
    );
  }

  async deleteDataset(datasetId: number) {

    const token = localStorage.getItem("access_token");

    return await apiRequest(
      `/datasets/${datasetId}`,
      "DELETE",
      null,
      token
    );
  }

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