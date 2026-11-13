export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? Array.isArray(body.message)
          ? body.message.join(", ")
          : String(body.message)
        : "Something went wrong. Please try again.";
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function downloadFile(path: string, filename: string, description: string): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, { credentials: "include" });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? String(body.message)
        : description;
    throw new ApiError(message, response.status);
  }
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadPdf(path: string, filename: string): Promise<void> {
  return downloadFile(path, filename, "Unable to download this document.");
}

export async function downloadCsv(path: string, filename: string): Promise<void> {
  return downloadFile(path, filename, "Unable to export this report.");
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  role: "ADMIN" | "MANAGER" | "EMPLOYEE";
  theme: "light" | "dark";
}

export interface DashboardSummary {
  periodDays: number;
  currency: string;
  kpis: {
    revenue: number;
    orders: number;
    customers: number;
    products: number;
    lowStock: number;
  };
  revenueSeries: Array<{ date: string; revenue: number }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customer: string;
    status: "DRAFT" | "CONFIRMED" | "PAID" | "CANCELLED";
    total: number;
    createdAt: string;
  }>;
}
