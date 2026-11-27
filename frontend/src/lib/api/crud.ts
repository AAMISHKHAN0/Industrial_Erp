import { api } from "./client";

export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  status?: string;
  isActive?: boolean;
}

function buildQuery(params: QueryParams): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") q.set(k, String(v)); });
  const str = q.toString();
  return str ? "?" + str : "";
}

export function createCrudService<T extends { id: string }>(basePath: string) {
  return {
    findAll: (params: QueryParams = {}) =>
      api.getWithMeta<T[]>(basePath + buildQuery(params)),

    findOne: (id: string) =>
      api.get<T>(basePath + "/" + id),

    create: (data: Partial<T>) =>
      api.post<T>(basePath, data),

    update: (id: string, data: Partial<T>) =>
      api.patch<T>(basePath + "/" + id, data),

    remove: (id: string) =>
      api.delete<T>(basePath + "/" + id),

    restore: (id: string) =>
      api.post<T>(basePath + "/" + id + "/restore", {}),
  };
}