# Shared Textarea Autosize Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every shared textarea grow with its content while preserving each form's current starting height, and update the DM composer to start at two lines and reset cleanly after a successful send.

**Architecture:** Add autosize behavior to the shared `Textarea` component so existing consumers inherit the behavior without duplicating page-level measurement code. Keep the DM conversation page focused on composition behavior by only changing its baseline sizing and send/reset assertions, while dedicated tests cover shared autosize mechanics and DM-specific success/failure behavior.

**Tech Stack:** TypeScript, React 18, Vitest, Testing Library, Vite, TailwindCSS

---

## Chunk 1: Shared Textarea Autosize

### Task 1: Add failing tests for shared autosize behavior

**Files:**
- Create: `src/components/ui/textarea.test.tsx`
- Modify: `src/components/ui/textarea.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/textarea.test.tsx` with focused tests that define the shared contract:

```tsx
it('preserves the current baseline height before content grows', () => {
  render(<Textarea rows={3} value="" onChange={() => undefined} />);
  const textarea = screen.getByRole('textbox');

  mockTextareaHeights(textarea, { offsetHeight: 96, scrollHeight: 96 });

  expect(textarea.style.height).toBe('96px');
});

it('grows to the content height until it reaches the max height', async () => {
  render(<Textarea value={'line 1\nline 2\nline 3'} onChange={() => undefined} />);
  const textarea = screen.getByRole('textbox');

  mockTextareaHeights(textarea, { offsetHeight: 80, scrollHeight: 180 });

  await waitFor(() => expect(textarea.style.height).toBe('180px'));
  expect(textarea.style.overflowY).toBe('hidden');
});

it('switches to internal scrolling after the max height is reached', async () => {
  render(<Textarea value={'long value'} onChange={() => undefined} maxAutoHeight="120px" />);
  const textarea = screen.getByRole('textbox');

  mockTextareaHeights(textarea, { offsetHeight: 80, scrollHeight: 240 });

  await waitFor(() => expect(textarea.style.height).toBe('120px'));
  expect(textarea.style.overflowY).toBe('auto');
});

it('resets back to the measured baseline when the controlled value clears', async () => {
  const { rerender } = render(<Textarea value={'long value'} onChange={() => undefined} />);
  const textarea = screen.getByRole('textbox');

  mockTextareaHeights(textarea, { offsetHeight: 80, scrollHeight: 180 });
  rerender(<Textarea value="" onChange={() => undefined} />);
  mockTextareaHeights(textarea, { offsetHeight: 80, scrollHeight: 80 });

  await waitFor(() => expect(textarea.style.height).toBe('80px'));
});
```

Use a local helper in the test file to define `offsetHeight` and `scrollHeight` on the rendered textarea, since jsdom will not calculate them for you.

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `npx vitest run src/components/ui/textarea.test.tsx`
Expected: FAIL because the shared textarea does not autosize and does not support a max-height override yet.

### Task 2: Implement the shared autosize behavior

**Files:**
- Create: `src/components/ui/textarea.test.tsx`
- Modify: `src/components/ui/textarea.tsx`

- [ ] **Step 3: Write the minimal implementation**

Update `src/components/ui/textarea.tsx` to:

```tsx
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autosize?: boolean;
  maxAutoHeight?: string | number;
}

const DEFAULT_MAX_AUTO_HEIGHT = '40svh';

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ autosize = true, maxAutoHeight = DEFAULT_MAX_AUTO_HEIGHT, className, style, ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
    const baselineHeightRef = React.useRef<number | null>(null);

    const resizeToFit = React.useCallback(() => {
      const node = innerRef.current;
      if (!node || !autosize) return;

      node.style.height = 'auto';
      const baseline = baselineHeightRef.current ?? node.offsetHeight;
      baselineHeightRef.current = baseline;

      const resolvedMaxHeight = resolveAutoHeight(maxAutoHeight, node);
      const nextHeight = Math.max(baseline, Math.min(node.scrollHeight, resolvedMaxHeight));

      node.style.height = `${nextHeight}px`;
      node.style.overflowY = node.scrollHeight > resolvedMaxHeight ? 'auto' : 'hidden';
    }, [autosize, maxAutoHeight]);

    React.useLayoutEffect(() => {
      resizeToFit();
    }, [resizeToFit, props.value, props.defaultValue]);

    return <textarea ref={mergeRefs(forwardedRef, innerRef)} style={style} {...props} />;
  },
);
```

Keep the current default Tailwind classes intact. Implement any small helpers you need inside this file so the component remains self-contained.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npx vitest run src/components/ui/textarea.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/textarea.tsx src/components/ui/textarea.test.tsx
git commit -m "Add shared textarea autosize behavior"
```

## Chunk 2: DM Composer Integration and Regression Coverage

### Task 3: Add failing tests for the DM composer baseline and reset behavior

**Files:**
- Modify: `src/pages/ConversationPage.test.tsx`
- Modify: `src/pages/ConversationPage.tsx`

- [ ] **Step 1: Extend the conversation page tests**

Add or update tests in `src/pages/ConversationPage.test.tsx` so they define the new DM-specific behavior:

```tsx
it('renders the composer with a two-line baseline', () => {
  renderPage();
  expect(screen.getByRole('textbox')).toHaveAttribute('rows', '2');
});

it('clears the composer only after a successful send', async () => {
  const user = userEvent.setup();
  mockSendMutateAsync.mockResolvedValueOnce(undefined);

  renderPage();
  const composer = screen.getByRole('textbox');

  await user.type(composer, 'hello');
  await user.keyboard('{Enter}');

  await waitFor(() => expect(mockSendMutateAsync).toHaveBeenCalledWith({
    participantPubkeys: [RECIPIENT_PUBKEY],
    content: 'hello',
    share: undefined,
  }));
  expect(composer).toHaveValue('');
});

it('keeps the composer content when send fails', async () => {
  const user = userEvent.setup();
  mockSendMutateAsync.mockRejectedValueOnce(new Error('publish failed'));

  renderPage();
  const composer = screen.getByRole('textbox');

  await user.type(composer, 'hello');
  await user.keyboard('{Enter}');

  await waitFor(() => expect(mockSendMutateAsync).toHaveBeenCalled());
  expect(composer).toHaveValue('hello');
});
```

Keep the existing keyboard behavior assertions for `Enter` send paths. Remove or rewrite any older test that expects the draft to clear before the send promise resolves.

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `npx vitest run src/pages/ConversationPage.test.tsx`
Expected: FAIL because the composer currently starts at one row and the success/failure assertions do not match the new contract.

### Task 4: Implement the DM composer changes and confirm focused coverage

**Files:**
- Modify: `src/pages/ConversationPage.tsx`
- Modify: `src/pages/ConversationPage.test.tsx`

- [ ] **Step 3: Write the minimal implementation**

Update `src/pages/ConversationPage.tsx` so the composer textarea:

```tsx
<Textarea
  value={draft}
  rows={2}
  className="min-h-[calc(theme(spacing.5)*2+theme(fontSize.sm[1].lineHeight)+theme(spacing.6))] ..."
  onChange={(event) => setDraft(event.target.value)}
  onKeyDown={handleComposerKeyDown}
/>
```

Keep `handleSend()` async, but only call `setDraft('')` after `sendMessage.mutateAsync(...)` resolves successfully. Do not clear in the `catch` path. Keep the send button bottom-aligned with the textarea container.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npx vitest run src/pages/ConversationPage.test.tsx src/components/ui/textarea.test.tsx`
Expected: PASS

- [ ] **Step 5: Run the full verification suite**

Run: `npm run test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/textarea.tsx src/components/ui/textarea.test.tsx src/pages/ConversationPage.tsx src/pages/ConversationPage.test.tsx
git commit -m "Improve textarea autosize and DM composer layout"
```
