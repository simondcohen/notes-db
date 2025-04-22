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
  items: Item[]; // Ungrouped items
}

export interface Section {
  id: string;
  title: string;
  subsections: Subsection[];
  items: Item[]; // Items directly in section
  groups: Group[]; // Groups directly in section
}

export interface Notebook {
  id: string;
  title: string;
  sections: Section[];
  lastModified: Date;
}

export interface AppState {
  notebooks: Notebook[];
  selectedNotebook?: string;
  selectedSection?: string;
  selectedSubsection?: string;
  selectedItem?: string;
  selectedNote?: string;
  lastSaved?: Date;
  user?: User;
}