/**
 * API Service for Java Migration Backend
 */
const configuredApiUrl = import.meta.env?.VITE_API_URL?.trim();
const isLocalFrontend =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
  window.location.port !== "8001";
const runtimeOrigin =
  isLocalFrontend
    ? "http://localhost:8001"
    : typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
    : "http://localhost:8001";

export const APP_BASE_URL = (configuredApiUrl || runtimeOrigin).replace(/\/+$/, "");
export const API_BASE_URL = `${APP_BASE_URL}/api`;
export const GITHUB_AUTH_LOGIN_URL = `${API_BASE_URL}/auth/github/login`;

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const bodyText = await response.text();

  if (!contentType.includes("application/json")) {
    if (bodyText.trim().startsWith("<!doctype") || bodyText.trim().startsWith("<html")) {
      throw new Error(`API routing error: expected JSON from ${response.url} but received HTML. Check VITE_API_URL or backend routing.`);
    }
    throw new Error(fallbackMessage);
  }

  const data = JSON.parse(bodyText);
  if (!response.ok) {
    const detail = data?.detail;
    let errorMessage = fallbackMessage;

    if (typeof detail === "string" && detail.trim()) {
      errorMessage = detail;
    } else if (Array.isArray(detail) && detail.length > 0) {
      errorMessage = detail
        .map((item: any) => item?.msg || item?.message || JSON.stringify(item))
        .join("; ");
    } else if (detail && typeof detail === "object") {
      errorMessage = detail.msg || detail.message || JSON.stringify(detail);
    } else if (typeof data?.error === "string" && data.error.trim()) {
      errorMessage = data.error;
    }

    throw new Error(errorMessage);
  }

  return data as T;
}

export interface RepoInfo {
  name: string;
  full_name: string;
  url: string;
  default_branch: string;
  language: string | null;
  description: string | null;
}

export interface RepoFile {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size: number;
  url: string;
}

export interface RepoUrlAnalysis {
  repo_url: string;
  owner: string;
  repo: string;
  analysis: RepoAnalysis;
}

export interface RepoVisibilityInfo {
  owner: string;
  repo: string;
  visibility: "public" | "private" | "private_or_inaccessible";
  requires_token: boolean;
  message: string;
}

export interface RepoFilesResponse {
  repo_url: string;
  owner: string;
  repo: string;
  path: string;
  files: RepoFile[];
}

export interface FileContentResponse {
  repo_url: string;
  owner: string;
  repo: string;
  file_path: string;
  content: string;
}

export interface DependencyInfo {
  group_id: string;
  artifact_id: string;
  current_version: string;
  new_version: string | null;
  status: string;
}

export interface ConversionType {
  id: string; 
  name: string;
  description: string;
  category: string;
  icon: string;
}

export interface MigrationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  status: 'detected' | 'fixed' | 'manual_review' | 'ignored';
  category: string;
  message: string;
  file_path: string;
  line_number: number | null;
  column: number | null;
  code_snippet: string | null;
  suggested_fix: string | null;
  fixed_at: string | null;
  conversion_type: string;
}

export interface PreviewFileChange {
  type: string;
  pattern?: string;
  replacement?: string;
  description: string;
  occurrences?: number;
}

export interface PreviewFileDiff {
  file_path: string;
  diff: string;
  change_count: number;
}

export interface MigrationPreview {
  repository: string;
  platform: string;
  source_version: string;
  target_version: string;
  conversions: string[];
  business_logic_fixes: boolean;
  summary: {
    files_to_modify: number;
    files_to_create: number;
    files_to_remove: number;
    total_changes: number;
  };
  changes: {
    files_to_modify: string[];
    files_to_create: string[];
    files_to_remove: string[];
    file_changes: Record<string, PreviewFileChange[]>;
    dependencies_to_update: Array<{
      dependency: string;
      current_version: string;
      new_version: string;
      status?: string;
    }>;
    issues_to_fix: Array<{
      type: string;
      severity: string;
      description: string;
      file: string;
    }>;
  };
  file_diffs: PreviewFileDiff[];
}

export interface MigrationRequest {
  source_repo_url: string;
  target_repo_name: string;
  migration_approach?: string;
  platform?: string;
  source_java_version: string;
  target_java_version: string;
  token?: string;
  conversion_types: string[];
  email?: string;
  run_tests: boolean;
  run_sonar: boolean;
  run_fossa?: boolean;
  fix_business_logic: boolean;
}

export interface MigrationResult {
  job_id: string;
  status: string;
  source_repo: string;
  target_repo: string | null;
  source_java_version: string;
  target_java_version: string;
  conversion_types: string[];
  started_at: string;
  completed_at: string | null;
  progress_percent: number;
  current_step: string;
  dependencies: DependencyInfo[];
  files_modified: number;
  issues_fixed: number;
  api_endpoints_validated: number;
  api_endpoints_working: number;
  sonar_quality_gate: string | null;
  sonar_bugs: number;
  sonar_vulnerabilities: number;
  sonar_code_smells: number;
  sonar_coverage: number;
  // FOSSA scan results (optional)
  fossa_policy_status?: string | null;
  fossa_total_dependencies?: number;
  fossa_license_issues?: number;
  fossa_vulnerabilities?: number;
  fossa_outdated_dependencies?: number;
  error_message: string | null;
  migration_log: string[];
  issues: MigrationIssue[];
  total_errors: number;
  total_warnings: number;
  errors_fixed: number;
  warnings_fixed: number;
}

export interface RepoAnalysis {
  name: string;
  full_name: string;
  default_branch: string;
  language: string | null;
  build_tool: string | null;
  java_version: string | null;
  // List of discovered Java source file paths
  java_files?: string[];
  has_tests: boolean;
  dependencies: DependencyInfo[];
  api_endpoints: { path: string; method: string; file: string }[];
  structure: {
    has_pom_xml: boolean;
    has_build_gradle: boolean;
    has_src_main: boolean;
    has_src_test: boolean;
  };
}

export interface JavaVersionInfo {
  source_versions: { value: string; label: string }[];
  target_versions: { value: string; label: string }[];
}

export interface JavaVersionRecommendationRequest {
  source_java_version: string;
  detected_java_version?: string | null;
  build_tool?: string | null;
  dependencies: DependencyInfo[];
  has_tests: boolean;
  api_endpoint_count: number;
  risk_level?: string | null;
}

export interface JavaVersionRecommendationResponse {
  recommended_target_version: string;
  confidence: string;
  rationale: string[];
  alternatives: string[];
}

// Fetch GitHub repositories
export async function fetchRepositories(token: string): Promise<RepoInfo[]> {
  const response = await fetch(`${API_BASE_URL}/github/repos?token=${encodeURIComponent(token)}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch repositories');
  }
  return response.json();
}

// Analyze a repository
export async function analyzeRepository(token: string, owner: string, repo: string): Promise<RepoAnalysis> {
  const response = await fetch(
    `${API_BASE_URL}/github/repo/${owner}/${repo}/analyze?token=${encodeURIComponent(token)}`
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to analyze repository');
  }
  return response.json();
}

// NEW: Analyze repository directly by URL (works for public repos without token)
export async function analyzeRepoUrl(repoUrl: string, token: string = ""): Promise<RepoUrlAnalysis> {
  const response = await fetch(
    `${API_BASE_URL}/github/analyze-url?repo_url=${encodeURIComponent(repoUrl)}&token=${encodeURIComponent(token)}`
  );
  return parseJsonResponse<RepoUrlAnalysis>(response, 'Failed to analyze repository');
}

export async function getRepoVisibility(repoUrl: string, token: string = ""): Promise<RepoVisibilityInfo> {
  const response = await fetch(
    `${API_BASE_URL}/github/repo-visibility?repo_url=${encodeURIComponent(repoUrl)}&token=${encodeURIComponent(token)}`
  );
  return parseJsonResponse<RepoVisibilityInfo>(response, 'Failed to check repository visibility');
}

// NEW: List files in a repository (works for public repos without token)
export async function listRepoFiles(repoUrl: string, token: string = "", path: string = ""): Promise<RepoFilesResponse> {
  const response = await fetch(
    `${API_BASE_URL}/github/list-files?repo_url=${encodeURIComponent(repoUrl)}&token=${encodeURIComponent(token)}&path=${encodeURIComponent(path)}`
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to list files');
  }
  return response.json();
}

// NEW: Get file content (works for public repos without token)
export async function getFileContent(repoUrl: string, filePath: string, token: string = ""): Promise<FileContentResponse> {
  const response = await fetch(
    `${API_BASE_URL}/github/file-content?repo_url=${encodeURIComponent(repoUrl)}&file_path=${encodeURIComponent(filePath)}&token=${encodeURIComponent(token)}`
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get file content');
  }
  return response.json();
}

// Get available Java versions
export async function getJavaVersions(): Promise<JavaVersionInfo> {
  const response = await fetch(`${API_BASE_URL}/java-versions`);
  return parseJsonResponse<JavaVersionInfo>(response, 'Failed to fetch Java versions');
}

export async function getJavaVersionRecommendation(
  request: JavaVersionRecommendationRequest
): Promise<JavaVersionRecommendationResponse> {
  const response = await fetch(`${API_BASE_URL}/java-version-recommendation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  return parseJsonResponse<JavaVersionRecommendationResponse>(
    response,
    "Failed to get Java version recommendation"
  );
}

// Get available conversion types
export async function getConversionTypes(): Promise<ConversionType[]> {
  const response = await fetch(`${API_BASE_URL}/conversion-types`);
  return parseJsonResponse<ConversionType[]>(response, 'Failed to fetch conversion types');
}

// Start migration
export async function startMigration(request: MigrationRequest): Promise<MigrationResult> {
  const response = await fetch(`${API_BASE_URL}/migration/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to start migration');
  }
  return response.json();
}

export async function previewMigration(request: MigrationRequest): Promise<MigrationPreview> {
  const response = await fetch(`${API_BASE_URL}/migration/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  return parseJsonResponse<MigrationPreview>(response, 'Failed to preview migration changes');
}

// Get migration status
export async function getMigrationStatus(jobId: string): Promise<MigrationResult> {
  const response = await fetch(`${API_BASE_URL}/migration/${jobId}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get migration status');
  }
  return response.json();
}

// Get migration logs
export async function getMigrationLogs(jobId: string): Promise<{ job_id: string; logs: string[] }> {
  const response = await fetch(`${API_BASE_URL}/migration/${jobId}/logs`);
  if (!response.ok) {
    throw new Error('Failed to get migration logs');
  }
  return response.json();
}

// Get FOSSA scan results for a migration (if available)
export async function getMigrationFossa(jobId: string): Promise<{
  job_id: string;
  policy_status?: string | null;
  total_dependencies?: number;
  license_issues?: number;
  vulnerabilities?: number;
  outdated_dependencies?: number;
}> {
  const response = await fetch(`${API_BASE_URL}/migration/${jobId}/fossa`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to get FOSSA results');
  }

  const data = await response.json();
  const payload = (data && data.fossa) ? data.fossa : data;

  // Backend `fossa_service.py` returns keys like `compliance_status`,
  // `total_dependencies`, `licenses` (map), `vulnerabilities` (map),
  // and `dependencies` (array). Normalize to the frontend-friendly shape.
  const policy_status = payload.compliance_status ?? payload.policy_status ?? null;
  const total_dependencies = payload.total_dependencies ?? payload.totalDeps ?? 0;

  // Count license issues: prefer explicit numeric field, else count UNKNOWN licenses
  let license_issues = 0;
  if (typeof payload.license_issues === 'number') {
    license_issues = payload.license_issues;
  } else if (payload.licenses && typeof payload.licenses === 'object') {
    // Heuristic: count UNKNOWN licenses or sum non-empty license counts
    license_issues = payload.licenses.UNKNOWN || Object.values(payload.licenses).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
  }

  // Sum vulnerabilities counts if provided as an object
  let vulnerabilities = 0;
  if (typeof payload.vulnerabilities === 'number') {
    vulnerabilities = payload.vulnerabilities;
  } else if (payload.vulnerabilities && typeof payload.vulnerabilities === 'object') {
    vulnerabilities = Object.values(payload.vulnerabilities).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
  }

  // Count outdated dependencies if the dependencies list contains status field
  let outdated_dependencies = 0;
  if (Array.isArray(payload.dependencies)) {
    outdated_dependencies = payload.dependencies.filter((d: any) => d.status === 'outdated' || d.status === 'out-of-date' || d.outdated === true).length;
  } else if (typeof payload.outdated_dependencies === 'number') {
    outdated_dependencies = payload.outdated_dependencies;
  }

  return {
    job_id: jobId,
    policy_status,
    total_dependencies,
    license_issues,
    vulnerabilities,
    outdated_dependencies,
  };
}

// Download migrated project as ZIP
export async function downloadMigratedProject(jobId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/migration/${jobId}/download-zip`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to download migrated project');
  }
  return response.blob();
}

// Download migration report
export async function downloadMigrationReport(jobId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/migration/${jobId}/report`);
  if (!response.ok) {
    throw new Error('Failed to download migration report');
  }
  return response.blob();
}

// List all migrations
export async function listMigrations(): Promise<MigrationResult[]> {
  const response = await fetch(`${API_BASE_URL}/migrations`);
  if (!response.ok) {
    throw new Error('Failed to list migrations');
  }
  return response.json();
}

// Get available recipes
export async function getRecipes(): Promise<{ id: string; name: string; description: string }[]> {
  const response = await fetch(`${API_BASE_URL}/openrewrite/recipes`);
  if (!response.ok) {
    throw new Error('Failed to fetch recipes');
  }
  return response.json();
}

// Health check
export async function healthCheck(): Promise<{ status: string; timestamp: string }> {
  const response = await fetch(`${APP_BASE_URL}/health`);
  return parseJsonResponse<{ status: string; timestamp: string }>(response, 'Failed to reach backend health endpoint');
}

// Clone a repository and run a FOSSA analysis (backend will return simulated results when CLI unavailable)
export async function analyzeFossaForRepo(repoUrl: string, token: string = ""): Promise<{
  repo_url: string;
  fossa: {
    compliance_status?: string | null;
    total_dependencies?: number;
    licenses?: Record<string, number>;
    vulnerabilities?: Record<string, number> | number;
    outdated_dependencies?: number;
  };
}> {
  const response = await fetch(`${API_BASE_URL}/fossa/analyze-url?repo_url=${encodeURIComponent(repoUrl)}&token=${encodeURIComponent(token)}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to run FOSSA analyze');
  }
  return response.json();
}

// Update Java version in pom.xml or build.gradle
export interface UpdateJavaVersionResponse {
  success: boolean;
  file_path: string;
  java_version: string;
  message: string;
}

export async function updateJavaVersion(
  repoUrl: string, 
  javaVersion: string, 
  filePath: string, 
  token: string = ""
): Promise<UpdateJavaVersionResponse> {
  const response = await fetch(
    `${API_BASE_URL}/github/update-java-version?repo_url=${encodeURIComponent(repoUrl)}&java_version=${encodeURIComponent(javaVersion)}&file_path=${encodeURIComponent(filePath)}&token=${encodeURIComponent(token)}`,
    { method: 'POST' }
  );
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to update Java version');
  }
  return response.json();
}
