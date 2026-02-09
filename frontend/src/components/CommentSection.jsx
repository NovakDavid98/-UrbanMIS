import { useState, useEffect } from 'react';
import { wallAPI } from '../services/api';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { cs } from 'date-fns/locale';
import {
  PaperAirplaneIcon,
  TrashIcon,
  ChatBubbleLeftIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { ChatBubbleLeftIcon as ChatBubbleLeftSolidIcon } from '@heroicons/react/24/solid';

function CommentSection({ postId, currentUser }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // { id, name }

  useEffect(() => {
    loadComments();
  }, [postId]);

  const loadComments = async () => {
    try {
      setIsLoading(true);
      const response = await wallAPI.getComments(postId);
      setComments(response.data);
    } catch (error) {
      toast.error('Nepodařilo se načíst komentáře');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await wallAPI.addComment(
        postId,
        newComment.trim(),
        replyingTo?.id || null
      );
      setComments([...comments, response.data]);
      setNewComment('');
      setReplyingTo(null);
      toast.success(replyingTo ? 'Odpověď přidána' : 'Komentář přidán');
    } catch (error) {
      toast.error('Nepodařilo se přidat komentář');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!confirm('Opravdu chcete smazat tento komentář?')) return;

    try {
      await wallAPI.deleteComment(commentId);
      setComments(comments.filter((c) => c.id !== commentId));
      toast.success('Komentář byl smazán');
    } catch (error) {
      toast.error('Nepodařilo se smazat komentář');
      console.error(error);
    }
  };

  const startReply = (comment) => {
    setReplyingTo({
      id: comment.id,
      name: `${comment.author_first_name} ${comment.author_last_name}`
    });
    // Focus on the input
    setTimeout(() => {
      document.querySelector('.comment-input')?.focus();
    }, 100);
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setNewComment('');
  };

  // Organize comments into parent and reply structure
  const topLevelComments = comments.filter(c => !c.parent_comment_id);
  const getReplies = (parentId) => comments.filter(c => c.parent_comment_id === parentId);

  const Avatar = ({ firstName, lastName, size = 'md', blue = false }) => {
    const sizeClasses = {
      sm: 'w-6 h-6 text-xs',
      md: 'w-8 h-8 text-sm',
      lg: 'w-10 h-10 text-base'
    };

    const colorClasses = blue
      ? 'bg-indigo-100 text-indigo-600'
      : 'bg-gray-100 text-gray-600';

    return (
      <div className={`${sizeClasses[size]} ${colorClasses} rounded-full flex items-center justify-center font-semibold flex-shrink-0`}>
        {firstName?.[0]}{lastName?.[0]}
      </div>
    );
  };

  const Comment = ({ comment, isReply = false }) => {
    const replies = getReplies(comment.id);
    const hasReplies = replies.length > 0;

    return (
      <div className={isReply ? 'ml-10' : ''}>
        <div className="flex gap-3 bg-white p-4 rounded-xl border border-gray-200 hover:shadow-sm transition-shadow">
          <Avatar
            firstName={comment.author_first_name}
            lastName={comment.author_last_name}
            size={isReply ? 'sm' : 'md'}
          />

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">
                  {comment.author_first_name} {comment.author_last_name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(comment.created_at), {
                    addSuffix: true,
                    locale: cs,
                  })}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                {!isReply && currentUser && (
                  <button
                    className="p-1.5 hover:bg-indigo-50 rounded-lg transition-colors group"
                    title="Odpovědět"
                  >
                    <ChatBubbleLeftIcon className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                  </button>
                )}
                {currentUser && (comment.author_id === currentUser.id || currentUser.role === 'admin') && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="p-1.5 hover:bg-red-50 rounded-lg transition-colors group"
                    title="Smazat"
                  >
                    <TrashIcon className="w-4 h-4 text-gray-400 group-hover:text-red-600" />
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <p className="text-gray-700 mt-2 text-sm whitespace-pre-wrap leading-relaxed">
              {comment.content}
            </p>

            {/* Reply count indicator for top-level comments */}
            {!isReply && hasReplies && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-indigo-600">
                <ChatBubbleLeftSolidIcon className="w-3.5 h-3.5" />
                <span className="font-medium">{replies.length} {replies.length === 1 ? 'odpověď' : 'odpovědi'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Render replies */}
        {!isReply && hasReplies && (
          <div className="mt-3 space-y-3">
            {replies.map((reply) => (
              <Comment key={reply.id} comment={reply} isReply={true} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="border-t border-gray-200 bg-gradient-to-b from-gray-50 to-white p-6">
      {/* Comments List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          {topLevelComments.length === 0 ? (
            <div className="text-center py-8">
              <ChatBubbleLeftIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                Zatím žádné komentáře. Buďte první!
              </p>
            </div>
          ) : (
            topLevelComments.map((comment) => (
              <Comment key={comment.id} comment={comment} />
            ))
          )}
        </div>
      )}

      {/* New Comment Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Reply indicator */}
        {replyingTo && (
          <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-sm">
            <ChatBubbleLeftSolidIcon className="w-4 h-4 text-indigo-600 flex-shrink-0" />
            <span className="text-indigo-900 flex-1">
              Odpovídáte uživateli <span className="font-semibold">{replyingTo.name}</span>
            </span>
            <button
              type="button"
              onClick={cancelReply}
              className="p-1 hover:bg-indigo-100 rounded transition-colors"
            >
              <XMarkIcon className="w-4 h-4 text-indigo-600" />
            </button>
          </div>
        )}

        {/* Comment input */}
        <div className="flex gap-3">
          <Avatar
            firstName={currentUser.first_name}
            lastName={currentUser.last_name}
            blue={true}
          />
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={replyingTo ? "Napište odpověď..." : "Napište komentář..."}
              className="comment-input flex-1 px-4 py-2 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition-shadow hover:shadow-sm"
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={!newComment.trim() || isSubmitting}
              className="px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium text-sm flex items-center gap-2 shadow-sm"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <PaperAirplaneIcon className="w-4 h-4" />
                  {replyingTo ? 'Odpovědět' : 'Odeslat'}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default CommentSection;
