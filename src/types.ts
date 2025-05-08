import { User } from '@supabase/supabase-js';

export interface Tag {
  id: string;
  name: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: Tag[];
  lastModified: Date;
}

export interface Item {
  id: string;
  title: string;
  notes: Note[];
  folderId?: string;
}

export interface Folder {
  id: string;
  title: string;
  items?: Item[];
  sections?: Section[];
  parentFolderId?: string;
}

export interface Group {
  id: string;
  title: string;
  items: Item[];
}

export interface Subsection {
  id: string;
  title: string;
  groups: Group[];
  items: Item[];
  folderId?: string;
}

export interface Section {
  id: string;
  title: string;
  items: Item[];
  subsections: Subsection[];
  groups: Group[];
  folderId?: string;
}

export interface Notebook {
  id: string;
  title: string;
  sections: Section[];
  folders: Folder[];
  lastModified: Date;
}

export interface AppState {
  notebooks: Notebook[];
  selectedNotebook?: string;
  selectedSection?: string;
  selectedSubsection?: string;
  selectedItem?: string;
  selectedNote?: string;
  selectedFolder?: string;
  lastSaved?: Date;
  user?: User;
}