import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const root = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.join(root, "compliance-docs");
const dist = path.join(root, "dist");

const pages = [
  { file: "Privacy Policy.md", route: "privacypolicy" },
  { file: "Terms of Service.md", route: "termsofservice" },
  { file: "Community Guidelines.md", route: "communityguidelines" },
  { file: "Support.md", route: "support" },
  { file: "Delete account.md", route: "delete-account" },
];

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function splitTitle(markdown) {
  const lines = markdown.replace(/^\uFEFF/, "").split("\n");
  let index = 0;
  while (index < lines.length && lines[index].trim() === "") {
    index += 1;
  }
  const heading = lines[index]?.match(/^#{1,6}\s+(.+?)\s*$/);
  if (!heading) {
    return { title: "Boop Boop", body: markdown };
  }
  return {
    title: heading[1],
    body: lines.slice(index + 1).join("\n"),
  };
}

function pageHtml({ title, bodyHtml }) {
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle} · Boop Boop</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      font-family: Georgia, "Iowan Old Style", Palatino, serif;
      line-height: 1.55;
      color: #1c1917;
      background: #fafaf9;
    }
    main {
      max-width: 40rem;
      margin: 0 auto;
      padding: 1.5rem 1.25rem 3rem;
    }
    h1 { font-size: 1.75rem; line-height: 1.2; margin: 0 0 1rem; }
    h2 { font-size: 1.25rem; margin: 1.75rem 0 0.5rem; }
    h3 { font-size: 1.05rem; margin: 1.25rem 0 0.4rem; }
    a { color: #1d4ed8; }
    table { border-collapse: collapse; width: 100%; font-size: 0.95rem; }
    th, td { border: 1px solid #d6d3d1; padding: 0.4rem 0.5rem; text-align: left; vertical-align: top; }
  </style>
</head>
<body>
  <main>
    <h1>${safeTitle}</h1>
    ${bodyHtml}
  </main>
</body>
</html>
`;
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const built = [];
for (const page of pages) {
  const markdown = await readFile(path.join(docsDir, page.file), "utf8");
  const { title, body } = splitTitle(markdown);
  const bodyHtml = marked.parse(body);
  const dir = path.join(dist, page.route);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), pageHtml({ title, bodyHtml }));
  built.push({ title, route: page.route });
}

const links = built
  .map((page) => `<li><a href="/${page.route}">${escapeHtml(page.title)}</a></li>`)
  .join("\n");

await writeFile(
  path.join(dist, "index.html"),
  pageHtml({
    title: "Boop Boop",
    bodyHtml: `<ul>\n${links}\n</ul>`,
  }),
);
