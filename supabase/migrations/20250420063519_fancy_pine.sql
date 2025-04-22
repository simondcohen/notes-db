/*
  # Add embeddings column to notes table

  1. Changes
    - Enable pgvector extension
    - Add embedding column to notes table
    
  2. Notes
    - Uses pgvector for vector similarity search
    - Vector dimension is 1536 (standard for many embedding models)
*/

-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add the embedding column to the notes table
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS embedding vector(1536);