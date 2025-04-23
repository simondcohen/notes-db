import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { supabase } from '../lib/supabase';
import { Note, Notebook, Section, Item } from '../types';
import { format } from 'date-fns';

// Helper to format date as ISO string
const formatDate = (date: Date): string => {
  return date.toISOString();
};

// Create a slug from a string (lowercase + underscores)
const createSlug = (text: string): string => {
  return text.toLowerCase().replace(/\s+/g, '_');
};

// Convert a note to markdown with YAML frontmatter
const noteToMarkdown = (note: Note): string => {
  const frontmatter = [
    '---',
    `id: ${note.id}`,
    `title: ${note.title}`,
    `created: ${formatDate(new Date())}`, // We'd need the created date from the DB
    `updated: ${formatDate(note.lastModified || new Date())}`,
    note.tags && note.tags.length > 0 ? `tags: [${note.tags.map(tag => `"${tag.name}"`).join(', ')}]` : '',
    '---',
    '',
    note.content
  ].filter(Boolean).join('\n');

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
    const filename = `notebook_${notebook.title.toLowerCase().replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.zip`;
    saveAs(zipBlob, filename);
    
    return { success: true };
  } catch (error) {
    console.error('Error exporting as zip:', error);
    throw error;
  }
}

// Parse YAML frontmatter from markdown content
const parseMarkdownFrontmatter = (content: string): { frontmatter: Record<string, string>, body: string, tags: string[] } => {
  const frontmatterRegex = /^---\n((?:.|\n)*?)\n---\n((?:.|\n)*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { frontmatter: {}, body: content, tags: [] };
  }
  
  const frontmatterStr = match[1];
  const body = match[2];
  
  // Parse YAML frontmatter
  const frontmatter: Record<string, string> = {};
  const lines = frontmatterStr.split('\n');
  let tags: string[] = [];
  
  // First pass to extract direct tags
  for (const line of lines) {
    if (line.trim().startsWith('tags:')) {
      const tagsMatch = line.match(/tags:\s*\[(.*)\]/);
      if (tagsMatch && tagsMatch[1]) {
        tags = parseTags(tagsMatch[1]);
      }
    }
    
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
  
  // Look for tags in metadata if not directly found
  if (tags.length === 0 && frontmatter.metadata) {
    try {
      const metadataStr = frontmatter.metadata;
      if (metadataStr.includes('tags:')) {
        const tagsMatch = metadataStr.match(/tags:\s*\[(.*)\]/);
        if (tagsMatch && tagsMatch[1]) {
          tags = parseTags(tagsMatch[1]);
        }
      }
    } catch (error) {
      console.error('Error parsing metadata tags:', error);
    }
  }
  
  return { frontmatter, body, tags };
};

// Helper to parse tag strings from a YAML array
const parseTags = (tagsStr: string): string[] => {
  // Handle quoted strings with commas
  const tags: string[] = [];
  let currentTag = '';
  let inQuotes = false;
  let quoteChar = '';
  
  for (let i = 0; i < tagsStr.length; i++) {
    const char = tagsStr[i];
    
    if ((char === '"' || char === "'") && (i === 0 || tagsStr[i-1] !== '\\')) {
      if (!inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar) {
        inQuotes = false;
        if (currentTag.trim()) {
          tags.push(currentTag.trim());
          currentTag = '';
        }
      } else {
        currentTag += char;
      }
    } else if (char === ',' && !inQuotes) {
      if (currentTag.trim()) {
        tags.push(currentTag.trim());
        currentTag = '';
      }
    } else {
      currentTag += char;
    }
  }
  
  if (currentTag.trim()) {
    tags.push(currentTag.trim());
  }
  
  // Clean up quotes and spaces
  return tags.map(tag => {
    tag = tag.trim();
    if ((tag.startsWith('"') && tag.endsWith('"')) || 
        (tag.startsWith("'") && tag.endsWith("'"))) {
      tag = tag.substring(1, tag.length - 1);
    }
    return tag;
  });
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
      const { frontmatter, body, tags } = parseMarkdownFrontmatter(fileContent);
      
      // Process tags first - upsert tags and get IDs
      const tagIds = await processNoteTags(userId, tags);
      
      // We need ID to check for existing notes, but we'll add new notes without ID
      if (!frontmatter.id) {
        // Create new note without an ID
        try {
          // Parse the file path to get notebook/section/item info
          const pathParts = filePath.split('/').filter(Boolean);
          
          // If path has fewer than 3 levels, create note in "Imported" notebook
          if (pathParts.length < 3) {
            await createNoteInImportedNotebook(userId, frontmatter.title, body, tagIds);
            addedCount++;
            continue;
          }
          
          // Continue with creating note in proper location
          // Extract notebook, section, and item titles from path
          const notebookTitle = pathParts[0].replace(/_/g, ' ');
          const notebookSlug = createSlug(notebookTitle);
          const sectionTitle = pathParts[1].replace(/_/g, ' ');
          const sectionSlug = createSlug(sectionTitle);
          const itemTitle = pathParts[2].replace(/_/g, ' ');
          const itemSlug = createSlug(itemTitle);
          
          // Find or create notebook
          const { data: notebookData } = await supabase
            .from('notebooks')
            .select('id')
            .eq('user_id', userId)
            .eq('slug', notebookSlug);
            
          let notebookId;
          
          if (notebookData && notebookData.length > 0) {
            notebookId = notebookData[0].id;
          } else {
            const { data: newNotebook, error: notebookError } = await supabase
              .from('notebooks')
              .insert({
                title: notebookTitle,
                slug: notebookSlug,
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
            .eq('slug', sectionSlug);
            
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
                slug: sectionSlug,
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
            .eq('slug', itemSlug);
            
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
                slug: itemSlug,
                section_id: sectionId,
                position
              })
              .select('id')
              .single();
              
            if (itemError) throw itemError;
            itemId = newItem.id;
          }
          
          // Create the note
          const { data: noteData, error: noteError } = await supabase
            .from('notes')
            .insert({
              title: frontmatter.title,
              item_id: itemId,
              content: body
            })
            .select('id')
            .single();
            
          if (noteError) throw noteError;
          
          // Link tags to the note
          if (tagIds.length > 0 && noteData) {
            await linkNoteTags(noteData.id, tagIds);
          }
          
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
            // Update tags for the note
            try {
              // First, remove existing tags
              await supabase
                .from('note_tags')
                .delete()
                .eq('note_id', frontmatter.id);
                
              // Then link the new tags
              if (tagIds.length > 0) {
                await linkNoteTags(frontmatter.id, tagIds);
              }
            } catch (tagError) {
              console.error(`Error updating tags for note ${frontmatter.id}:`, tagError);
            }
            
            updatedCount++;
          }
        } else {
          // Note with ID not found, create it as a new note
          try {
            // Parse the file path to get notebook/section/item info
            const pathParts = filePath.split('/').filter(Boolean);
            
            // If path has fewer than 3 levels, create note in "Imported" notebook
            if (pathParts.length < 3) {
              await createNoteInImportedNotebook(userId, frontmatter.title, body, tagIds, frontmatter.id);
              addedCount++;
              continue;
            }
            
            // Extract notebook, section, and item titles from path
            const notebookTitle = pathParts[0].replace(/_/g, ' ');
            const notebookSlug = createSlug(notebookTitle);
            const sectionTitle = pathParts[1].replace(/_/g, ' ');
            const sectionSlug = createSlug(sectionTitle);
            const itemTitle = pathParts[2].replace(/_/g, ' ');
            const itemSlug = createSlug(itemTitle);
            
            // Find or create notebook
            const { data: notebookData } = await supabase
              .from('notebooks')
              .select('id')
              .eq('user_id', userId)
              .eq('slug', notebookSlug);
              
            let notebookId;
            
            if (notebookData && notebookData.length > 0) {
              notebookId = notebookData[0].id;
            } else {
              const { data: newNotebook, error: notebookError } = await supabase
                .from('notebooks')
                .insert({
                  title: notebookTitle,
                  slug: notebookSlug,
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
              .eq('slug', sectionSlug);
              
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
                  slug: sectionSlug,
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
              .eq('slug', itemSlug);
              
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
                  slug: itemSlug,
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
            
            // Link tags to the note
            if (tagIds.length > 0) {
              await linkNoteTags(frontmatter.id, tagIds);
            }
            
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

// Helper function to process tags for a note
async function processNoteTags(userId: string, tags: string[]): Promise<string[]> {
  if (!tags || tags.length === 0) return [];
  
  const tagIds: string[] = [];
  
  for (const tagName of tags) {
    if (!tagName.trim()) continue;
    
    try {
      const tagSlug = createSlug(tagName);
      
      // Upsert the tag
      const { data, error } = await supabase
        .rpc('upsert_tag', {
          p_name: tagName,
          p_slug: tagSlug,
          p_user_id: userId
        });
      
      if (error) {
        console.error(`Error upserting tag ${tagName}:`, error);
        
        // Fallback method if RPC fails
        const { data: tagData, error: tagError } = await supabase
          .from('tags')
          .upsert({
            name: tagName,
            slug: tagSlug,
            user_id: userId
          }, {
            onConflict: 'slug,user_id'
          })
          .select('id')
          .single();
          
        if (tagError) {
          console.error(`Fallback tag upsert for ${tagName} failed:`, tagError);
          continue;
        }
        
        if (tagData) tagIds.push(tagData.id);
      } else if (data) {
        tagIds.push(data);
      }
    } catch (error) {
      console.error(`Error processing tag ${tagName}:`, error);
    }
  }
  
  return tagIds;
}

// Helper function to link tags to a note
async function linkNoteTags(noteId: string, tagIds: string[]): Promise<void> {
  if (!tagIds || tagIds.length === 0) return;
  
  try {
    const noteTagsToInsert = tagIds.map(tagId => ({
      note_id: noteId,
      tag_id: tagId
    }));
    
    const { error } = await supabase
      .from('note_tags')
      .insert(noteTagsToInsert);
      
    if (error) {
      console.error(`Error linking tags to note ${noteId}:`, error);
    }
  } catch (error) {
    console.error(`Error linking tags to note ${noteId}:`, error);
  }
}

// Helper function to create a note in the "Imported" notebook when path is missing levels
async function createNoteInImportedNotebook(
  userId: string, 
  noteTitle: string, 
  noteContent: string, 
  tagIds: string[] = [],
  noteId?: string
) {
  try {
    const importedNotebookSlug = 'imported';
    const importedSectionSlug = 'imported_notes';
    const importedItemSlug = 'imported_items';
    
    // Find or create "Imported" notebook
    const { data: notebookData } = await supabase
      .from('notebooks')
      .select('id')
      .eq('user_id', userId)
      .eq('slug', importedNotebookSlug);
      
    let notebookId;
    
    if (notebookData && notebookData.length > 0) {
      notebookId = notebookData[0].id;
    } else {
      const { data: newNotebook, error: notebookError } = await supabase
        .from('notebooks')
        .insert({
          title: 'Imported',
          slug: importedNotebookSlug,
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
      .eq('slug', importedSectionSlug);
      
    let sectionId;
    
    if (sectionData && sectionData.length > 0) {
      sectionId = sectionData[0].id;
    } else {
      const { data: newSection, error: sectionError } = await supabase
        .from('sections')
        .insert({
          title: 'Imported Notes',
          slug: importedSectionSlug,
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
      .eq('slug', importedItemSlug);
      
    let itemId;
    
    if (itemData && itemData.length > 0) {
      itemId = itemData[0].id;
    } else {
      const { data: newItem, error: itemError } = await supabase
        .from('items')
        .insert({
          title: 'Imported Items',
          slug: importedItemSlug,
          section_id: sectionId,
          position: 0
        })
        .select('id')
        .single();
        
      if (itemError) throw itemError;
      itemId = newItem.id;
    }
    
    // Create the note
    const noteInsert: any = {
      title: noteTitle,
      item_id: itemId,
      content: noteContent
    };
    
    // Add ID if provided
    if (noteId) {
      noteInsert.id = noteId;
    }
    
    const { data: noteData, error: noteError } = await supabase
      .from('notes')
      .insert(noteInsert)
      .select('id')
      .single();
      
    if (noteError) throw noteError;
    
    // Link tags to the note
    if (tagIds.length > 0 && noteData) {
      await linkNoteTags(noteData.id, tagIds);
    }
    
    return true;
  } catch (error) {
    console.error('Error creating note in Imported notebook:', error);
    throw error;
  }
} 