export type KbGraphAuditEvent = {
  id: number;
  action: string;
  actor_id: string | null;
  created_at: string;
  detail?: Record<string, unknown>;
};

export function formatGraphAuditAction(action: string, zh: boolean): string {
  const labels: Record<string, [string, string]> = {
    'kb.graph.merge_proposed': ['提交合并审核', 'Merge proposed'],
    'kb.graph.merge_approved': ['批准合并', 'Merge approved'],
    'kb.graph.merge_rejected': ['驳回合并', 'Merge rejected'],
    'kb.graph.import': ['批准图导入', 'Graph import approved'],
    'kb.graph.import_proposed': ['提交图导入审核', 'Graph import proposed'],
    'kb.graph.import_rejected': ['驳回图导入', 'Graph import rejected'],
    'kb.graph.export': ['导出图数据', 'Graph export'],
    'kb.graph.reasoning_apply': ['推理写入图', 'Reasoning applied to graph'],
    'kb.graph.vocabulary_import': ['导入 SKOS 词表', 'SKOS vocabulary import'],
    'kb.graph.ontology_create': ['创建本体', 'Ontology created'],
    'kb.graph.ontology_load': ['加载本体', 'Ontology loaded'],
    'kb.graph.ontology_remove': ['移除本体', 'Ontology removed'],
    'kb.graph.ontology_publish': ['发布本体变更', 'Ontology proposal published'],
    'kb.graph.projection_rebuild': ['重建图谱投影', 'Graph projection rebuilt'],
    'kb.mapping.created': ['创建映射', 'Mapping created'],
    'kb.mapping.status': ['更新映射状态', 'Mapping status updated'],
    'kb.ledger.entity_merge_revert': ['回滚账本合并', 'Ledger merge reverted'],
  };
  const pair = labels[action];
  if (pair) return zh ? pair[0] : pair[1];
  return action;
}

export function formatGraphAuditDetail(event: KbGraphAuditEvent, zh: boolean): string {
  const d = event.detail ?? {};
  if (event.action === 'kb.graph.projection_rebuild') {
    const parts: string[] = [];
    if (d.projection_revision != null) {
      parts.push(zh ? `修订 ${d.projection_revision}` : `rev ${d.projection_revision}`);
    }
    if (d.node_count != null && d.edge_count != null) {
      parts.push(`${d.node_count}/${d.edge_count} ${zh ? '节点/边' : 'nodes/edges'}`);
    }
    return parts.join(' · ') || '—';
  }
  if (event.action === 'kb.graph.export' && d.format) {
    return String(d.format);
  }
  if (
    (event.action === 'kb.graph.import' || event.action === 'kb.graph.import_proposed') &&
    (d.filename != null || d.nodes_imported != null)
  ) {
    return [
      d.filename,
      d.nodes_imported != null ? `${d.nodes_imported} ${zh ? '节点' : 'nodes'}` : null,
      d.edges_imported != null ? `${d.edges_imported} ${zh ? '边' : 'edges'}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  if (typeof d.review_item_id === 'string') {
    return d.review_item_id;
  }
  return '—';
}
