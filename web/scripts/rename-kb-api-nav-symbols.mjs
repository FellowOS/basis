#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dirs = [path.join(root, 'src'), path.join(root, 'e2e')];

const pairs = [
  ['kbOpenApiDELETE', 'workspaceOpenApiDELETE'],
  ['kbOpenApiPATCH', 'workspaceOpenApiPATCH'],
  ['kbOpenApiPOST', 'workspaceOpenApiPOST'],
  ['kbOpenApiPUT', 'workspaceOpenApiPUT'],
  ['kbOpenApiGET', 'workspaceOpenApiGET'],
  ['kbOpenApiPath', 'workspaceOpenApiPath'],
  ['kbOpenApiInit', 'workspaceOpenApiInit'],
  ['kbConnectorPanelPath', 'workspaceConnectorPanelPath'],
  ['kbOntologyProposalPath', 'workspaceOntologyProposalPath'],
  ['kbOntologyVersionsPath', 'workspaceOntologyVersionsPath'],
  ['kbGraphDiffPath', 'workspaceGraphDiffPath'],
  ['kbOntologyHubPath', 'workspaceOntologyHubPath'],
  ['kbAnalyzeHubPath', 'workspaceAnalyzeHubPath'],
  ['KB_ONTOLOGY_HUB_LEGACY_SEGMENTS', 'ONTOLOGY_HUB_LEGACY_SEGMENTS'],
  ['KB_ANALYZE_HUB_LEGACY_SEGMENTS', 'ANALYZE_HUB_LEGACY_SEGMENTS'],
  ['parseKbIdFromPath', 'parseWorkspaceIdFromPath'],
  ['isKbScopedPath', 'isWorkspaceScopedPath'],
  ['isKbScopedApiPath', 'isWorkspaceScopedApiPath'],
  ['kbApiRoot', 'workspaceApiRoot'],
  ['kbApiPath', 'workspaceApiPath'],
  ['KB_API_V1_PREFIX', 'WORKSPACES_API_V1_PREFIX'],
  ['platformKbsCollectionPath', 'platformWorkspacesCollectionPath'],
  ['readActiveKbId', 'readActiveWorkspaceId'],
  ['writeActiveKbId', 'writeActiveWorkspaceId'],
  ['pickDefaultKbId', 'pickDefaultWorkspaceId'],
  ['resolveSidebarKbId', 'resolveSidebarWorkspaceId'],
  ['isSetupKbId', 'isSetupWorkspaceId'],
  ['KB_SETUP_ID', 'WORKSPACE_SETUP_ID'],
  ['KbWorkspaceZone', 'WorkspaceZone'],
  ['KB_WORKSPACE_ZONES', 'WORKSPACE_ZONES'],
  ['KB_NAV_BY_ZONE', 'WORKSPACE_NAV_BY_ZONE'],
  ['KbSidebarNavKey', 'SidebarNavKey'],
  ['KbSidebarMenuKey', 'SidebarMenuKey'],
  ['KbHubCapabilityNavKey', 'HubCapabilityNavKey'],
  ['KbNavKey', 'WorkspaceNavKey'],
  ['KbSidebarNavItem', 'SidebarNavItem'],
  ['KbNavItem', 'WorkspaceNavItem'],
  ['KB_ALERTS_NAV_ITEM', 'ALERTS_NAV_ITEM'],
  ['KB_SETTINGS_NAV_ITEM', 'SETTINGS_NAV_ITEM'],
  ['buildKbNav', 'buildWorkspaceNav'],
  ['KB_NAV', 'WORKSPACE_NAV'],
  ['kbPath', 'workspacePath'],
  ['KbGraphUrlParams', 'GraphUrlParams'],
  ['kbGraphDiffPreviewPath', 'graphDiffPreviewPath'],
  ['kbGraphImportDialogPath', 'graphImportDialogPath'],
  ['kbGraphExportDialogPath', 'graphExportDialogPath'],
  ['kbGraphPath', 'graphPath'],
  ['parseKbGraphUrlState', 'parseGraphUrlState'],
  ['mergeKbGraphAtParam', 'mergeGraphAtParam'],
  ['KbSearchCopy', 'SearchPageCopy'],
  ['KbSearchScope', 'SearchScope'],
  ['KbMappingsCopy', 'MappingsPageCopy'],
  ['KbRow', 'WorkspaceRecord'],
  ['KbStoredConnection', 'StoredConnection'],
  ['KbGraphAuditEvent', 'GraphAuditEvent'],
  ['KbConnectorMapping', 'ConnectorMapping'],
  ['defaultKbId', 'defaultWorkspaceId'],
  ['e2eKbPath', 'e2eWorkspaceApiPath'],
  ['E2E_KBS_COLLECTION', 'E2E_WORKSPACES_COLLECTION'],
  ['KbSearchUrlParams', 'SearchUrlParams'],
  ['KbSearchTab', 'SearchTab'],
  ['parseKbSearchTab', 'parseSearchTab'],
  ['parseKbSearchUrlState', 'parseSearchUrlState'],
  ['kbSearchPath', 'searchPath'],
  ['kbApiClient', 'workspaceApiClient'],
  ['consumeKbAlertsStream', 'consumeWorkspaceAlertsStream'],
  ['KbAlertStreamItem', 'WorkspaceAlertStreamItem'],
  ['KbAlertActionLabelKey', 'AlertActionLabelKey'],
  ['KbAlertAction', 'AlertAction'],
  ['kbAlertActionLabel', 'alertActionLabel'],
  ['kbAlertAction', 'workspaceAlertAction'],
  ['kbAlertKindLabel', 'alertKindLabel'],
  ['kbAlertSeverityLabel', 'alertSeverityLabel'],
  ['kbAlertDetailLines', 'alertDetailLines'],
  ['kbAlertsPath', 'workspaceAlertsPath'],
  ['kbSourcesDocumentPath', 'sourcesDocumentPath'],
  ['kbSourcesProcessPath', 'sourcesProcessPath'],
  ['kbReviewItemPath', 'reviewItemPath'],
  ['kbReviewDecisionPath', 'reviewDecisionPath'],
  ['kbProcessingPath', 'processingPath'],
  ['kbProcessingJobPath', 'processingJobPath'],
  ['kbEntitiesStatementPath', 'entitiesStatementPath'],
  ['kbConnectionOptionKey', 'workspaceConnectionOptionKey'],
  ['parseKbConnectionOptionKey', 'parseWorkspaceConnectionOptionKey'],
  ['kbConnectorMappingEditPath', 'workspaceConnectorMappingEditPath'],
  ['kbConnectorMappingNewPath', 'workspaceConnectorMappingNewPath'],
  ['kbConnectorsMappingsTabPath', 'workspaceConnectorsMappingsTabPath'],
  ['kbConnectorOAuthCallbackPath', 'workspaceConnectorOAuthCallbackPath'],
  ['kbConnectorOAuthRedirectUri', 'workspaceConnectorOAuthRedirectUri'],
  ['explorerPathForKb', 'explorerPathForWorkspace'],
  ['fetchKbNodeLabels', 'fetchWorkspaceNodeLabels'],
  ['fetchKbGraphNode', 'fetchWorkspaceGraphNode'],
  ['kbIdFromPlatformAuditEvent', 'workspaceIdFromPlatformAuditEvent'],
  ['kbIdFromAuditDetail', 'workspaceIdFromAuditDetail'],
  ['KbGraphAuditPackStaging', 'GraphAuditPackStaging'],
  ['KbGraphAuditPack', 'GraphAuditPack'],
  ['KbSettingsCopy', 'SettingsPanelCopy'],
  ['kbMemberRoleLabel', 'workspaceMemberRoleLabel'],
  ['kbVisibilityLabel', 'workspaceVisibilityLabel'],
  ['KbMcpCopy', 'McpIntegrationCopy'],
  ['kbMcpTokenScopeLabel', 'mcpTokenScopeLabel'],
  ['KbReasoningRule', 'ReasoningRule'],
  ['resolveKbId', 'resolveWorkspaceId'],
];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'dist') continue;
      walk(p, files);
    } else if (/\.(tsx?|mjs|md)$/.test(ent.name)) {
      files.push(p);
    }
  }
  return files;
}

const files = dirs.flatMap((d) => (fs.existsSync(d) ? walk(d) : []));
let n = 0;
for (const file of files) {
  let s = fs.readFileSync(file, 'utf8');
  let next = s;
  for (const [from, to] of pairs) next = next.split(from).join(to);
  if (next !== s) {
    fs.writeFileSync(file, next);
    n++;
  }
}
console.log(`updated ${n} files`);
