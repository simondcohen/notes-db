import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { supabase } from '../lib/supabase';
import { Note, Notebook, Section, Item } from '../types';
import { format } from 'date-fns';

// Helper to format date as ISO string
const formatDate = (date: Date): string => {
  return date.toISOString();
};

// Convert a note to markdown with YAML frontmatter
const noteToMarkdown = (note: Note): string => {
  const frontmatter = [
    '---',
    `id: ${note.id}`,
    `title: ${note.title}`,
    `created: ${formatDate(new Date())}`, // We'd need the created date from the DB
    `updated: ${formatDate(note.lastModified || new Date())}`,
    '---',
    '',
    note.content
  ].join('\n');

  return frontmatter;
};

// Type for database notebook
interface DbNotebook {
  id: string;
  title: string;
  last_modified: string;
  sections: DbSection[];
}

interface DbSection {
  id: string;
  title: string;
  position: number;
  items: DbItem[];
}

interface DbItem {
  id: string;
  title: string;
  position: number;
  notes: DbNote[];
}

interface DbNote {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  tags: { id: string; name: string }[];
}

// Get path for a note within the zip
const getNotePath = (notebook: DbNotebook, section: DbSection, item: DbItem, note: Note): string => {
  const notebookSlug = notebook.title.toLowerCase().replace(/\s+/g, '_');
  const sectionSlug = section.title.toLowerCase().replace(/\s+/g, '_');
  const itemSlug = item.title.toLowerCase().replace(/\s+/g, '_');
  
  return `${notebookSlug}/${sectionSlug}/${itemSlug}/${note.title.toLowerCase().replace(/\s+/g, '_')}.md`;
};

// Export notebook as a zip with markdown files
export async function exportAsZip(userId: string, notebookId: string) {
  try {
    // Fetch the notebook data
    const { data: notebooks, error } = await supabase
      .from('notebooks')
      .select(`
        id,
        title,
        last_modified,
        sections (
          id,
          title,
          position,
          items (
            id,
            title,
            position,
            notes (
              id,
              title,
              content,
              created_at,
              updated_at,
              tags!note_tags(
                id,
                name
              )
            )
          )
        )
      `)
      .eq('user_id', userId)
      .eq('id', notebookId)
      .order('last_modified', { ascending: false });

    if (error) throw error;
    if (!notebooks || notebooks.length === 0) throw new Error('Notebook not found');

    const notebook = notebooks[0] as DbNotebook;
    const zip = new JSZip();
    
    // Process each section, item, and note
    for (const section of notebook.sections || []) {
      for (const item of section.items || []) {
        for (const note of item.notes || []) {
          // Convert DB note to our Note type
          const noteObj: Note = {
            id: note.id,
            title: note.title,
            content: note.content,
            tags: note.tags?.map(tag => ({
              id: tag.id,
              name: tag.name
            })) || [],
            lastModified: new Date(note.updated_at)
          };
          
          // Add note to zip
          const notePath = getNotePath(notebook, section, item, noteObj);
          const noteContent = noteToMarkdown(noteObj);
          zip.file(notePath, noteContent);
        }
      }
    }

    // Generate and download the zip
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const filename = `notebook_${notebook.title.toLowerCase().replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.zip`;
    saveAs(zipBlob, filename);
    
    return { success: true };
  } catch (error) {
    console.error('Error exporting as zip:', error);
    throw error;
  }
}

// Parse YAML frontmatter from markdown content
const parseMarkdownFrontmatter = (content: string): { frontmatter: Record<string, string>, body: string } => {
  const frontmatterRegex = /^---\n((?:.|\n)*?)\n---\n((?:.|\n)*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  
  const frontmatterStr = match[1];
  const body = match[2];
  
  // Parse YAML frontmatter
  const frontmatter: Record<string, string> = {};
  const lines = frontmatterStr.split('\n');
  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      frontmatter[key.trim()] = valueParts.join(':').trim();
    }
  }
  
  return { frontmatter, body };
};

// Import notes from a zip file
export async function importFromZip(userId: string, file: File) {
  try {
    // Read the zip file
    const zip = new JSZip();
    const zipContents = await zip.loadAsync(file);
    
    // Get all markdown files
    const markdownFiles = Object.keys(zipContents.files).filter(path => path.endsWith('.md'));
    
    let updatedCount = 0;
    let addedCount = 0;
    
    // Process each markdown file
    for (const filePath of markdownFiles) {
      const fileContent = await zipContents.files[filePath].async('string');
      const { frontmatter, body } = parseMarkdownFrontmatter(fileContent);
      
      if (!frontmatter.id) {
        console.warn(`Skipping file ${filePath} - missing id in frontmatter`);
        continue;
      }
      
      // Check if note exists
      const { data: existingNotes, error: fetchError } = await supabase
        .from('notes')
        .select('id, item_id')
        .eq('id', frontmatter.id);
      
      if (fetchError) {
        console.error(`Error checking for existing note ${frontmatter.id}:`, fetchError);
        continue;
      }
      
      if (existingNotes && existingNotes.length > 0) {
        // Update existing note
        const { error: updateError } = await supabase
          .from('notes')
          .update({
            title: frontmatter.title,
            content: body,
            updated_at: new Date().toISOString()
          })
          .eq('id', frontmatter.id);
        
        if (updateError) {
          console.error(`Error updating note ${frontmatter.id}:`, updateError);
        } else {
          updatedCount++;
        }
      } else {
        // We would need to parse the file path to determine notebook, section, and item
        // For now, we'll skip adding notes that don't exist
        console.warn(`Note ${frontmatter.id} does not exist in the database. Skipping.`);
        // In a real implementation, we would:
        // 1. Parse the path to get notebook/section/item info
        // 2. Find or create the corresponding notebook, section, and item
        // 3. Add the note to that item
        // This would require more complex path parsing and DB operations
      }
    }
    
    return { updated: updatedCount, added: addedCount };
  } catch (error) {
    console.error('Error importing from zip:', error);
    throw error;
  }
} 