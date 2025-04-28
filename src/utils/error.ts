import { PostgrestError } from '@supabase/supabase-js';

export function handleError(error: Error | PostgrestError | null) {
  if (!error) return;
  
  console.error('Error:', error);
  
  if ('code' in error && 'message' in error) {
    // Handle Supabase specific errors
    switch (error.code) {
      case 'PGRST116':
        // row count = 0 → harmless racing update
        return;   // swallow it silently
      case '42501':
        alert('You do not have permission to perform this action.');
        break;
      case '23505':
        alert('This item already exists.');
        break;
      default:
        alert(`An error occurred: ${error.message}`);
    }
  } else {
    alert('An unexpected error occurred. Please try again.');
  }
}