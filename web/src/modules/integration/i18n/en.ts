export default {
  menu: {
    integration: "Integration"
  },
  tabs: {
    openapi: "OpenAPI",
    mcp: "MCP",
    tokens: "Access tokens",
    connectors: "Connectors"
  },
  connectors_playground: {
    hint:
      "Simulate an embedded client: per-subject (end_user) connections via the Integration API — same vault as MCP connector tools with connection_scope and subject_id.",
    subject_panel_title: "Simulated end user",
    subject_label: "subject_id",
    subject_hint: "Stable ID for this test user; changing it loads a different connection set.",
    subject_apply: "Apply subject",
    list_title: "Connectors",
    list_subtitle: "All providers for this simulated subject — connect, test, or remove.",
    search_placeholder: "Search connectors…",
    status_connected: "Connected",
    status_not_connected: "Not connected",
    manage: "Manage",
    connect: "Connect",
    reconnect: "Manage",
    connected_badge: "Connected",
    save: "Save connection",
    check: "Check",
    delete: "Remove",
    save_success: "Connection saved.",
    check_success: "Check succeeded.",
    delete_success: "Connection removed.",
    oauth_workspace_hint:
      "OAuth app credentials are configured in Connectors (workspace oauth-configs). This flow stores tokens for the simulated subject.",
    oauth_same_window_hint:
      "Continue in this browser tab (do not copy the link). Complete GitHub sign-in without regenerating the URL.",
    mcp_title: "MCP example",
    mcp_hint: "Call list_connector_connections on the workspace MCP endpoint with your access token:"
  },
  tokens: {
    hint: "Shared by MCP and OpenAPI — use Authorization: Bearer <token> on integration requests.",
    scope_read: "Read-only (GET-style workspace APIs and read MCP tools)",
    scope_write: "Read + write (mutations, MCP tools that change data)",
    restrict_operations: "Limit MCP tools / HTTP grants",
    restrict_operations_hint:
      "When enabled, only selected tool names are allowed (plus matching REST routes). Omit to allow all tools in this workspace.",
    operations_label: "Allowed operations",
    operations_select_all: "Select all",
    operations_clear: "Clear",
    unrestricted_badge: "All operations",
    restricted_badge: "{count} operations",
  },
  openapi: {
    hint: "REST integration for this workspace — same operations as MCP tools.",
    download_json: "Download workspace OpenAPI JSON",
    open_swagger: "Open full Swagger UI",
    api_base_label: "API base path for this workspace:",
    workspace_id_try_it_out:
      "In Try it out, set workspace_id to this workspace id. Bearer token uses your console session.",
    export_ui_hint: "Guided graph download (JSON/CSV):",
    export_ui_link: "Settings → Graph → Export graph",
    alerts_api_hint:
      "Workspace alerts REST: list (GET /alerts), SSE stream (/alerts/stream), mark-all-read and dismiss-all — search “alerts” in the spec below."
  },
  mcp: {
    title: "MCP",
    connection_title: "Connect an agent",
    hint: "Expose this workspace over HTTP MCP to clients such as Cursor.",
    step_create_token: "Create an access token in the Access tokens tab",
    step_copy_url: "Copy the MCP URL into your client",
    step_paste_config: "Paste the JSON below into mcp.json and set Bearer to your token",
    url: "MCP endpoint URL",
    api_base_note: "Point the client at the Basis API (e.g. http://127.0.0.1:8090), not the Vite dev port.",
    tools: "Available tools",
    copy: "Copy URL",
    copy_config: "Copy config",
    cursor_config: "Cursor / mcp.json example",
    bearer_hint: "Header: Authorization: Bearer <access token>",
    name_placeholder: "e.g. cursor-agent",
    empty_tokens: "No access tokens yet",
    empty_tokens_hint: "Create one, then copy the secret anytime from the list",
    tokens_title: "Access tokens",
    name_label: "Name",
    create_button: "Create",
    secret_once: "New token secret — save it; you can also copy from the list below.",
    secret_dismiss: "Dismiss",
    scope_label: "Scope",
    scope_labels: {
      read: "Read",
      write: "Write",
      admin: "Admin"
    },
    token_meta: "{scope} · {lastUsed}",
    last_used: "Last used",
    last_used_never: "Never used",
    revoke: "Revoke",
    revoked: "Revoked",
    delete: "Delete",
    delete_title: "Delete access token",
    delete_confirm: "This cannot be undone. The key will stop working immediately.",
    admin_only: "Only workspace admins can create or delete tokens.",
    copy_token: "Copy token",
    copy_token_unavailable: "No secret available (revoked, or legacy token — create a new one)",
    copy_failed: "Could not copy — select the secret and copy manually",
    actions: "Actions"
  }
} as const;
