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
      let value = valueParts.join(':').trim();
      // Strip surrounding quotes (both single and double)
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }
      frontmatter[key.trim()] = value;
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
      
      // We need ID to check for existing notes, but we'll add new notes without ID
      if (!frontmatter.id) {
        // Create new note without an ID
        try {
          // Parse the file path to get notebook/section/item info
          const pathParts = filePath.split('/').filter(Boolean);
          
          // If path has fewer than 3 levels, create note in "Imported" notebook
          if (pathParts.length < 3) {
            await createNoteInImportedNotebook(userId, frontmatter.title, body);
            addedCount++;
            continue;
          }
          
          // Continue with creating note in proper location
          // Extract notebook, section, and item titles from path
          const notebookTitle = pathParts[0].replace(/_/g, ' ');
          const sectionTitle = pathParts[1].replace(/_/g, ' ');
          const itemTitle = pathParts[2].replace(/_/g, ' ');
          
          // Find or create notebook
          const { data: notebookData } = await supabase
            .from('notebooks')
            .select('id')
            .eq('user_id', userId)
            .eq('title', notebookTitle);
            
          let notebookId;
          
          if (notebookData && notebookData.length > 0) {
            notebookId = notebookData[0].id;
          } else {
            const { data: newNotebook, error: notebookError } = await supabase
              .from('notebooks')
              .insert({
                title: notebookTitle,
                user_id: userId
              })
              .select('id')
              .single();
              
            if (notebookError) throw notebookError;
            notebookId = newNotebook.id;
          }
          
          // Find or create section
          const { data: sectionData } = await supabase
            .from('sections')
            .select('id, position')
            .eq('notebook_id', notebookId)
            .eq('title', sectionTitle);
            
          let sectionId;
          
          if (sectionData && sectionData.length > 0) {
            sectionId = sectionData[0].id;
          } else {
            // Get the highest position
            const { data: highestPosSection } = await supabase
              .from('sections')
              .select('position')
              .eq('notebook_id', notebookId)
              .order('position', { ascending: false })
              .limit(1);
              
            const position = (highestPosSection?.[0]?.position ?? -1) + 1;
            
            const { data: newSection, error: sectionError } = await supabase
              .from('sections')
              .insert({
                title: sectionTitle,
                notebook_id: notebookId,
                position,
                user_id: userId
              })
              .select('id')
              .single();
              
            if (sectionError) throw sectionError;
            sectionId = newSection.id;
          }
          
          // Find or create item
          const { data: itemData } = await supabase
            .from('items')
            .select('id')
            .eq('section_id', sectionId)
            .eq('title', itemTitle);
            
          let itemId;
          
          if (itemData && itemData.length > 0) {
            itemId = itemData[0].id;
          } else {
            // Get the highest position
            const { data: highestPosItem } = await supabase
              .from('items')
              .select('position')
              .eq('section_id', sectionId)
              .order('position', { ascending: false })
              .limit(1);
              
            const position = (highestPosItem?.[0]?.position ?? -1) + 1;
            
            const { data: newItem, error: itemError } = await supabase
              .from('items')
              .insert({
                title: itemTitle,
                section_id: sectionId,
                position
              })
              .select('id')
              .single();
              
            if (itemError) throw itemError;
            itemId = newItem.id;
          }
          
          // Create the note
          const { error: noteError } = await supabase
            .from('notes')
            .insert({
              title: frontmatter.title,
              item_id: itemId,
              content: body
            });
            
          if (noteError) throw noteError;
          addedCount++;
        } catch (error) {
          console.error(`Error creating note from ${filePath}:`, error);
        }
      } else {
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
          // Note with ID not found, create it as a new note
          try {
            // Parse the file path to get notebook/section/item info
            const pathParts = filePath.split('/').filter(Boolean);
            
            // If path has fewer than 3 levels, create note in "Imported" notebook
            if (pathParts.length < 3) {
              await createNoteInImportedNotebook(userId, frontmatter.title, body);
              addedCount++;
              continue;
            }
            
            // Extract notebook, section, and item titles from path
            const notebookTitle = pathParts[0].replace(/_/g, ' ');
            const sectionTitle = pathParts[1].replace(/_/g, ' ');
            const itemTitle = pathParts[2].replace(/_/g, ' ');
            
            // Find or create notebook
            const { data: notebookData } = await supabase
              .from('notebooks')
              .select('id')
              .eq('user_id', userId)
              .eq('title', notebookTitle);
              
            let notebookId;
            
            if (notebookData && notebookData.length > 0) {
              notebookId = notebookData[0].id;
            } else {
              const { data: newNotebook, error: notebookError } = await supabase
                .from('notebooks')
                .insert({
                  title: notebookTitle,
                  user_id: userId
                })
                .select('id')
                .single();
                
              if (notebookError) throw notebookError;
              notebookId = newNotebook.id;
            }
            
            // Find or create section
            const { data: sectionData } = await supabase
              .from('sections')
              .select('id, position')
              .eq('notebook_id', notebookId)
              .eq('title', sectionTitle);
              
            let sectionId;
            
            if (sectionData && sectionData.length > 0) {
              sectionId = sectionData[0].id;
            } else {
              // Get the highest position
              const { data: highestPosSection } = await supabase
                .from('sections')
                .select('position')
                .eq('notebook_id', notebookId)
                .order('position', { ascending: false })
                .limit(1);
                
              const position = (highestPosSection?.[0]?.position ?? -1) + 1;
              
              const { data: newSection, error: sectionError } = await supabase
                .from('sections')
                .insert({
                  title: sectionTitle,
                  notebook_id: notebookId,
                  position,
                  user_id: userId
                })
                .select('id')
                .single();
                
              if (sectionError) throw sectionError;
              sectionId = newSection.id;
            }
            
            // Find or create item
            const { data: itemData } = await supabase
              .from('items')
              .select('id')
              .eq('section_id', sectionId)
              .eq('title', itemTitle);
              
            let itemId;
            
            if (itemData && itemData.length > 0) {
              itemId = itemData[0].id;
            } else {
              // Get the highest position
              const { data: highestPosItem } = await supabase
                .from('items')
                .select('position')
                .eq('section_id', sectionId)
                .order('position', { ascending: false })
                .limit(1);
                
              const position = (highestPosItem?.[0]?.position ?? -1) + 1;
              
              const { data: newItem, error: itemError } = await supabase
                .from('items')
                .insert({
                  title: itemTitle,
                  section_id: sectionId,
                  position
                })
                .select('id')
                .single();
                
              if (itemError) throw itemError;
              itemId = newItem.id;
            }
            
            // Create the note
            const { error: noteError } = await supabase
              .from('notes')
              .insert({
                id: frontmatter.id, // Use the ID from the frontmatter
                title: frontmatter.title,
                item_id: itemId,
                content: body
              });
              
            if (noteError) throw noteError;
            addedCount++;
          } catch (error) {
            console.error(`Error creating note from ${filePath}:`, error);
          }
        }
      }
    }
    
    return { updated: updatedCount, added: addedCount };
  } catch (error) {
    console.error('Error importing from zip:', error);
    throw error;
  }
}

// Helper function to create a note in the "Imported" notebook when path is missing levels
async function createNoteInImportedNotebook(userId: string, noteTitle: string, noteContent: string) {
  try {
    // Find or create "Imported" notebook
    const { data: notebookData } = await supabase
      .from('notebooks')
      .select('id')
      .eq('user_id', userId)
      .eq('title', 'Imported');
      
    let notebookId;
    
    if (notebookData && notebookData.length > 0) {
      notebookId = notebookData[0].id;
    } else {
      const { data: newNotebook, error: notebookError } = await supabase
        .from('notebooks')
        .insert({
          title: 'Imported',
          user_id: userId
        })
        .select('id')
        .single();
        
      if (notebookError) throw notebookError;
      notebookId = newNotebook.id;
    }
    
    // Find or create default section
    const { data: sectionData } = await supabase
      .from('sections')
      .select('id')
      .eq('notebook_id', notebookId)
      .eq('title', 'Imported Notes');
      
    let sectionId;
    
    if (sectionData && sectionData.length > 0) {
      sectionId = sectionData[0].id;
    } else {
      const { data: newSection, error: sectionError } = await supabase
        .from('sections')
        .insert({
          title: 'Imported Notes',
          notebook_id: notebookId,
          position: 0,
          user_id: userId
        })
        .select('id')
        .single();
        
      if (sectionError) throw sectionError;
      sectionId = newSection.id;
    }
    
    // Find or create default item
    const { data: itemData } = await supabase
      .from('items')
      .select('id')
      .eq('section_id', sectionId)
      .eq('title', 'Imported Items');
      
    let itemId;
    
    if (itemData && itemData.length > 0) {
      itemId = itemData[0].id;
    } else {
      const { data: newItem, error: itemError } = await supabase
        .from('items')
        .insert({
          title: 'Imported Items',
          section_id: sectionId,
          position: 0
        })
        .select('id')
        .single();
        
      if (itemError) throw itemError;
      itemId = newItem.id;
    }
    
    // Create the note
    const { error: noteError } = await supabase
      .from('notes')
      .insert({
        title: noteTitle,
        item_id: itemId,
        content: noteContent
      });
      
    if (noteError) throw noteError;
    
    return true;
  } catch (error) {
    console.error('Error creating note in Imported notebook:', error);
    throw error;
  }
} 