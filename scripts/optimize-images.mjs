import sharp from 'sharp';
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outRoot = path.join(root, 'public/optimized');
const jobs = [];

function even(value) {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

async function newer(source, target) {
  try {
    const [left, right] = await Promise.all([stat(source), stat(target)]);
    return right.mtimeMs >= left.mtimeMs && right.size > 0;
  } catch {
    return false;
  }
}

function queue(source, width, height, ext) {
  const relative = path.relative(path.join(root, 'public'), source).replaceAll('\\', '/');
  const stem = relative.replace(/\.[a-z0-9]+$/i, '');
  jobs.push({
    source,
    target: path.join(outRoot, `${stem}-${width}.${ext}`),
    width,
    height,
    ext,
  });
}

async function addFile(source, widths, formats) {
  const meta = await sharp(source).metadata();
  if (!meta.width || !meta.height) throw new Error(`Keine Abmessungen: ${source}`);
  const usable = [...new Set(widths.map((width) => Math.min(width, meta.width)).map(even))].filter((width) => width >= 16);
  for (const width of usable) {
    const height = even(meta.height * (width / meta.width));
    for (const ext of formats) queue(source, width, height, ext);
  }
}

async function collect(directory, widths, formats) {
  let names = [];
  try {
    names = await readdir(directory);
  } catch {
    return;
  }
  for (const name of names) {
    if (!/\.(jpe?g|png)$/i.test(name) || name.includes('original')) continue;
    const source = path.join(directory, name);
    const info = await stat(source);
    if (!info.isFile()) continue;
    const isJpeg = /\.jpe?g$/i.test(name);
    await addFile(source, widths, isJpeg ? formats : formats.filter((ext) => ext !== 'avif'));
  }
}

async function encode(job) {
  if (await newer(job.source, job.target)) return;
  await mkdir(path.dirname(job.target), { recursive: true });
  let pipeline = sharp(job.source).resize(job.width, job.height, { fit: 'fill' });
  pipeline = job.ext === 'webp'
    ? pipeline.webp({ quality: 72, alphaQuality: 80 })
    : pipeline.avif({ quality: 45, effort: 4 });
  await pipeline.toFile(job.target);
}

async function pool(items, limit, fn) {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      await fn(items[current]);
    }
  }
  const size = Math.min(limit, items.length);
  if (size > 0) await Promise.all(Array.from({ length: size }, worker));
}

await collect(path.join(root, 'public/media'), [480, 768, 1280], ['avif', 'webp']);
await collect(path.join(root, 'public/brand'), [64, 128, 256], ['avif', 'webp']);
await collect(path.join(root, 'public/brand/channels'), [64, 128, 256], ['webp']);
await collect(path.join(root, 'public/images'), [960, 1600], ['avif', 'webp']);

let done = 0;
await pool(jobs, 4, async (job) => {
  await encode(job);
  done += 1;
  if (done % 20 === 0 || done === jobs.length) console.log(`Bilder ${done}/${jobs.length}`);
});
console.log(`Optimierte Bilder: ${jobs.length}`);
