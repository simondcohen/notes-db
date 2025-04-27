
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as b64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const githubToken = Deno.env.get("GITHUB_TOKEN")!;
const notesRepo   = Deno.env.get("NOTES_REPO")!;          // simondcohen/notes-public

const supabase = createClient(supabaseUrl, serviceKey, { auth:{ persistSession:false } });

/* ---------- helpers ---------- */

// full tree → Map<path, sha>
async function listRepo() {
  const r = await fetch(`https://api.github.com/repos/${notesRepo}/git/trees/HEAD?recursive=1`,
                        { headers:{ Authorization:`token ${githubToken}` } });
  const j:any = await r.json();
  const m = new Map<string,string>();
  for (const i of j.tree) if (i.type==="blob") m.set(i.path, i.sha);
  return m;
}

// upsert, supplying sha when required
async function upsert(path:string, content:string, sha?:string) {
  await fetch(`https://api.github.com/repos/${notesRepo}/contents/${path}`, {
    method:"PUT",
    headers:{ Authorization:`token ${githubToken}`, "Content-Type":"application/json" },
    body:JSON.stringify({
      message:`sync ${path}`,
      content:b64(new TextEncoder().encode(content)),
      encoding:"base64",
      sha
    })
  });
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
  // 1 · live notes
  const { data: notes, error } = await supabase.from("notes").select("*");
  if (error) return new Response(error.message, { status:500 });

  // 2 · repo snapshot
  const repo = await listRepo();
  const stillAlive = new Set<string>();

  // 3 · upsert each note
  for (const n of notes) {
    const front = [
      "---",
      `id: "${n.id}"`,
      `title: "${n.title}"`,
      `updated: "${n.updated_at}"`,
      n.tags ? `tags: [${n.tags.map((t:string)=>`"${t}"`).join(", ")}]` : "",
      "---\n"
    ].join("\n");
    const body  = '# ' + (n.title || 'Untitled') + '\n\n' + (n.content || "");
    const path  = `${n.id}.md`;
    const sha   = repo.get(path);            // undefined if new
    stillAlive.add(path);

    // skip if identical
    if (sha) {
      const peek = await fetch(`https://raw.githubusercontent.com/${notesRepo}/main/${path}`);
      if (peek.ok && await peek.text() === front + body) continue;
    }
    await upsert(path, front + body, sha);
  }

  // 4 · prune deletions
  for (const [path, sha] of repo) {
    if (path.endsWith(".md") && !stillAlive.has(path)) await remove(path, sha);
  }

  return new Response("mirror complete", { status:200 });
});