const API_BASE = `http://localhost:${process.env.PORT || 3000}/api`;

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Response(body, { status: res.status });
  }

  return res.json() as Promise<T>;
}
