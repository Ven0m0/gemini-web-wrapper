import { useState } from "react";
import { buildCloneCommand, isValidGitUrl } from "../services/shell";

interface CloneTarget {
  id: string;
  name: string;
  /** WebSocket URL of the session; plaintext ws:// to a remote host must not carry the token. */
  url: string;
}

function isTokenSafeTransport(url: string): boolean {
  return url.startsWith("wss://") || /^ws:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(url);
}

interface GitClonePanelProps {
  owner: string;
  repo: string;
  branch: string;
  githubToken: string;
  /** Sessions that are currently connected and can receive input. */
  targets: CloneTarget[];
  onClone: (profileId: string, command: string) => void;
}

const GITHUB_HTTPS_PREFIX = "https://github.com/";

export function GitClonePanel({ owner, repo, branch, githubToken, targets, onClone }: GitClonePanelProps) {
  const defaultUrl = owner && repo ? `${GITHUB_HTTPS_PREFIX}${owner}/${repo}.git` : "";
  // null means "untouched": follow the configured repo until the user types.
  const [editedUrl, setEditedUrl] = useState<string | null>(null);
  const [targetId, setTargetId] = useState("");
  const [useToken, setUseToken] = useState(false);
  const [error, setError] = useState("");

  const url = (editedUrl ?? defaultUrl).trim();
  const target = targets.find((item) => item.id === targetId) ?? targets[0];
  const canUseToken =
    Boolean(githubToken) && url.startsWith(GITHUB_HTTPS_PREFIX) && (!target || isTokenSafeTransport(target.url));

  const submit = () => {
    if (!target) {
      return;
    }
    if (!isValidGitUrl(url)) {
      setError("Invalid git URL. Use HTTPS (https://...) or SSH (git@host:...) format.");
      return;
    }
    setError("");
    // The configured branch belongs to the configured repo; an edited URL clones its remote default.
    onClone(target.id, buildCloneCommand(url, useToken && canUseToken, githubToken, editedUrl === null ? branch : ''));
  };

  return (
    <form
      className="shell-profile-form shell-clone-panel"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <strong>Clone repository</strong>
      <input
        type="text"
        value={editedUrl ?? defaultUrl}
        onChange={(event) => {
          setEditedUrl(event.target.value);
          setError("");
        }}
        placeholder="https://github.com/owner/repo.git"
        aria-label="Repository URL"
      />
      <select
        value={target?.id ?? ""}
        onChange={(event) => setTargetId(event.target.value)}
        disabled={targets.length === 0}
        aria-label="Target session"
      >
        {targets.length === 0 && <option value="">No connected sessions</option>}
        {targets.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
      {targets.length === 0 && <span className="shell-toolbar-text">Connect a saved shell to run the clone in it.</span>}
      {canUseToken && (
        <label className="shell-clone-checkbox">
          <input type="checkbox" checked={useToken} onChange={(event) => setUseToken(event.target.checked)} />
          Include GitHub token (the shell may echo it; shells without HISTCONTROL=ignorespace keep it in history)
        </label>
      )}
      {error && <div className="shell-inline-error">{error}</div>}
      <button type="submit" className="shell-primary-button" disabled={targets.length === 0}>
        Clone
      </button>
    </form>
  );
}
