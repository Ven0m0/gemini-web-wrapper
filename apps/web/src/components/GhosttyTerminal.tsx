import { useCallback, useEffect, useRef, useState } from 'react';

export interface GhosttyTerminalChunk {
  id: number;
  data: string;
}

interface GhosttyTerminalProps {
  chunks: GhosttyTerminalChunk[];
  fontSize: number;
  active: boolean;
  onData: (data: string) => void;
}

type GhosttyModule = typeof import('ghostty-web');
type GhosttyInstance = InstanceType<GhosttyModule['Terminal']>;
type FitAddonInstance = InstanceType<GhosttyModule['FitAddon']>;

let ghosttyModulePromise: Promise<GhosttyModule> | null = null;

async function loadGhosttyModule(): Promise<GhosttyModule> {
  if (!ghosttyModulePromise) {
    ghosttyModulePromise = import('ghostty-web').then(async (module) => {
      await module.init();
      return module;
    });
  }

  return ghosttyModulePromise;
}

export function GhosttyTerminal({ chunks, fontSize, active, onData }: GhosttyTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<GhosttyInstance | null>(null);
  const fitAddonRef = useRef<FitAddonInstance | null>(null);
  const chunkCountRef = useRef(0);
  const onDataRef = useRef(onData);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  const appendPendingChunks = useCallback(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    const pending = chunks.slice(chunkCountRef.current);
    if (pending.length === 0) {
      return;
    }

    terminal.write(pending.map((chunk) => chunk.data).join(''));
    chunkCountRef.current = chunks.length;
  }, [chunks]);

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      try {
        const ghostty = await loadGhosttyModule();
        if (cancelled || !containerRef.current) {
          return;
        }

        const terminal = new ghostty.Terminal({
          cursorBlink: true,
          fontSize,
          scrollback: 10000,
          theme: {
            background: '#020817',
            foreground: '#e2e8f0',
          },
        });
        const fitAddon = new ghostty.FitAddon();

        terminal.loadAddon(fitAddon);
        terminal.open(containerRef.current);
        fitAddon.fit();
        fitAddon.observeResize();
        terminal.onData((data: string) => {
          onDataRef.current(data);
        });

        terminalRef.current = terminal;
        fitAddonRef.current = fitAddon;
        chunkCountRef.current = 0;
        appendPendingChunks();
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : String(error));
      }
    };

    void setup();

    return () => {
      cancelled = true;
      fitAddonRef.current?.dispose();
      fitAddonRef.current = null;
      terminalRef.current?.dispose();
      terminalRef.current = null;
      chunkCountRef.current = 0;
    };
  }, [appendPendingChunks, fontSize]);

  useEffect(() => {
    appendPendingChunks();
  }, [appendPendingChunks]);

  useEffect(() => {
    if (active) {
      fitAddonRef.current?.fit();
    }
  }, [active]);

  return (
    <div className="ghostty-terminal-shell">
      <div ref={containerRef} className="ghostty-terminal-canvas" />
      {loadError && (
        <div className="shell-empty-state shell-empty-state-inline">
          <strong>Ghostty failed to load.</strong>
          <span>{loadError}</span>
        </div>
      )}
    </div>
  );
}
