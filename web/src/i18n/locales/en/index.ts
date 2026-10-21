import { menu } from './menu.js';
import { common } from './common.js';
import { login } from './login.js';
import { marketing } from './marketing.js';
import { docs } from './docs.js';
import { nav } from './nav.js';
import { pages } from './pages.js';
import { sidebar } from './sidebar.js';
import { models } from './models.js';
import { entityResolution } from './entityResolution.js';
import { kbMappings } from './kbMappings.js';
import { kbSearch } from './kbSearch.js';
import { kbSources } from './kbSources.js';
import { kbLedger } from './kbLedger.js';
import { kbGraphDiff } from './kbGraphDiff.js';
import { kbVocabulary } from './kbVocabulary.js';
import { kbReasoning } from './kbReasoning.js';
import { kbGraphWorkspace } from './kbGraphWorkspace.js';
import { kbGraphAudit } from './kbGraphAudit.js';
import { platformAuditActions } from './platformAuditActions.js';
import { kbReview } from './kbReview.js';
import { kbShacl } from './kbShacl.js';
import { kbExplorer } from './kbExplorer.js';
import { kbAlignments } from './kbAlignments.js';
import { kbImportExport } from './kbImportExport.js';
import { kbGraphPage } from './kbGraphPage.js';
import { kbGraphProjection } from './kbGraphProjection.js';
import { kbSparql } from './kbSparql.js';
import { kbLineage } from './kbLineage.js';
import { kbSettings } from './kbSettings.js';
import { kbOrgSso } from './kbOrgSso.js';
import { kbOrgSaml } from './kbOrgSaml.js';
import { platformSettings } from './platformSettings.js';
import { kbOntology } from './kbOntology.js';
import { kbAnalyze } from './kbAnalyze.js';
import { kbProcessing } from './kbProcessing.js';
import { kbDecisions } from './kbDecisions.js';
import { kbConnectors } from './kbConnectors.js';
import { kbDataOnboarding } from './kbDataOnboarding.js';
import { apiErrorCodes } from './apiErrorCodes.js';
import { dev } from './dev.js';

export const en = {
  menu,
  models,
  common,
  sidebar,
  login,
  marketing,
  docs,
  nav,
  pages,
  entityResolution,
  kbMappings,
  kbSearch,
  kbSources,
  kbLedger,
  kbGraphDiff,
  kbVocabulary,
  kbReasoning,
  kbGraphWorkspace,
  kbGraphAudit,
  platformAuditActions,
  kbReview,
  kbShacl,
  kbExplorer,
  kbAlignments,
  kbImportExport,
  kbGraphPage,
  kbGraphProjection,
  kbSparql,
  kbLineage,
  kbSettings,
  kbOrgSso,
  kbOrgSaml,
  platformSettings,
  kbOntology,
  kbAnalyze,
  kbProcessing,
  kbDecisions,
  kbConnectors,
  kbDataOnboarding,
  apiErrorCodes,
  dev,
} as const;

export type LocaleMessages = typeof en;
