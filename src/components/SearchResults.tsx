import React from 'react';
import type { Item, Note } from '../types';
import { File, Book, BookOpen, FileText, Tag } from 'lucide-react';

export interface SearchResult {
  sectionId: string;
  sectionTitle: string;
  subsectionId?: string;
  subsectionTitle?: string;
  item?: Item;
  note?: Note;
  type: 'section' | 'subsection' | 'item' | 'note';
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
          key={`${result.type}-${result.sectionId}-${result.item?.id || ''}-${result.note?.id || ''}-${index}`}
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
          
          {result.type === 'section' && (
            <div className="mt-1 font-medium flex items-center space-x-2">
              <Book className="h-4 w-4 text-blue-500" />
              <span>Section: {result.sectionTitle}</span>
            </div>
          )}
          
          {result.type === 'subsection' && (
            <div className="mt-1 font-medium flex items-center space-x-2">
              <BookOpen className="h-4 w-4 text-green-500" />
              <span>Subsection: {result.subsectionTitle}</span>
            </div>
          )}
          
          {result.type === 'item' && result.item && (
            <div className="mt-1 font-medium flex items-center space-x-2">
              <File className="h-4 w-4 text-gray-500" />
              <span>Item: {result.item.title}</span>
            </div>
          )}
          
          {result.type === 'note' && result.item && result.note && (
            <>
              <div className="mt-1 font-medium flex items-center space-x-2">
                <File className="h-4 w-4 text-gray-500" />
                <span>{result.item.title}</span>
              </div>
              <div className="mt-0.5 text-sm text-gray-600 flex items-center space-x-2">
                <FileText className="h-3 w-3 text-gray-400" />
                <span>{result.note.title}</span>
              </div>
              <div className="mt-1 text-sm text-gray-500 line-clamp-2 pl-5">
                {result.note.content?.replace(/<[^>]*>/g, '') || 'No content'}
              </div>
              
              {result.note.tags && result.note.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {result.note.tags.map(tag => (
                    <div key={tag.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">
                      <Tag className="h-2 w-2" />
                      {tag.name}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}