import { describe, expect, it, vi } from "vitest";
import { createBasisClient, createBasisSessionClient } from './transport.js';

describe("createBasisSessionClient", () => {
  it("sessionFetch attaches bearer and base URL", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createBasisSessionClient({
      baseUrl: "http://localhost",
      getAccessToken: () => "tok",
    });
    await client.sessionFetch("/api/v1/kbs/k1/alerts/stream", {
      headers: { Accept: "text/event-stream" },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost/api/v1/kbs/k1/alerts/stream");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer tok");
    expect(new Headers(init?.headers).get("Accept")).toBe("text/event-stream");
  });

  it("apiUrl joins paths", () => {
    const client = createBasisSessionClient({
      baseUrl: "",
      getAccessToken: () => null,
    });
    expect(client.apiUrl("/api/v1/health")).toBe("/api/v1/health");
  });
});

describe("createBasisClient", () => {
  it("calls v1 MCP discovery with bearer token", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      Response.json({ mcp_url: "http://localhost/api/v1/kbs/k1/mcp" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = createBasisClient({ baseUrl: "http://localhost", accessToken: "secret" });
    await client.kb("k1").mcpInfo();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost/api/v1/kbs/k1/mcp");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer secret");
  });

  it("calls v1 find entities", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(
      Response.json({ query: "Paris", ledger_entities: [], graph_nodes: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = createBasisClient({ baseUrl: "", accessToken: "t" });
    await client.kb("kb-1").findEntities("Paris", 5);

    expect(fetchMock.mock.calls[0]![0]).toBe("/api/v1/kbs/kb-1/entities/find?q=Paris&limit=5");
  });

  it("posts v1 graph search", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockResolvedValue(Response.json({ results: [], engine: "snapshot" }));
    vi.stubGlobal("fetch", fetchMock);

    const client = createBasisClient({ baseUrl: "http://localhost", accessToken: "t" });
    await client.kb("k1").searchGraph("node", 10);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost/api/v1/kbs/k1/graph/search");
    expect(init?.method).toBe("POST");
  });
});
