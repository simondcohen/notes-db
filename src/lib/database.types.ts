export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      notebooks: {
        Row: {
          id: string
          title: string
          user_id: string
          last_modified: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          user_id: string
          last_modified?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          user_id?: string
          last_modified?: string
          created_at?: string
          updated_at?: string
        }
      }
      sections: {
        Row: {
          id: string
          notebook_id: string
          title: string
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          notebook_id: string
          title: string
          position: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          notebook_id?: string
          title?: string
          position?: number
          created_at?: string
          updated_at?: string
        }
      }
      subsections: {
        Row: {
          id: string
          section_id: string
          title: string
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          section_id: string
          title: string
          position: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          section_id?: string
          title?: string
          position?: number
          created_at?: string
          updated_at?: string
        }
      }
      groups: {
        Row: {
          id: string
          section_id: string | null
          subsection_id: string | null
          title: string
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          section_id?: string | null
          subsection_id?: string | null
          title: string
          position: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          section_id?: string | null
          subsection_id?: string | null
          title?: string
          position?: number
          created_at?: string
          updated_at?: string
        }
      }
      items: {
        Row: {
          id: string
          section_id: string | null
          subsection_id: string | null
          group_id: string | null
          title: string
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          section_id?: string | null
          subsection_id?: string | null
          group_id?: string | null
          title: string
          position: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          section_id?: string | null
          subsection_id?: string | null
          group_id?: string | null
          title?: string
          position?: number
          created_at?: string
          updated_at?: string
        }
      }
      notes: {
        Row: {
          id: string
          item_id: string
          title: string
          content: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          item_id: string
          title: string
          content?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          title?: string
          content?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}