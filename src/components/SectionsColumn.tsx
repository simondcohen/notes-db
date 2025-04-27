import React from 'react';
import { Plus } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import type { Section } from '../types';
import { DraggableSectionItem } from './DraggableSectionItem';
import { exportSectionAsZip } from '../utils/zipExportImport';
import { useToast } from './ui/Toast';

interface SectionsColumnProps {
  sections: Section[];
  selectedSection?: string;
  onSelectSection: (sectionId: string) => void;
  onAddSection: () => void;
  onDeleteSection: (sectionId: string) => void;
  onUpdateSectionTitle: (sectionId: string, newTitle: string) => void;
  onReorderSections: (sections: Section[]) => void;
  userId: string;
}

export function SectionsColumn({
  sections,
  selectedSection,
  onSelectSection,
  onAddSection,
  onDeleteSection,
  onUpdateSectionTitle,
  onReorderSections,
  userId,
}: SectionsColumnProps) {
  const { showToast } = useToast();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDeleteSection = (sectionId: string, sectionTitle: string) => {
    if (window.confirm(`Are you sure you want to delete the section "${sectionTitle}" and all its contents?`)) {
      onDeleteSection(sectionId);
    }
  };

  const handleExportSection = async (sectionId: string) => {
    try {
      await exportSectionAsZip(userId, sectionId);
      showToast('Section exported successfully as ZIP', 'success');
    } catch (error) {
      console.error('Error exporting section as zip:', error);
      showToast('Failed to export section as ZIP. Please try again.', 'error');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex(section => section.id === active.id);
      const newIndex = sections.findIndex(section => section.id === over.id);
      
      onReorderSections(arrayMove(sections, oldIndex, newIndex));
    }
  };

  return (
    <div className="w-64 h-full bg-gray-50 flex flex-col">
      <div className="h-14 px-4 border-b border-gray-200 flex items-center justify-between bg-white">
        <h2 className="font-semibold text-gray-700">Sections</h2>
        <button
          onClick={onAddSection}
          className="p-1 hover:bg-gray-200 rounded-lg"
          title="Add Section"
        >
          <Plus className="h-5 w-5 text-gray-600" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext
            items={sections}
            strategy={verticalListSortingStrategy}
          >
            {sections.map((section) => (
              <DraggableSectionItem
                key={section.id}
                section={section}
                isSelected={selectedSection === section.id}
                onSelect={onSelectSection}
                onDelete={(sectionId) => handleDeleteSection(sectionId, section.title)}
                onUpdateTitle={onUpdateSectionTitle}
                onExport={handleExportSection}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}