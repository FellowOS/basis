const MESSAGES: Record<string, { zh: string; en: string }> = {
  processing_active: {
    zh: '该版本已在处理中，请稍后再试或查看任务列表。',
    en: 'This version is already being processed. Check the job list or try again later.',
  },
  idempotency_replay_failed: {
    zh: '相同请求对应的处理已失败，请重试任务或重新发起处理。',
    en: 'The prior request for this idempotency key failed. Retry the job or start a new run.',
  },
  idempotency_replay_cancelled: {
    zh: '相同请求对应的处理已取消。',
    en: 'The prior request for this idempotency key was cancelled.',
  },
  idempotency_key_mismatch: {
    zh: '幂等键已用于其他文档版本。',
    en: 'This idempotency key is tied to a different document version.',
  },
  job_not_retryable: {
    zh: '仅失败或已取消的任务可以重试。',
    en: 'Only failed or cancelled jobs can be retried.',
  },
  parse_failed: {
    zh: '文件解析失败，请检查格式或换一份文件。',
    en: 'Could not parse the file. Check the format or try another file.',
  },
  bad_chunk_options: {
    zh: '分块参数无效：重叠必须小于块大小。',
    en: 'Invalid chunk options: overlap must be smaller than chunk size.',
  },
  job_timeout: {
    zh: '处理任务等待超时。',
    en: 'Timed out waiting for the processing job.',
  },
  not_found: {
    zh: '资源不存在或无权访问。',
    en: 'Resource not found or not accessible.',
  },
  unauthorized: {
    zh: '需要登录。',
    en: 'Sign in required.',
  },
  forbidden: {
    zh: '没有权限执行此操作。',
    en: 'You do not have permission for this action.',
  },
  review_closed: {
    zh: '该审核项已处理，无法再次操作。',
    en: 'This review item is already closed.',
  },
  merge_reverted: {
    zh: '该合并已回滚。',
    en: 'This merge was already reverted.',
  },
  conflict: {
    zh: '操作冲突，请刷新后重试。',
    en: 'Conflict — refresh and try again.',
  },
  payload_too_large: {
    zh: '内容过大，请缩小后重试。',
    en: 'Payload too large. Try a smaller file or URL.',
  },
  fetch_failed: {
    zh: '拉取远程内容失败。',
    en: 'Failed to fetch remote content.',
  },
  unsupported_repo: {
    zh: '仅支持 GitHub HTTPS 仓库地址。',
    en: 'Only GitHub HTTPS repository URLs are supported.',
  },
  bad_paths: {
    zh: '请至少配置一个仓库内文件路径。',
    en: 'Configure at least one file path in the repository.',
  },
  bad_url: {
    zh: '请配置有效的拉取 URL。',
    en: 'Configure a valid pull URL.',
  },
  not_syncable: {
    zh: '该来源类型不支持手动同步。',
    en: 'Manual sync is not supported for this source type.',
  },
  empty_body: {
    zh: '远程 URL 返回空内容。',
    en: 'The remote URL returned empty content.',
  },
  bad_import_format: {
    zh: '仅支持 JSON 或 CSV 图导入文件。',
    en: 'Graph import accepts JSON or CSV files only.',
  },
  import_too_large: {
    zh: '导入文件超过大小限制。',
    en: 'Import file exceeds the size limit.',
  },
  bad_review_payload: {
    zh: '审核项数据无效，无法继续。',
    en: 'Invalid review item payload.',
  },
  build_failed: {
    zh: '图谱投影构建失败，请在设置中重建或查看审计日志。',
    en: 'Graph projection build failed. Rebuild from settings or check the audit log.',
  },
  ingest_incomplete: {
    zh: '资料处理未完成，图谱投影可能已过期，请重试处理或重建投影。',
    en: 'Ingest did not finish; the graph projection may be stale. Retry processing or rebuild the projection.',
  },
  ingest_failed: {
    zh: '资料处理失败，请查看任务详情后重试。',
    en: 'Document processing failed. Check the job details and try again.',
  },
  merge_requires_review: {
    zh: '图节点合并需经审核队列批准后再应用。',
    en: 'Graph node merges must go through the review queue before they are applied.',
  },
  import_requires_review: {
    zh: '图导入需经审核队列批准后再应用。',
    en: 'Graph import must go through the review queue before it is applied.',
  },
  mcp_busy: {
    zh: 'MCP 请求过多，请稍后重试。',
    en: 'Too many MCP requests. Try again in a moment.',
  },
  mcp_timeout: {
    zh: 'MCP 工具执行超时。',
    en: 'MCP tool execution timed out.',
  },
  no_current_version: {
    zh: '该文档没有可用版本。',
    en: 'This document has no current version.',
  },
  mapping_invalidated: {
    zh: '该映射已失效。',
    en: 'This mapping is no longer valid.',
  },
  mapping_exists: {
    zh: '已存在相同签名的已确认映射。',
    en: 'A confirmed mapping with this signature already exists.',
  },
  bad_algorithm: {
    zh: '路径算法无效，请使用 bfs 或 dijkstra。',
    en: 'Invalid path algorithm. Use bfs or dijkstra.',
  },
  semantic_unavailable: {
    zh: '当前图谱不支持语义相似度。',
    en: 'Semantic similarity is unavailable for this graph.',
  },
  semantic_node_not_found: {
    zh: '语义距离接口未找到所选节点。',
    en: 'Selected node was not found by the semantic distance API.',
  },
};

export type ApiErrorLike = {
  message?: string;
  code?: string;
};

export function messageForApiErrorCode(
  code: string | null | undefined,
  locale: 'zh' | 'en',
): string | null {
  if (!code?.trim()) {
    return null;
  }
  const mapped = MESSAGES[code.trim()];
  if (mapped) {
    return mapped[locale];
  }
  return locale === 'zh'
    ? `错误（${code}）`
    : `Error (${code})`;
}

export function formatUserFacingApiError(
  err: unknown,
  locale: 'zh' | 'en',
): string {
  const fallback =
    locale === 'zh' ? '操作失败，请稍后重试。' : 'Something went wrong. Try again.';
  if (!(err instanceof Error)) {
    return fallback;
  }
  const code = (err as Error & ApiErrorLike).code;
  if (code && MESSAGES[code]) {
    return MESSAGES[code][locale];
  }
  if (code?.trim()) {
    return messageForApiErrorCode(code, locale) ?? fallback;
  }
  if (err.message.trim()) {
    return err.message;
  }
  return fallback;
}
