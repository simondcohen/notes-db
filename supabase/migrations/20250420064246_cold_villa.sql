/*
  # Add embedding column to notes table

  1. Changes
    - Enable pgvector extension
    - Add embedding column of type vector(1536) to notes table

  2. Notes
    - The vector dimension 1536 is chosen to match common embedding models
    - Column is nullable to allow gradual population of embeddings
*/

-- Enable the pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Add the embedding column to the notes table
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS embedding vector(1536);