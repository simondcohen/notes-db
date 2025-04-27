//trigger deploy

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as b64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const githubToken = Deno.env.get("GITHUB_TOKEN")!;
const notesRepo   = Deno.env.get("NOTES_REPO")!;          // simondcohen/notes-public

const supabase = createClient(supabaseUrl, serviceKey, { auth:{ persistSession:false } });

/* ---------- helpers ---------- */

// Slug helper: lowercase, replace non-alphanumerics with -, trim leading/trailing -
function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// full tree → Map<path, sha>
async function listRepo() {
  const r = await fetch(`https://api.github.com/repos/${notesRepo}/git/trees/HEAD?recursive=1`,
                        { headers:{ Authorization:`token ${githubToken}` } });
  const j:any = await r.json();
  const m = new Map<string,string>();
  const tree = Array.isArray(j.tree) ? j.tree : [];
  for (const i of tree) {
    if (i.type === "blob" && i.path.endsWith(".md")) {
      m.set(i.path, i.sha);
    }
  }
  return m;
}

// upsert, supplying sha when required
async function upsert(path: string, content: string, shaHint?: string) {
  const payloadBase = {
    message: `sync ${path}`,
    content: b64(new TextEncoder().encode(content)),
    encoding: "base64"
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    let sha = shaHint;

    // If we don't have a sha, ask GitHub; 404 means create
    if (!sha) {
      const probe = await fetch(
        `https://api.github.com/repos/${notesRepo}/contents/${path}`,
        { headers: { Authorization: `token ${githubToken}` } }
      );
      if (probe.ok) {
        const j: any = await probe.json();
        sha = j.sha;
      } else if (probe.status !== 404) {
        // non-404 probe error → retry on 5xx otherwise give up
        if (probe.status >= 500 && attempt < 3) { await new Promise(r => setTimeout(r, 1000)); continue; }
        const txt = await probe.text();
        console.error("GITHUB-PROBE", probe.status, txt);
        return; // skip this file
      }
    }

    const payload = sha ? { ...payloadBase, sha } : payloadBase;

    const res = await fetch(
      `https://api.github.com/repos/${notesRepo}/contents/${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${githubToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    if (res.ok) return;               // success

    // Retry logic
    if (res.status >= 500 && attempt < 3) {
      console.warn(`Retry ${attempt} for ${path} (status ${res.status})`);
      await new Promise(r => setTimeout(r, 1000 * attempt));
      continue;
    }

    if (res.status === 422 && attempt < 3) {
      // force a fresh sha next round
      console.warn(`422 for ${path} – fetching sha and retrying`);
      shaHint = undefined;
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }

    const txt = await res.text();
    console.error("GITHUB-ERROR", res.status, txt);
    return; // don't crash the whole sync
  }
}

// delete by sha
async function remove(path:string, sha:string) {
  await fetch(`https://api.github.com/repos/${notesRepo}/contents/${path}`, {
    method:"DELETE",
    headers:{ Authorization:`token ${githubToken}`, "Content-Type":"application/json" },
    body:JSON.stringify({ message:`remove ${path}`, sha })
  });
}

/* ---------- entry ---------- */

serve(async () => {
  // 1 · live notes with related data
  const { data: notes, error } = await supabase
    .from("notes")
    .select(`
      id, title, content, created_at, updated_at,
      items:item_id (
        id, title, slug,
        sections:section_id (
          id, title, slug,
          notebooks:notebook_id (
            id, title, slug
          )
        )
      ),
      note_tags(tag_id:tags(name))
    `);
  
  if (error) return new Response(error.message, { status:500 });

  // 2 · repo snapshot
  const repo = await listRepo();
  const stillAlive = new Set<string>();

  console.log("SYNC-DEBUG note count", notes.length);
  
  // 3 · upsert each note
  for (const note of notes) {
    // Build file path using slugs
    const item     = note.items;
    const section  = item?.sections;
    const notebook = section?.notebooks;
    
    if (!notebook || !section || !item) {
      console.log(
        "SKIP",
        note.id,
        !item && "no item",
        !section && "no section",
        !notebook && "no notebook"
      );
      continue;
    }
    
    const filePath = `${slug(notebook.title)}/${slug(section.title)}/${slug(item.title)}/${slug(note.title)}.md`;
    stillAlive.add(filePath);
    
    // Create tag list if any
    const tagList = note.note_tags?.map(t => `"${t.tag_id}"`).join(', ');
    
    // Build frontmatter
    const frontLines = [
      "---",
      `id: "${note.id}"`,
      `title: "${note.title}"`,
      `created: "${note.created_at}"`,
      `updated: "${note.updated_at}"`,
      note.note_tags?.length > 0 ? `tags: [${tagList}]` : null,
      `notebook: "${notebook.title}"`,
      `section: "${section.title}"`,
      `item: "${item.title}"`,
      "---"
    ].filter(Boolean);
    
    const yaml = frontLines.join('\n') + '\n\n';
    const body = note.content || '';
    const content = yaml + body;
    
    // Skip if identical
    const sha = repo.get(filePath);
    if (sha) {
      const peek = await fetch(`https://raw.githubusercontent.com/${notesRepo}/main/${filePath}`);
      if (peek.ok && await peek.text() === content) continue;
    }
    
    // Otherwise upsert
    await upsert(filePath, content, sha);
  }

  // 4 · prune deletions
  for (const [path, sha] of repo) {
    if (!stillAlive.has(path)) {
      await remove(path, sha);
    }
  }

  return new Response("mirror complete", { status:200 });
});