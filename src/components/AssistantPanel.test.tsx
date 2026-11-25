import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAssistant } from '../assistant/store';
import { usePlayback } from '../state/playbackStore';
import type { Trace } from '../types/trace';
import { runJsTrace } from '../worker/jsTracer';
import { AssistantPanel } from './AssistantPanel';

const CODE = `let total = 0;\nfor (let i = 1; i <= 3; i++) {\n  total += i;\n}\nconsole.log(total);`;

function loadTrace(index = 0) {
  const trace: Trace = {
    schemaVersion: 1,
    language: 'javascript',
    site: 'browser',
    runtimeVersion: 'test',
    ...runJsTrace(CODE),
  };
  act(() => {
    usePlayback.getState().setTrace(trace);
    usePlayback.getState().seek(index);
  });
  return trace;
}

afterEach(() => {
  vi.unstubAllGlobals();
  act(() => useAssistant.setState({ messages: [], busy: false, tab: 'step' }));
  act(() => usePlayback.getState().setTrace(null));
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
});

describe('AssistantPanel', () => {
  it('explains the current step without AI and follows playback', () => {
    loadTrace(0);
    render(<AssistantPanel code={CODE} language="javascript" />);
    expect(screen.getByText(/The program starts/)).toBeInTheDocument();

    act(() => usePlayback.getState().seek(3));
    expect(screen.getByText(/Step 4\//)).toBeInTheDocument();
  });

  it('runs a quiz whose answer is checked against the trace', () => {
    loadTrace(0);
    render(<AssistantPanel code={CODE} language="javascript" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Quiz' }));

    const options = screen.getAllByRole('button').filter((b) => b.className.includes('quiz__opt'));
    expect(options.length).toBeGreaterThanOrEqual(3);
    fireEvent.click(options[0]);
    expect(screen.getByRole('status')).toHaveTextContent(/Correct!|Not quite\./);
    expect(screen.getByText(/Score \d\/1/)).toBeInTheDocument();
  });

  it('streams an AI answer into the chat', async () => {
    loadTrace(2);
    const fetchMock = vi.fn(
      async () =>
        new Response(
          new ReadableStream({
            start(c) {
              const enc = new TextEncoder();
              c.enqueue(enc.encode('This program **adds** '));
              c.enqueue(enc.encode('the numbers 1 to 3.'));
              c.close();
            },
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<AssistantPanel code={CODE} language="javascript" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Ask AI' }));
    fireEvent.click(screen.getByRole('button', { name: 'What does this code do?' }));

    await waitFor(() => expect(screen.getByText(/the numbers 1 to 3\./)).toBeInTheDocument());
    expect(screen.getByText('adds').tagName).toBe('STRONG');

    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body.mode).toBe('explain');
    expect(body.context.step.index).toBe(2);
    expect(body.context.code).toBe(CODE);
  });

  it('shows the server error message when the assistant is not configured', async () => {
    loadTrace(0);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: 'The AI assistant is not set up yet.' }), {
            status: 503,
          }),
      ),
    );
    render(<AssistantPanel code={CODE} language="javascript" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Ask AI' }));
    fireEvent.change(screen.getByLabelText('Your question'), {
      target: { value: 'Why is total 6?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('not set up yet');
    expect(screen.getByText('Why is total 6?')).toBeInTheDocument();
  });
});
