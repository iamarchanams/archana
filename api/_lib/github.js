const config = require("./config");

const API_ROOT = "https://api.github.com";

function authHeaders() {
  return {
    Authorization: `Bearer ${config.GITHUB_TOKEN()}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "rahul-vr-portfolio-admin"
  };
}

async function getFile(path) {
  const owner = config.GITHUB_OWNER();
  const repo = config.GITHUB_REPO();
  const branch = config.GITHUB_BRANCH();
  const url = `${API_ROOT}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub getFile failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return { sha: data.sha, contentBase64: data.content };
}

// Creates or updates a file. `contentBase64` must already be base64-encoded.
async function putFile(path, contentBase64, message, sha) {
  const owner = config.GITHUB_OWNER();
  const repo = config.GITHUB_REPO();
  const branch = config.GITHUB_BRANCH();
  const url = `${API_ROOT}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const body = {
    message: message || `Update ${path} via admin panel`,
    content: contentBase64,
    branch
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: "PUT",
    headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`GitHub putFile failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function listDir(path) {
  const owner = config.GITHUB_OWNER();
  const repo = config.GITHUB_REPO();
  const branch = config.GITHUB_BRANCH();
  const url = `${API_ROOT}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub listDir failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function deleteFile(path, sha, message) {
  const owner = config.GITHUB_OWNER();
  const repo = config.GITHUB_REPO();
  const branch = config.GITHUB_BRANCH();
  const url = `${API_ROOT}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
    body: JSON.stringify({ message: message || `Delete ${path} via admin panel`, sha, branch })
  });
  if (!res.ok) throw new Error(`GitHub deleteFile failed (${res.status}): ${await res.text()}`);
  return res.json();
}

module.exports = { getFile, putFile, listDir, deleteFile };
