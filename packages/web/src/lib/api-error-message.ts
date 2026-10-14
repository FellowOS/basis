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
};

export type ApiErrorLike = {
  message?: string;
  code?: string;
};

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
  if (err.message.trim()) {
    return err.message;
  }
  return fallback;
}
