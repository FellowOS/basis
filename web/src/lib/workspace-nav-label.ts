import type { LocaleMessages } from '@/i18n/en.js';
import type { SidebarMenuKey } from '@/lib/nav-config.js';

/** Resolve sidebar `labelKey` to module-scattered menu copy. */
export function workspaceNavMenuLabel(t: LocaleMessages, labelKey: SidebarMenuKey): string {
  switch (labelKey) {
    case 'graph':
      return t.graph.menu.graph;
    case 'search':
      return t.search.menu.search;
    case 'sources':
      return t.library.menu.sources;
    case 'processing':
      return t.processing.menu.processing;
    case 'entities':
      return t.entities.menu.entities;
    case 'dataOntologyWizard':
      return t.data_onboarding.menu.data_ontology_wizard;
    case 'connectorCatalog':
      return t.connectors.menu.connector_catalog;
    case 'connectorStreamMappings':
      return t.connectors.menu.connector_stream_mappings;
    case 'connectorActionPolicy':
      return t.connectors.menu.connector_action_policy;
    case 'connectorRunLogs':
      return t.connectors.menu.connector_run_logs;
    case 'ontology':
      return t.ontology.menu.ontology;
    case 'analyze':
      return t.analyze.menu.analyze;
    case 'vocabulary':
      return t.vocabulary.menu.vocabulary;
    case 'mappings':
      return t.mappings.menu.mappings;
    case 'review':
      return t.review.menu.review;
    case 'entityResolution':
      return t.entity_resolution.menu.entity_resolution;
    case 'decisions':
      return t.decisions.menu.decisions;
    case 'lineage':
      return t.lineage.menu.lineage;
    case 'graphDiff':
      return t.graph.menu.graph_diff;
    case 'integration':
      return t.integration.menu.integration;
    case 'settings':
      return t.settings.menu.settings;
    case 'alerts':
      return t.alerts.menu.alerts;
    default: {
      const _exhaustive: never = labelKey;
      return _exhaustive;
    }
  }
}
