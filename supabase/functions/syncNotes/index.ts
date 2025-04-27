import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as b64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const githubToken  = Deno.env.get("GITHUB_TOKEN")!;
const notesRepo    = Deno.env.get("NOTES_REPO")!;          // simondcohen/notes-public

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession:false } });

/* ---------- helpers ---------- */

// get { path → sha } for all files in the repo
async function listRepoFiles() {
  const treeURL = `https://api.github.com/repos/${notesRepo}/git/trees/HEAD?recursive=1`;
  const res = await fetch(treeURL, { headers:{ Authorization:`token ${githubToken}` } });
  if (!res.ok) throw new Error("Cannot list repo files");
  const json:any = await res.json();
  const map = new Map<string,string>();
  for (const item of json.tree) if (item.type==="blob") map.set(item.path, item.sha);
  return map;
}

// create or update one file (skip if identical)
async function upsertFile(path:string, content:string) {
  const url = `https://api.github.com/repos/${notesRepo}/contents/${path}`;

  // peek for existing
  let sha:string|undefined;
  const peek = await fetch(url, { headers:{ Authorization:`token ${githubToken}` } });
  if (peek.ok) {
    const j:any = await peek.json();
    sha = j.sha;
    const existing = atob(j.content.replace(/\n/g,""));
    if (existing === content) return;                 // no change
  }

  // put
  await fetch(url,{
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

// delete a file by path + sha
async function deleteFile(path:string, sha:string){
  const url = `https://api.github.com/repos/${notesRepo}/contents/${path}`;
  await fetch(url,{
    method:"DELETE",
    headers:{ Authorization:`token ${githubToken}`, "Content-Type":"application/json" },
    body:JSON.stringify({ message:`remove ${path}`, sha })
  });
}

/* ---------- function entry ---------- */

serve(async () => {
  // 1 · fetch live notes
  const { data: notes, error } = await supabase.from("notes").select("*");
  if (error) return new Response(error.message,{ status:500 });

  // 2 · sync adds & updates
  const current = new Set<string>();
  for (const n of notes){
    const front = [
      "---",
      `id: "${n.id}"`,
      `title: "${n.title}"`,
      `updated: "${n.updated_at}"`,
      n.tags ? `tags: [${n.tags.map((t:string)=>`"${t}"`).join(", ")}]` : "",
      "---",
      "",
    ].join("\n");
    const md = front + (n.content || "");
    const path = `${n.id}.md`;
    await upsertFile(path, md);
    current.add(path);
  }

  // 3 · prune deletions
  const repoFiles = await listRepoFiles();
  for (const [path, sha] of repoFiles){
    if (path.endsWith(".md") && !current.has(path)) await deleteFile(path, sha);
  }

  return new Response("mirror complete",{ status:200 });
});
