import React from 'react';
import type { Item, Note } from '../types';

interface SearchResult {
  sectionId: string;
  sectionTitle: string;
  subsectionId?: string;
  subsectionTitle?: string;
  item: Item;
  note: Note;
}

interface SearchResultsProps {
  results: SearchResult[];
  onSelect: (result: SearchResult) => void;
}

export function SearchResults({ results, onSelect }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No results found
      </div>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto divide-y divide-gray-200">
      {results.map((result, index) => (
        <div
          key={`${result.item.id}-${result.note.id}-${index}`}
          className="p-4 hover:bg-gray-50 cursor-pointer"
          onClick={() => onSelect(result)}
        >
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span>{result.sectionTitle}</span>
            {result.subsectionTitle && (
              <>
                <span>→</span>
                <span>{result.subsectionTitle}</span>
              </>
            )}
          </div>
          <div className="mt-1 font-medium">{result.item.title}</div>
          <div className="mt-0.5 text-sm text-gray-600">{result.note.title}</div>
          <div className="mt-1 text-sm text-gray-500 line-clamp-2">
            {result.note.content}
          </div>
        </div>
      ))}
    </div>
  );
}