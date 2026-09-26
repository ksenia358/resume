import { cp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { format, resolveConfig } from 'prettier';
import type { Plugin } from 'vite';

const CONTENT_DIR = 'src/shared/data/content';
const PHOTO_FILE = 'src/shared/assets/photos/profile.jpeg';
const CERTIFICATES_DIR = 'src/shared/assets/img/certificates';

type Photo = { src: string; lang: string; isOfficialDocument?: boolean };

// The one saved version of the resume in `yarn dev`: a copy of the data and of the photos (not in git).
const VERSION_DIR = '.resume-version';
const VERSIONED = [CONTENT_DIR, CERTIFICATES_DIR, PHOTO_FILE];

async function versionDate(): Promise<string | null> {
  try {
    return (await readFile(path.join(VERSION_DIR, 'saved-at'), 'utf8')).trim();
  } catch {
    return null;
  }
}

async function saveVersion(): Promise<string> {
  await rm(VERSION_DIR, { recursive: true, force: true });
  for (const source of VERSIONED) {
    await cp(source, path.join(VERSION_DIR, source), { recursive: true });
  }
  // Same shape as MySQL's DATETIME on the site.
  const savedAt = new Date().toLocaleString('sv-SE').replace('T', ' ');
  await writeFile(path.join(VERSION_DIR, 'saved-at'), savedAt);
  return savedAt;
}

async function restoreVersion(): Promise<void> {
  for (const target of VERSIONED) {
    const saved = path.join(VERSION_DIR, target);
    if ((await stat(saved)).isDirectory()) {
      // Files added since the version was saved go too.
      await rm(target, { recursive: true, force: true });
    }
    await cp(saved, target, { recursive: true });
  }
}

type Item = { id: string; [key: string]: unknown };

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(CONTENT_DIR, file), 'utf8')) as T;
}

// Formatted like the rest of the repo, so a saved edit shows up as a small diff.
async function writeJson(file: string, data: unknown): Promise<void> {
  const target = path.join(CONTENT_DIR, file);
  const options = await resolveConfig(target);
  await writeFile(target, await format(JSON.stringify(data), { ...options, filepath: target }));
}

// Fields stay where they were in the file; cleared optional fields drop out, new ones go last.
function keepKeyOrder(previous: Item, next: Item): Item {
  const ordered: Record<string, unknown> = {};
  for (const key of Object.keys(previous)) {
    if (key in next) {
      ordered[key] = next[key];
    }
  }
  return { ...ordered, ...next } as Item;
}

const LANGUAGES = ['ru', 'en'];
const ID_PREFIXES: Record<string, string> = { experience: 'exp', education: 'edu', certificates: 'cert' };

async function saveTags(id: string, technologies: string[] | undefined): Promise<void> {
  // Experience tags live in one file for both languages, keyed by item id.
  const tags = await readJson<Record<string, string[]>>('technologies.json');
  if (technologies?.length) {
    tags[id] = technologies;
  } else {
    delete tags[id];
  }
  await writeJson('technologies.json', tags);
}

async function save(lang: string, section: string, id: string | undefined, data: unknown): Promise<void> {
  if (section === 'skills') {
    await writeJson(`${lang}/skills.json`, data);
    return;
  }
  if (section === 'profile') {
    const file = `${lang}/profile.json`;
    await writeJson(file, keepKeyOrder(await readJson<Item>(file), data as Item));
    return;
  }

  const { technologies, ...item } = data as Item & { technologies?: string[] };

  if (!id) {
    // A new item goes to the top, in both languages: the other one is translated afterwards.
    const newId = `${ID_PREFIXES[section]}-${Date.now().toString(36)}`;
    for (const itemLang of LANGUAGES) {
      const file = `${itemLang}/${section}.json`;
      await writeJson(file, [{ ...item, id: newId }, ...(await readJson<Item[]>(file))]);
    }
    if (section === 'experience') {
      await saveTags(newId, technologies);
    }
    return;
  }

  const file = `${lang}/${section}.json`;
  const items = await readJson<Item[]>(file);
  const index = items.findIndex((existing) => existing.id === id);
  if (index === -1) {
    throw new Error('id');
  }
  items[index] = keepKeyOrder(items[index], { ...item, id });
  await writeJson(file, items);
  if (section === 'experience') {
    await saveTags(id, technologies);
  }
}

async function remove(section: string, id: string | undefined): Promise<void> {
  for (const lang of LANGUAGES) {
    const file = `${lang}/${section}.json`;
    await writeJson(
      file,
      (await readJson<Item[]>(file)).filter((item) => item.id !== id),
    );
  }
  if (section === 'experience' && id) {
    await saveTags(id, undefined);
  }
}

// In `yarn dev` the editor saves into the JSON files of the project instead of the live database.
// Vite then reloads the page with the new content. Left out when VITE_RESUME_SOURCE=api.
export function resumeDevApi(): Plugin {
  return {
    name: 'resume-dev-api',
    apply: 'serve',
    configureServer(server) {
      if (process.env.VITE_RESUME_SOURCE === 'api' || server.config.env.VITE_RESUME_SOURCE === 'api') {
        return;
      }
      server.middlewares.use('/api/versions.php', async (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        if (req.method === 'GET') {
          res.end(JSON.stringify({ latest: await versionDate() }));
          return;
        }
        let body = '';
        for await (const chunk of req) {
          body += chunk;
        }
        const { action } = JSON.parse(body || '{}') as { action?: string };
        if (action === 'save') {
          res.end(JSON.stringify({ ok: true, latest: await saveVersion() }));
        } else if (action === 'restore' && (await versionDate())) {
          await restoreVersion();
          res.end(JSON.stringify({ ok: true, latest: await versionDate() }));
        } else {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, error: 'no_versions' }));
        }
      });

      // The photo from the editor replaces the one built into the project (it's already a small JPEG).
      server.middlewares.use('/api/photo.php', async (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk as Buffer);
        }
        const image = Buffer.concat(chunks);
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        const params = new URL(req.url ?? '', 'http://localhost').searchParams;

        // Certificate scans: listed in certificatePhotos.json, files next to the ones built into the site.
        if (params.get('delete') === 'certificate') {
          const { id, src } = JSON.parse(image.toString()) as { id: string; src: string };
          const photos = await readJson<Record<string, Photo[]>>('certificatePhotos.json');
          photos[id] = (photos[id] ?? []).filter((photo) => photo.src !== src);
          if (!photos[id].length) {
            delete photos[id];
          }
          await writeJson('certificatePhotos.json', photos);
          if (!Object.values(photos).some((list) => list.some((photo) => photo.src === src))) {
            await rm(path.join(CERTIFICATES_DIR, path.basename(src)), { force: true });
          }
          res.end(JSON.stringify({ ok: true }));
          return;
        }
        // A JPEG starts with FF D8 FF.
        if (image.length === 0 || image.length > 5 * 1024 * 1024 || image.readUIntBE(0, 3) !== 0xffd8ff) {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, error: 'invalid_field', field: 'photo' }));
          return;
        }
        if (params.get('for') === 'certificate') {
          const id = params.get('id') ?? '';
          if (!/^[\w-]{1,64}$/.test(id)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: 'invalid_field', field: 'id' }));
            return;
          }
          const name = `${id}-${Date.now().toString(36)}.jpg`;
          await writeFile(path.join(CERTIFICATES_DIR, name), image);
          const photos = await readJson<Record<string, Photo[]>>('certificatePhotos.json');
          photos[id] = [...(photos[id] ?? []), { src: name, lang: params.get('lang') ?? 'ru' }];
          await writeJson('certificatePhotos.json', photos);
          res.end(JSON.stringify({ ok: true }));
          return;
        }
        await writeFile(PHOTO_FILE, image);
        res.end(JSON.stringify({ ok: true }));
      });

      server.middlewares.use('/api/resume.php', async (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }
        let body = '';
        for await (const chunk of req) {
          body += chunk;
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
          const {
            lang,
            section,
            id,
            data,
            delete: shouldDelete,
          } = JSON.parse(body) as {
            lang: string;
            section: string;
            id?: string;
            data: unknown;
            delete?: boolean;
          };
          if (
            !['ru', 'en'].includes(lang) ||
            !['profile', 'skills', 'experience', 'education', 'certificates'].includes(section)
          ) {
            throw new Error('section');
          }
          if (shouldDelete) {
            await remove(section, id);
          } else {
            await save(lang, section, id, data);
          }
          res.end(JSON.stringify({ ok: true }));
        } catch (error) {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, error: 'invalid_field', field: (error as Error).message }));
        }
      });
    },
  };
}
