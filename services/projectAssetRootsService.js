import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const FRONTEND_PUBLIC_ROOT = path.resolve(PROJECT_ROOT, 'storyteller-vite-tailwind/public');
const CANONICAL_PROJECT_ASSETS_ROOT = path.resolve(PROJECT_ROOT, 'storyteller-vite-tailwind/public/assets');

const ASSET_ROOT_CANDIDATES = [
  CANONICAL_PROJECT_ASSETS_ROOT,
  path.resolve(PROJECT_ROOT, 'assets'),
  path.resolve(PROJECT_ROOT, 'storyteller_be/assets'),
  path.resolve(process.cwd(), 'assets'),
  path.resolve(process.cwd(), '../assets')
];

export function getCanonicalProjectAssetRoot() {
  return CANONICAL_PROJECT_ASSETS_ROOT;
}

export function getFrontendPublicRoot() {
  return FRONTEND_PUBLIC_ROOT;
}

export function getProjectAssetRoots() {
  const uniqueCandidates = Array.from(new Set(ASSET_ROOT_CANDIDATES));
  const existingRoots = uniqueCandidates.filter((candidatePath) => fs.existsSync(candidatePath));

  if (!existingRoots.includes(CANONICAL_PROJECT_ASSETS_ROOT)) {
    existingRoots.unshift(CANONICAL_PROJECT_ASSETS_ROOT);
  }

  return existingRoots;
}

function normalizeAssetPathname(assetUrl = '') {
  const rawValue = String(assetUrl || '').trim();
  if (!rawValue) return '';

  try {
    if (/^https?:\/\//i.test(rawValue)) {
      return new URL(rawValue).pathname || '';
    }
  } catch {
    return '';
  }

  if (rawValue.startsWith('/')) {
    return rawValue;
  }

  return '';
}

export function resolveProjectAssetUrl(assetUrl = '') {
  const pathname = normalizeAssetPathname(assetUrl);
  if (!pathname) {
    return {
      imageUrl: String(assetUrl || ''),
      localPath: '',
      assetDirectory: '',
      exists: false
    };
  }

  if (pathname.startsWith('/assets/')) {
    const relativePath = pathname.slice('/assets/'.length);
    const candidateRoots = getProjectAssetRoots();
    const canonicalPath = path.join(CANONICAL_PROJECT_ASSETS_ROOT, relativePath);
    const existingPath = candidateRoots
      .map((rootPath) => path.join(rootPath, relativePath))
      .find((candidatePath) => fs.existsSync(candidatePath));
    const localPath = existingPath || canonicalPath;
    return {
      imageUrl: assetUrl,
      pathname,
      relativePath,
      localPath,
      assetDirectory: path.dirname(localPath),
      exists: fs.existsSync(localPath)
    };
  }

  const publicRelativePath = pathname.replace(/^\/+/, '');
  const localPath = path.join(FRONTEND_PUBLIC_ROOT, publicRelativePath);
  return {
    imageUrl: assetUrl,
    pathname,
    relativePath: publicRelativePath,
    localPath,
    assetDirectory: path.dirname(localPath),
    exists: fs.existsSync(localPath)
  };
}
