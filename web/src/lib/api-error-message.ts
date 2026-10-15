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
  upload_too_large: {
    zh: '上传文件或文本超过大小限制。',
    en: 'Upload exceeds the size limit.',
  },
  extract_text_too_large: {
    zh: '文档提取文本超过长度限制，请缩短内容或拆分版本。',
    en: 'Extracted text exceeds the length limit. Shorten the document or split into versions.',
  },
  too_many_chunks: {
    zh: '切分块数超过限制，请增大块大小或减少内容。',
    en: 'Too many chunks after splitting. Increase chunk size or reduce content.',
  },
  extract_timeout: {
    zh: '知识抽取超时，请稍后重试或改用更快的抽取方式。',
    en: 'Knowledge extraction timed out. Retry later or use a faster extraction method.',
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
  ingest_overloaded: {
    zh: '处理队列已满，请稍后重试。',
    en: 'The processing queue is full. Try again in a moment.',
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
  explorer_unavailable: {
    zh: 'Explorer 图会话不可用，请确认依赖已安装并重启服务。',
    en: 'Explorer graph session is unavailable. Check dependencies and restart the server.',
  },
  explorer_graph_error: {
    zh: 'Explorer 图接口返回错误。',
    en: 'The Explorer graph API returned an error.',
  },
  bad_path: {
    zh: '路径查询须同时提供 source 与 target。',
    en: 'Path lookup requires both source and target node IDs.',
  },
  bad_signature: {
    zh: '映射签名不能为空。',
    en: 'Mapping signature cannot be empty.',
  },
  bad_target_kind: {
    zh: '映射目标类型无效。',
    en: 'Invalid mapping target kind.',
  },
  bad_direction: {
    zh: '映射方向无效。',
    en: 'Invalid mapping direction.',
  },
  unsupported_review_kind: {
    zh: '不支持的审核类型。',
    en: 'Unsupported review item type.',
  },
  document_not_found: {
    zh: '文档不存在。',
    en: 'Document not found.',
  },
  chunk_not_found: {
    zh: '片段不存在。',
    en: 'Chunk not found.',
  },
  search_mode_disabled: {
    zh: '该知识库未启用此搜索模式。',
    en: 'This search mode is disabled for the knowledge base.',
  },
  bad_status: {
    zh: '状态无效。',
    en: 'Invalid status.',
  },
  same_entity: {
    zh: '不能合并同一实体。',
    en: 'Cannot merge an entity with itself.',
  },
  quote_not_in_chunk: {
    zh: '引用与分块文本不匹配。',
    en: 'The quote does not match the chunk text.',
  },
  bad_repo: {
    zh: 'Git 来源须配置有效的仓库 URL。',
    en: 'Git sources require a valid repository URL.',
  },
  bad_quote: {
    zh: '引用偏移无效。',
    en: 'Invalid quote offset.',
  },
  validation_error: {
    zh: '请求参数无效。',
    en: 'Invalid request parameters.',
  },
  bad_sparql: {
    zh: 'SPARQL 查询无效。',
    en: 'Invalid SPARQL query.',
  },
  invalid_credentials: {
    zh: '邮箱或密码不正确。',
    en: 'Incorrect email or password.',
  },
  registration_closed: {
    zh: '注册已关闭。',
    en: 'Registration is closed.',
  },
  email_taken: {
    zh: '该邮箱已被注册。',
    en: 'This email is already registered.',
  },
  password_too_short: {
    zh: '密码至少 8 位。',
    en: 'Password must be at least 8 characters.',
  },
  bad_email: {
    zh: '邮箱格式不正确。',
    en: 'Invalid email address.',
  },
  bad_name: {
    zh: '名称长度须在 1 到 64 个字符之间。',
    en: 'Name must be between 1 and 64 characters.',
  },
  bad_role: {
    zh: '角色无效，须为 owner、admin、editor 或 viewer。',
    en: 'Invalid role. Use owner, admin, editor, or viewer.',
  },
  bad_visibility: {
    zh: '可见性须为 open 或 restricted。',
    en: 'Visibility must be open or restricted.',
  },
  last_admin: {
    zh: '不能移除或停用最后一个管理员。',
    en: 'Cannot remove or deactivate the last admin.',
  },
  last_owner: {
    zh: '不能移除或降级最后一个所有者。',
    en: 'Cannot remove or demote the last owner.',
  },
  cannot_deactivate_self: {
    zh: '不能停用自己的账号。',
    en: 'You cannot deactivate your own account.',
  },
  bad_scope: {
    zh: '令牌 scope 须为 read 或 write。',
    en: 'Token scope must be read or write.',
  },
  bad_kb_ids: {
    zh: '请至少选择一个知识库。',
    en: 'Select at least one knowledge base.',
  },
  model_required: {
    zh: '请填写模型 ID。',
    en: 'Model ID is required.',
  },
  api_base_required: {
    zh: '请填写 API Base URL。',
    en: 'API base URL is required.',
  },
  model_not_found: {
    zh: '模型不存在。',
    en: 'Model not found.',
  },
  embedding_model_not_found: {
    zh: '指定的嵌入模型不存在。',
    en: 'The specified embedding model was not found.',
  },
  forbidden_origin: {
    zh: '来源不被允许。',
    en: 'Origin is not allowed.',
  },
  invalid_ticket: {
    zh: '实时连接票据无效。',
    en: 'Realtime ticket is invalid.',
  },
  ticket_used: {
    zh: '实时连接票据已使用。',
    en: 'Realtime ticket was already used.',
  },
  ticket_expired: {
    zh: '实时连接票据已过期。',
    en: 'Realtime ticket has expired.',
  },
  wrong_kb: {
    zh: '票据与知识库不匹配。',
    en: 'Ticket does not match this knowledge base.',
  },
  vector_backend_unavailable: {
    zh: '向量存储后端不可用。',
    en: 'Vector storage backend is unavailable.',
  },
  openai_missing: {
    zh: '未安装 OpenAI 依赖。',
    en: 'OpenAI dependency is not installed.',
  },
  tool_loop_limit: {
    zh: '工具调用次数过多，请简化问题后重试。',
    en: 'Too many tool calls. Simplify the question and try again.',
  },
  bad_entity: {
    zh: '实体名称无效。',
    en: 'Invalid entity name.',
  },
  bad_entity_kind: {
    zh: '实体类型无效。',
    en: 'Invalid entity kind.',
  },
  bad_statement: {
    zh: '陈述须指定对象实体或对象值之一。',
    en: 'A statement must have an object entity or object value.',
  },
  bad_kind: {
    zh: '不支持的类型。',
    en: 'Unsupported kind.',
  },
  bad_doc_id: {
    zh: '文档 ID 无效。',
    en: 'Invalid document ID.',
  },
};

export type ApiErrorLike = {
  message?: string;
  code?: string;
  requestId?: string;
};

function withRequestIdSuffix(
  text: string,
  requestId: string | undefined,
  locale: 'zh' | 'en',
): string {
  const id = requestId?.trim();
  if (!id) {
    return text;
  }
  return locale === 'zh'
    ? `${text}（参考 ID：${id}）`
    : `${text} (Reference ID: ${id})`;
}

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
  const meta = err as Error & ApiErrorLike;
  const code = meta.code;
  const requestId = meta.requestId;
  if (code && MESSAGES[code]) {
    return withRequestIdSuffix(MESSAGES[code][locale], requestId, locale);
  }
  if (code?.trim()) {
    const mapped = messageForApiErrorCode(code, locale) ?? fallback;
    return withRequestIdSuffix(mapped, requestId, locale);
  }
  if (err.message.trim()) {
    return withRequestIdSuffix(err.message, requestId, locale);
  }
  return withRequestIdSuffix(fallback, requestId, locale);
}
