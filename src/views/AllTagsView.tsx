import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Tag as TagIcon } from 'lucide-react';
import { useTags } from '../hooks/useTags';

export function AllTagsView() {
  const userId = 'local-user';
  const navigate = useNavigate();
  const location = useLocation();
  const { tags, loading } = useTags(userId);

  // Sort tags alphabetically by name (case-insensitive)
  const sortedTags = [...tags].sort((a, b) => 
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );

  const handleBack = () => navigate(-1);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        <button
          onClick={handleBack}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <TagIcon className="h-6 w-6" />
          All Tags
        </h1>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : sortedTags.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No tags created yet
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sortedTags.map((tag) => (
              <Link
                key={tag.id}
                to={`/tag/${encodeURIComponent(tag.name)}`}
                state={{ from: location.pathname }}
                className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-medium text-gray-900">
                    {tag.name}
                  </span>
                  {tag.noteCount === 0 && (
                    <span className="text-sm text-gray-500">(0)</span>
                  )}
                </div>
                {tag.noteCount > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    {tag.noteCount} {tag.noteCount === 1 ? 'note' : 'notes'}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}