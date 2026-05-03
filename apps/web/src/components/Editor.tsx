import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import CodeMirror from '@uiw/react-codemirror';
import React, { useState } from 'react';
import { imagePasteDrop } from '../codemirror/imagePasteDrop';
import { imagePreview } from '../codemirror/imagePreview';
import { formatDiffText, hasChanges } from '../services/diff';
import { GitHubService } from '../services/github';
import { useStore } from '../store';

type DiffMode = 'original' | 'modified' | 'diff';

export const Editor: React.FC = () => {
  const [diffMode, setDiffMode] = useState<DiffMode>('modified');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  const { file, setFile, setMode, config } = useStore();

  const getLanguageExtension = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase();

    // Chinese text support extensions
    const chineseSupport = [
      EditorView.lineWrapping,
      EditorView.theme({
        '.cm-content': {
          fontFamily:
            '"SF Pro Text", "SF Mono", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Source Han Sans SC", "Microsoft YaHei", "WenQuanYi Zen Hei", "Helvetica Neue", Arial, sans-serif !important',
          lineHeight: '1.6',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          fontSize: '14px',
        },
        '.cm-editor': {
          fontFamily:
            '"SF Pro Text", "SF Mono", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Source Han Sans SC", "Microsoft YaHei", "WenQuanYi Zen Hei", "Helvetica Neue", Arial, sans-serif !important',
        },
        '.cm-scroller': {
          fontFamily:
            '"SF Pro Text", "SF Mono", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Source Han Sans SC", "Microsoft YaHei", "WenQuanYi Zen Hei", "Helvetica Neue", Arial, sans-serif !important',
          fontFeatureSettings: '"liga" 0, "calt" 0',
          fontSize: '14px !important',
        },
        '.cm-line': {
          fontFamily:
            '"SF Pro Text", "SF Mono", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", "Source Han Sans SC", "Microsoft YaHei", "WenQuanYi Zen Hei", "Helvetica Neue", Arial, sans-serif !important',
        },
      }),
    ];

    switch (ext) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
        return [javascript({ jsx: true, typescript: ext.includes('ts') }), ...chineseSupport];
      case 'md':
      case 'markdown':
        return [markdown(), ...chineseSupport];
      case 'json':
        return [json(), ...chineseSupport];
      default:
        return chineseSupport;
    }
  };

  const getDisplayContent = () => {
    switch (diffMode) {
      case 'original':
        return file.original;
      case 'modified':
        return file.current;
      case 'diff':
        if (!hasChanges(file.original, file.current)) {
          return 'No changes to display';
        }
        return formatDiffText(file.original, file.current);
      default:
        return file.current;
    }
  };

  const uploadImagesToRepo = async (files: File[], _dataUrls: string[]): Promise<string[] | void> => {
    try {
      const { githubToken, owner, repo, branch } = config;
      if (!githubToken || !owner || !repo) return;
      const gh = new GitHubService(githubToken, owner, repo);

      const toBase64 = async (file: File) => {
        const buf = new Uint8Array(await file.arrayBuffer());
        // Convert bytes to base64 without inflating memory too much
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < buf.length; i += chunkSize) {
          const chunk = buf.subarray(i, i + chunkSize);
          binary += String.fromCharCode.apply(null, Array.from(chunk) as any);
        }
        return btoa(binary);
      };

      const timestamp = new Date()
        .toISOString()
        .replace(/[-:T.Z]/g, '')
        .slice(0, 14);
      const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, '_');
      const basePath = 'assets';

      const urls: string[] = [];
      for (const file of files) {
        const name = sanitize(file.name.replace(/\s+/g, '_'));
        const path = `${basePath}/${timestamp}-${name}`;
        const base64 = await toBase64(file);
        await gh.updateFileBase64(path, base64, '', `chore: add image ${file.name} via paste`, branch);
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
        urls.push(rawUrl);
      }
      return urls;
    } catch (e) {
      throw new Error(`Image upload failed: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
    }
  };

  const handleContentChange = (value: string) => {
    if (diffMode === 'modified') {
      setFile({
        current: value,
        dirty: value !== file.original,
      });
    }
  };

  const cycleDiffMode = () => {
    const modes: DiffMode[] = ['original', 'modified', 'diff'];
    const currentIndex = modes.indexOf(diffMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setDiffMode(modes[nextIndex]);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const getDiffModeLabel = () => {
    switch (diffMode) {
      case 'original':
        return 'Original';
      case 'modified':
        return 'Modified';
      case 'diff':
        return 'Diff';
    }
  };

  return (
    <div className="editor-container">
      <div className="editor-status-bar">
        <div className="status-left">
          <span className="branch-info">{config.branch}</span>
          <span className="path-info">{config.path}</span>
          {file.dirty && <span className="dirty-flag">*</span>}
        </div>

        <div className="status-center">
          <button onClick={cycleDiffMode} className="diff-mode-btn">
            {getDiffModeLabel()}
          </button>
        </div>

        <div className="status-right">
          <button onClick={toggleTheme} className="theme-btn" title="Toggle theme">
            {theme === 'dark' ? 'Sun' : 'Moon'}
          </button>
          <button onClick={() => setMode('shell')} className="mode-btn" title="Switch to CLI">
            CLI
          </button>
        </div>
      </div>

      <div className="editor-content">
        <CodeMirror
          value={getDisplayContent()}
          onChange={handleContentChange}
          extensions={(function () {
            const base = getLanguageExtension(config.path);
            const isMarkdown = /\.(md|markdown)$/i.test(config.path || '');
            if (isMarkdown && diffMode !== 'diff') {
              return [...base, imagePreview(), imagePasteDrop({ onResolveUrls: uploadImagesToRepo })];
            }
            return base;
          })()}
          theme={theme === 'dark' ? oneDark : undefined}
          editable={diffMode === 'modified'}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            dropCursor: false,
            allowMultipleSelections: false,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            highlightSelectionMatches: false,
            searchKeymap: false,
          }}
          className={`editor-codemirror ${diffMode === 'diff' ? 'diff-view' : ''}`}
          placeholder={diffMode === 'modified' ? 'Type or edit text here...' : undefined}
        />
      </div>

      {diffMode === 'diff' && hasChanges(file.original, file.current) && (
        <div className="diff-legend">
          <div className="diff-legend-item">
            <span className="diff-added">+</span> Added lines
          </div>
          <div className="diff-legend-item">
            <span className="diff-removed">-</span> Removed lines
          </div>
        </div>
      )}
    </div>
  );
};
