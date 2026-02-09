import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { cs } from 'date-fns/locale';
import {
  HeartIcon,
  ChatBubbleLeftIcon,
  EllipsisVerticalIcon,
  TrashIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import CommentSection from './CommentSection';
import VoteCard from './VoteCard';

function PostCard({ post, currentUser, onLike, onDelete, onPin }) {
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Character limit for preview (adjust as needed)
  const PREVIEW_LENGTH = 500;
  const isLongPost = post.content && post.content.length > PREVIEW_LENGTH;

  // Handle case when currentUser might be null/undefined
  const isLiked = currentUser && post.liked_by_users?.includes(currentUser.id);
  const isAuthor = currentUser && post.author_id === currentUser.id;
  const isAdmin = currentUser && currentUser.role === 'admin';

  const getPostTypeColor = (type) => {
    const colors = {
      announcement: 'bg-blue-100 text-blue-700 border-blue-200',
      event: 'bg-purple-100 text-purple-700 border-purple-200',
      success: 'bg-green-100 text-green-700 border-green-200',
      resource: 'bg-orange-100 text-orange-700 border-orange-200',
      milestone: 'bg-pink-100 text-pink-700 border-pink-200',
      poll: 'bg-purple-100 text-purple-700 border-purple-200',
      general: 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return colors[type] || colors.general;
  };

  const getPostTypeEmoji = (type) => {
    const emojis = {
      announcement: '📢',
      event: '📅',
      success: '🏆',
      resource: '📚',
      milestone: '🚩',
      poll: '📊',
      general: '💬',
    };
    return emojis[type] || emojis.general;
  };

  const getPostTypeLabel = (type) => {
    const labels = {
      announcement: 'Oznámení',
      event: 'Událost',
      success: 'Úspěch',
      resource: 'Zdroje',
      milestone: 'Milník',
      poll: 'Hlasování',
      general: 'Obecné',
    };
    return labels[type] || labels.general;
  };

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border transition-all duration-300 hover:shadow-md ${post.is_pinned ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-200'
        }`}
    >
      {/* Pinned Indicator */}
      {post.is_pinned && (
        <div className="bg-indigo-600 px-4 py-2 flex items-center gap-2 text-white text-sm font-medium">
          <MapPinIcon className="w-4 h-4" />
          Připnutý příspěvek
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold flex-shrink-0 text-lg">
              {post.author_first_name?.[0]}
              {post.author_last_name?.[0]}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-900 text-lg">
                  {post.author_first_name} {post.author_last_name}
                </p>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${getPostTypeColor(post.post_type)}`}>
                  <span>{getPostTypeEmoji(post.post_type)}</span>
                  {getPostTypeLabel(post.post_type)}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {formatDistanceToNow(new Date(post.created_at), {
                  addSuffix: true,
                  locale: cs,
                })}
              </p>
            </div>
          </div>

          {/* Menu */}
          {(isAuthor || isAdmin) && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <EllipsisVerticalIcon className="w-5 h-5 text-gray-400" />
              </button>
              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  ></div>
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-20">
                    {isAdmin && (
                      <button
                        onClick={() => {
                          onPin(post.id, post.is_pinned);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center gap-3 transition-colors"
                      >
                        <MapPinIcon className="w-4 h-4 text-gray-600" />
                        {post.is_pinned ? 'Odepnout' : 'Připnout'}
                      </button>
                    )}
                    {(isAuthor || isAdmin) && (
                      <button
                        onClick={() => {
                          onDelete(post.id);
                          setShowMenu(false);
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 flex items-center gap-3 text-red-600 transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                        Smazat
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="prose prose-sm max-w-none mb-4">
          <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
            {isLongPost && !isExpanded
              ? post.content.substring(0, PREVIEW_LENGTH) + '...'
              : post.content
            }
          </p>

          {/* Read More / Show Less Button */}
          {isLongPost && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 text-primary-600 hover:text-primary-700 font-medium text-sm flex items-center gap-1 transition-colors"
            >
              {isExpanded ? (
                <>
                  <span>Zobrazit méně</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </>
              ) : (
                <>
                  <span>Číst více</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>
          )}
        </div>

        {/* Image */}
        {post.image_url && (
          <div className="mb-4 rounded-xl overflow-hidden border border-gray-200">
            <img
              src={post.image_url}
              alt="Post image"
              className="w-full h-auto max-h-96 object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        )}

        {/* File Attachment */}
        {post.file_url && (
          <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {post.file_name || 'Příloha'}
              </p>
              <p className="text-xs text-gray-500">Připojený soubor</p>
            </div>
            <a
              href={post.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-secondary"
            >
              Stáhnout
            </a>
          </div>
        )}

        {/* Vote Card */}
        {post.vote_id && (
          <div className="mb-4">
            <VoteCard post={post} />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-6 pt-4 border-t border-gray-100">
          <button
            onClick={() => onLike(post.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${isLiked
              ? 'text-red-600 bg-red-50 hover:bg-red-100'
              : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            {isLiked ? (
              <HeartSolidIcon className="w-5 h-5" />
            ) : (
              <HeartIcon className="w-5 h-5" />
            )}
            <span className="font-medium text-sm">
              {post.like_count > 0 && post.like_count}
              {post.like_count === 0 && 'Líbí'}
            </span>
          </button>

          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-all"
          >
            <ChatBubbleLeftIcon className="w-5 h-5" />
            <span className="font-medium text-sm">
              {post.comment_count > 0 ? `${post.comment_count} komentářů` : 'Komentovat'}
            </span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <CommentSection postId={post.id} currentUser={currentUser} />
      )}
    </div>
  );
}

export default PostCard;
