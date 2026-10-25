import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

const logo = `<a class="logo" href="/"><svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="20" r="13" fill="#F2B66B"></circle><ellipse cx="7" cy="12" rx="5" ry="8" fill="#8A5A34" transform="rotate(-20 7 12)"></ellipse><ellipse cx="29" cy="12" rx="5" ry="8" fill="#8A5A34" transform="rotate(20 29 12)"></ellipse><circle cx="13" cy="19" r="2.4" fill="#2B2118"></circle><circle cx="23" cy="19" r="2.4" fill="#2B2118"></circle><ellipse cx="18" cy="25" rx="3" ry="2.2" fill="#2B2118"></ellipse></svg>Boop Boop</a>`;

function pageHtml({ title, bodyHtml }) {
  const safeTitle = escapeHtml(title);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle} · Boop Boop</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito+Sans:wght@400;600;700&display=swap">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="legal-bar">${logo}</header>
  <main class="prose">
    <h1>${safeTitle}</h1>
    ${bodyHtml}
  </main>
</body>
</html>
`;
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await copyFile(path.join(root, "styles.css"), path.join(dist, "styles.css"));
await copyFile(path.join(root, "..", "assets", "icon.png"), path.join(dist, "icon.png"));
await copyFile(path.join(root, "home.html"), path.join(dist, "index.html"));
await mkdir(path.join(dist, "get"), { recursive: true });
await copyFile(path.join(root, "get.html"), path.join(dist, "get", "index.html"));
await mkdir(path.join(dist, ".well-known"), { recursive: true });
await copyFile(
  path.join(root, "well-known", "apple-app-site-association"),
  path.join(dist, ".well-known", "apple-app-site-association"),
);

for (const page of pages) {
  const markdown = await readFile(path.join(docsDir, page.file), "utf8");
  const { title, body } = splitTitle(markdown);
  const bodyHtml = marked.parse(body);
  const dir = path.join(dist, page.route);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), pageHtml({ title, bodyHtml }));
}
