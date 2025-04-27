import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as b64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
const githubToken = Deno.env.get("GITHUB_TOKEN")!;
const notesRepo  = Deno.env.get("NOTES_REPO")!;   // simondcohen/notes-public

const supabase = createClient(supabaseUrl, supabaseAnon);

async function pushFile(path: string, content: string) {
  const url = `https://api.github.com/repos/${notesRepo}/contents/${path}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${githubToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: `sync ${path}`,
      content: b64(new TextEncoder().encode(content)),
      encoding: "base64",
    }),
  });
  if (!res.ok) console.error(await res.text());
}

serve(async () => {
  const { data: notes, error } = await supabase.from("notes").select("*");
  if (error) return new Response(error.message, { status: 500 });

  for (const n of notes) {
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
    await pushFile(`${n.id}.md`, md);
  }

  return new Response("notes synced", { status: 200 });
});
