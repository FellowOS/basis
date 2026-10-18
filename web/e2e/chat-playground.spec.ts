import { expect, test } from '@playwright/test';

import {
  defaultKbId,
  ingestDocumentViaApi,
  registerFreshUser,
  skipUnlessKbGraphWrite,
} from './helpers';

const CHAT_LLM_STORAGE_KEY = 'basis.console.chatLlmRuntime';
const MOCK_LLM_BASE = 'http://127.0.0.1:8765';

function mockChatCompletionsSse(delta: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ choices: [{ delta }] })}\n\ndata: [DONE]\n\n`;
}

test('playground mock LLM tool loop propose_remember links to review', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  await skipUnlessKbGraphWrite(page, kbId);
  const fact = `E2E mock LLM remember ${Date.now()}`;

  await page.addInitScript(
    ({ key, baseUrl, model, apiKey }) => {
      localStorage.setItem(
        key,
        JSON.stringify({ model, base_url: baseUrl, api_key: apiKey }),
      );
    },
    {
      key: CHAT_LLM_STORAGE_KEY,
      baseUrl: MOCK_LLM_BASE,
      model: 'mock-model',
      apiKey: 'e2e-mock-key',
    },
  );

  let completionPass = 0;
  await page.route('**/v1/chat/completions', async (route) => {
    completionPass += 1;
    if (completionPass === 1) {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: mockChatCompletionsSse({
          tool_calls: [
            {
              index: 0,
              id: 'call_e2e_mock',
              function: {
                name: 'propose_remember',
                arguments: JSON.stringify({ content: fact }),
              },
            },
          ],
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: mockChatCompletionsSse({ content: 'Remember proposal submitted.' }),
    });
  });

  await page.goto(`/kbs/${kbId}/chat`);
  await expect(page.getByPlaceholder(/Ask a question|输入问题/i)).toBeVisible({ timeout: 60_000 });

  await page.getByPlaceholder(/Ask a question|输入问题/i).fill('Remember this for the KB.');
  await page.getByRole('button', { name: /^Send$|^发送$/ }).click();

  await expect(page.getByText('Remember proposal submitted.')).toBeVisible({ timeout: 60_000 });

  const reviewLink = page.getByTestId('chat-remember-review-link');
  await expect(reviewLink).toBeVisible({ timeout: 30_000 });
  await reviewLink.click();

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'review workspace requires explorer_runtime');
  }

  await expect(page).toHaveURL(/reviewItem=/);
  const reviewItemId = new URL(page.url()).searchParams.get('reviewItem');
  expect(reviewItemId).toBeTruthy();

  const card = page.locator(`#review-item-${reviewItemId}`);
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(card.getByText(fact)).toBeVisible();
});

test('playground search_chunks surfaces citation links', async ({ page }) => {
  test.setTimeout(180_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  const needle = `E2E citation smoke ${Date.now()}`;
  await ingestDocumentViaApi(page, kbId, needle);

  await page.addInitScript(
    ({ key, baseUrl, model, apiKey }) => {
      localStorage.setItem(
        key,
        JSON.stringify({ model, base_url: baseUrl, api_key: apiKey }),
      );
    },
    {
      key: CHAT_LLM_STORAGE_KEY,
      baseUrl: MOCK_LLM_BASE,
      model: 'mock-model',
      apiKey: 'e2e-mock-key',
    },
  );

  let completionPass = 0;
  await page.route('**/v1/chat/completions', async (route) => {
    completionPass += 1;
    if (completionPass === 1) {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: mockChatCompletionsSse({
          tool_calls: [
            {
              index: 0,
              id: 'call_e2e_search',
              function: {
                name: 'search_chunks',
                arguments: JSON.stringify({ query: needle.slice(0, 24) }),
              },
            },
          ],
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: mockChatCompletionsSse({ content: 'Found relevant chunks in the KB.' }),
    });
  });

  await page.goto(`/kbs/${kbId}/chat`);
  await expect(page.getByPlaceholder(/Ask a question|输入问题/i)).toBeVisible({ timeout: 60_000 });
  await page.getByPlaceholder(/Ask a question|输入问题/i).fill('Search the KB for the smoke document.');
  await page.getByRole('button', { name: /^Send$|^发送$/ }).click();

  await expect(page.getByText('Found relevant chunks in the KB.')).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId('chat-citation-link').first()).toBeVisible({ timeout: 30_000 });
});

test('playground blocks send until LLM is configured', async ({ page }) => {
  await registerFreshUser(page);
  const kbId = await defaultKbId(page);

  await page.addInitScript(() => {
    localStorage.removeItem('basis.console.chatLlmRuntime');
  });
  await page.goto(`/kbs/${kbId}/chat`);
  await expect(page.getByPlaceholder(/Ask a question|输入问题/i)).toBeVisible({ timeout: 60_000 });
  await page.getByPlaceholder(/Ask a question|输入问题/i).fill('Hello');
  await page.getByRole('button', { name: /^Send$|^发送$/ }).click();
  await expect(page.getByText(/Configure a chat model|配置对话模型/i)).toBeVisible();
});

test('playground manual remember links to review queue item', async ({ page }) => {
  test.setTimeout(120_000);

  await registerFreshUser(page);
  const kbId = await defaultKbId(page);
  await skipUnlessKbGraphWrite(page, kbId);
  const fact = `E2E playground remember ${Date.now()}`;

  await page.goto(`/kbs/${kbId}/chat`);
  await expect(page.getByPlaceholder(/Ask a question|输入问题/i)).toBeVisible({ timeout: 60_000 });

  const propose = page.getByRole('button', {
    name: /Propose for review|提交记入审核/i,
  });
  await expect(propose).toBeVisible();

  await page.getByPlaceholder(/Ask a question|输入问题/i).fill(fact);
  await propose.click();

  const reviewLink = page.getByTestId('chat-remember-review-link');
  await expect(reviewLink).toBeVisible({ timeout: 30_000 });

  await reviewLink.click();

  const unavailable = page.getByRole('heading', {
    name: /工作区不可用|Workspace unavailable/i,
  });
  if ((await unavailable.count()) > 0) {
    test.skip(true, 'review workspace requires explorer_runtime');
  }

  await expect(page).toHaveURL(/reviewItem=/);
  const reviewItemId = new URL(page.url()).searchParams.get('reviewItem');
  expect(reviewItemId).toBeTruthy();

  const card = page.locator(`#review-item-${reviewItemId}`);
  await expect(card).toBeVisible({ timeout: 60_000 });
  await expect(card.getByText(fact)).toBeVisible();
});
