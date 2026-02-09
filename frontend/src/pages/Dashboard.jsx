import { useEffect, useState, useRef } from 'react';
import { wallAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import {
  SparklesIcon,
  PlusIcon,
  MegaphoneIcon,
  CalendarIcon,
  TrophyIcon,
  BookOpenIcon,
  FlagIcon,
  ChatBubbleLeftIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import NewPostModal from '../components/NewPostModal';
import PostCard from '../components/PostCard';
import CreateVoteModal from '../components/CreateVoteModal';

function Dashboard() {
  const { user } = useAuthStore();
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewPost, setShowNewPost] = useState(false);
  const [showCreateVote, setShowCreateVote] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef();

  useEffect(() => {
    fetchPosts(1);
  }, [filterType]);

  const fetchPosts = async (pageNum = 1) => {
    try {
      setIsLoading(true);
      const response = await wallAPI.getPosts({
        page: pageNum,
        limit: 20,
        type: filterType,
      });

      if (pageNum === 1) {
        setPosts(response.data.posts);
      } else {
        setPosts((prev) => [...prev, ...response.data.posts]);
      }

      setHasMore(response.data.pagination.page < response.data.pagination.pages);
      setPage(pageNum);
    } catch (error) {
      toast.error('Nepodařilo se načíst příspěvky');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = () => {
    if (hasMore && !isLoading) {
      fetchPosts(page + 1);
    }
  };

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, page]);

  const handleNewPost = async (postData) => {
    try {
      const response = await wallAPI.createPost(postData);
      setPosts([
        { ...response.data, like_count: 0, comment_count: 0, liked_by_users: [] },
        ...posts,
      ]);
      setShowNewPost(false);
      toast.success('Příspěvek byl vytvořen');
    } catch (error) {
      toast.error('Nepodařilo se vytvořit příspěvek');
      console.error(error);
    }
  };

  const handleVoteCreated = () => {
    setShowCreateVote(false);
    fetchPosts(1); // Refresh posts to show new vote
  };

  const handleLike = async (postId) => {
    try {
      await wallAPI.likePost(postId);
      setPosts(
        posts.map((post) => {
          if (post.id === postId) {
            const isLiked = post.liked_by_users?.includes(user.id);
            return {
              ...post,
              like_count: isLiked ? post.like_count - 1 : post.like_count + 1,
              liked_by_users: isLiked
                ? post.liked_by_users.filter((id) => id !== user.id)
                : [...(post.liked_by_users || []), user.id],
            };
          }
          return post;
        })
      );
    } catch (error) {
      toast.error('Nepodařilo se označit příspěvek');
    }
  };

  const handleDelete = async (postId) => {
    if (!confirm('Opravdu chcete smazat tento příspěvek?')) return;

    try {
      await wallAPI.deletePost(postId);
      setPosts(posts.filter((post) => post.id !== postId));
      toast.success('Příspěvek byl smazán');
    } catch (error) {
      toast.error('Nepodařilo se smazat příspěvek');
    }
  };

  const handlePin = async (postId, isPinned) => {
    try {
      await wallAPI.pinPost(postId, !isPinned);
      setPosts(
        posts.map((post) =>
          post.id === postId ? { ...post, is_pinned: !isPinned } : post
        )
      );
      toast.success(isPinned ? 'Příspěvek byl odepnut' : 'Příspěvek byl připnut');
    } catch (error) {
      toast.error('Nepodařilo se připnout příspěvek');
    }
  };

  const postTypes = [
    { value: 'all', label: 'Vše', icon: SparklesIcon },
    { value: 'announcement', label: 'Oznámení', icon: MegaphoneIcon },
    { value: 'event', label: 'Události', icon: CalendarIcon },
    { value: 'success', label: 'Úspěchy', icon: TrophyIcon },
    { value: 'resource', label: 'Zdroje', icon: BookOpenIcon },
    { value: 'milestone', label: 'Milníky', icon: FlagIcon },
    { value: 'poll', label: 'Hlasování', icon: ChartBarIcon },
    { value: 'general', label: 'Obecné', icon: ChatBubbleLeftIcon },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <SparklesIcon className="w-6 h-6 text-white" />
            </div>
            Nástěnka týmu
          </h1>
          <p className="mt-1 text-gray-500 ml-14">
            Sdílejte novinky a spolupracujte s týmem
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateVote(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg font-medium transition-colors text-sm"
          >
            <ChartBarIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Nové hlasování</span>
            <span className="sm:hidden">Hlasování</span>
          </button>
          <button
            onClick={() => setShowNewPost(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors text-sm shadow-sm"
          >
            <PlusIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Nový příspěvek</span>
            <span className="sm:hidden">Nový</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs - Clean Design */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2">
        <div className="flex overflow-x-auto gap-1 no-scrollbar pb-1 sm:pb-0">
          {postTypes.map((type) => {
            const Icon = type.icon;
            const isActive = filterType === type.value;
            return (
              <button
                key={type.value}
                onClick={() => setFilterType(type.value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors flex-shrink-0 ${isActive
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} />
                {type.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* New Post Modal */}
      {showNewPost && (
        <NewPostModal onClose={() => setShowNewPost(false)} onSubmit={handleNewPost} />
      )}

      {/* Create Vote Modal */}
      {showCreateVote && (
        <CreateVoteModal
          isOpen={showCreateVote}
          onClose={() => setShowCreateVote(false)}
          onVoteCreated={handleVoteCreated}
        />
      )}

      {/* Posts Feed */}
      <div className="space-y-4">
        {isLoading && page === 1 ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-500 text-sm">Načítání...</p>
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200 border-dashed">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <SparklesIcon className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              Zatím žádné příspěvky
            </h3>
            <p className="text-gray-500 mb-6 max-w-sm mx-auto text-sm">
              Buďte první, kdo sdílí novinky, úspěchy nebo důležité informace s týmem
            </p>
            <button
              onClick={() => setShowNewPost(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors text-sm"
            >
              <PlusIcon className="w-5 h-5" />
              Vytvořit první příspěvek
            </button>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={user}
              onLike={handleLike}
              onDelete={handleDelete}
              onPin={handlePin}
            />
          ))
        )}

        {/* Load More Observer */}
        <div ref={observerRef} className="h-16 flex items-center justify-center">
          {isLoading && page > 1 && (
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <span>Načítání dalších...</span>
            </div>
          )}
          {!isLoading && !hasMore && posts.length > 0 && (
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">
              Konec seznamu
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
