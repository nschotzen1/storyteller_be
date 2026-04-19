import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');
const frontendRoot = path.resolve(backendRoot, '../storyteller-vite-tailwind/src');

const ROUTE_SOURCE_FILES = [
  { file: path.join(backendRoot, 'server_new.js'), prefix: '' },
  ...fs.readdirSync(path.join(backendRoot, 'routes/serverNew'))
    .filter((name) => name.endsWith('.js'))
    .sort()
    .map((name) => ({ file: path.join(backendRoot, 'routes/serverNew', name), prefix: '' })),
  { file: path.join(backendRoot, 'routes/memoriesRoutes.js'), prefix: '/api' }
];

const METHOD_PATTERN = /\b(?:app|router)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
const VALID_CODE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);

function walkFiles(rootDir, predicate = () => true) {
  const results = [];
  if (!fs.existsSync(rootDir)) {
    return results;
  }

  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const stats = fs.statSync(current);
    if (stats.isDirectory()) {
      const children = fs.readdirSync(current).map((name) => path.join(current, name));
      stack.push(...children);
      continue;
    }
    if (predicate(current)) {
      results.push(current);
    }
  }
  return results;
}

function normalizeRoutePath(rawPath, prefix = '') {
  if (!rawPath) return '';
  if (!prefix) return rawPath;
  if (rawPath.startsWith('/')) {
    return `${prefix}${rawPath}`;
  }
  return `${prefix}/${rawPath}`;
}

function extractRoutes(filePath, prefix = '') {
  const source = fs.readFileSync(filePath, 'utf8');
  const routes = [];
  let match;
  while ((match = METHOD_PATTERN.exec(source)) !== null) {
    routes.push({
      method: match[1].toUpperCase(),
      path: normalizeRoutePath(match[2], prefix),
      sourceFile: filePath
    });
  }
  return routes;
}

function searchStem(routePath) {
  const paramIndex = routePath.indexOf('/:');
  if (paramIndex >= 0) {
    return routePath.slice(0, paramIndex + 1);
  }
  return routePath;
}

function readFiles(filePaths) {
  return filePaths.map((filePath) => ({
    filePath,
    content: fs.readFileSync(filePath, 'utf8')
  }));
}

function countMatches(needle, fileEntries) {
  const matches = fileEntries
    .filter(({ content }) => content.includes(needle))
    .map(({ filePath }) => path.relative(backendRoot, filePath));

  return {
    count: matches.length,
    files: matches
  };
}

function classifyRoute(referenceBuckets) {
  if (referenceBuckets.frontend.count > 0) {
    return 'frontend';
  }
  if (referenceBuckets.tests.count > 0 || referenceBuckets.scripts.count > 0) {
    return 'internal_only';
  }
  return 'no_local_refs';
}

const frontendFiles = readFiles(
  walkFiles(frontendRoot, (filePath) => VALID_CODE_EXTENSIONS.has(path.extname(filePath)))
);
const testFiles = readFiles(
  walkFiles(backendRoot, (filePath) => filePath.endsWith('.test.js'))
);
const scriptFiles = readFiles(
  walkFiles(path.join(backendRoot, 'scripts'), (filePath) => VALID_CODE_EXTENSIONS.has(path.extname(filePath)))
);

const routes = ROUTE_SOURCE_FILES.flatMap(({ file, prefix }) => extractRoutes(file, prefix));
const uniqueRoutes = Array.from(
  new Map(routes.map((route) => [`${route.method} ${route.path}`, route])).values()
).sort((left, right) => left.path.localeCompare(right.path) || left.method.localeCompare(right.method));

const report = uniqueRoutes.map((route) => {
  const needle = searchStem(route.path);
  const referenceBuckets = {
    frontend: countMatches(needle, frontendFiles),
    tests: countMatches(needle, testFiles),
    scripts: countMatches(needle, scriptFiles)
  };

  return {
    ...route,
    needle,
    classification: classifyRoute(referenceBuckets),
    references: referenceBuckets
  };
});

const summary = {
  totalRoutes: report.length,
  frontend: report.filter((entry) => entry.classification === 'frontend').length,
  internal_only: report.filter((entry) => entry.classification === 'internal_only').length,
  no_local_refs: report.filter((entry) => entry.classification === 'no_local_refs').length
};

console.log(JSON.stringify({ summary, routes: report }, null, 2));
