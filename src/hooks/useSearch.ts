import { useState, useMemo } from 'react';
import type { Section, Item, Note } from '../types';

export function useSearch(sections: Section[]) {
  const [searchQuery, setSearchQuery] = useState('');

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }

    const query = searchQuery.toLowerCase();
    const results: Array<{
      sectionId: string;
      sectionTitle: string;
      subsectionId?: string;
      subsectionTitle?: string;
      item: Item;
      note: Note;
    }> = [];

    sections.forEach((section) => {
      // Search in section items
      section.items.forEach((item) => {
        item.notes.forEach((note) => {
          if (
            item.title.toLowerCase().includes(query) ||
            note.title.toLowerCase().includes(query) ||
            note.content.toLowerCase().includes(query)
          ) {
            results.push({
              sectionId: section.id,
              sectionTitle: section.title,
              item,
              note,
            });
          }
        });
      });

      // Search in section groups
      section.groups.forEach((group) => {
        group.items.forEach((item) => {
          item.notes.forEach((note) => {
            if (
              item.title.toLowerCase().includes(query) ||
              note.title.toLowerCase().includes(query) ||
              note.content.toLowerCase().includes(query)
            ) {
              results.push({
                sectionId: section.id,
                sectionTitle: section.title,
                item,
                note,
              });
            }
          });
        });
      });

      // Search in subsections
      section.subsections.forEach((subsection) => {
        subsection.items.forEach((item) => {
          item.notes.forEach((note) => {
            if (
              item.title.toLowerCase().includes(query) ||
              note.title.toLowerCase().includes(query) ||
              note.content.toLowerCase().includes(query)
            ) {
              results.push({
                sectionId: section.id,
                sectionTitle: section.title,
                subsectionId: subsection.id,
                subsectionTitle: subsection.title,
                item,
                note,
              });
            }
          });
        });

        subsection.groups.forEach((group) => {
          group.items.forEach((item) => {
            item.notes.forEach((note) => {
              if (
                item.title.toLowerCase().includes(query) ||
                note.title.toLowerCase().includes(query) ||
                note.content.toLowerCase().includes(query)
              ) {
                results.push({
                  sectionId: section.id,
                  sectionTitle: section.title,
                  subsectionId: subsection.id,
                  subsectionTitle: subsection.title,
                  item,
                  note,
                });
              }
            });
          });
        });
      });
    });

    return results;
  }, [sections, searchQuery]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
  };
}