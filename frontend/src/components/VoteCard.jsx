import { useState, useEffect } from 'react';
import { votingAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { cs } from 'date-fns/locale';
import {
  ChartBarIcon,
  CheckIcon,
  ClockIcon,
  UserGroupIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

function VoteCard({ post, onVoteUpdate }) {
  const { user } = useAuthStore();
  const [voteDetails, setVoteDetails] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [ratings, setRatings] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (post.vote_id) {
      fetchVoteDetails();
    }
  }, [post.vote_id]);

  const fetchVoteDetails = async () => {
    try {
      const response = await votingAPI.getById(post.vote_id);
      setVoteDetails(response.data);
      
      // Check if user has already voted
      if (response.data.userResponse && response.data.userResponse.length > 0) {
        setHasVoted(true);
        setShowResults(true);
        setSelectedOptions(response.data.userResponse.map(r => r.option_id));
        
        // Set ratings if it's a rating vote
        if (response.data.vote.vote_type === 'rating') {
          const userRatings = {};
          response.data.userResponse.forEach(r => {
            userRatings[r.option_id] = r.rating;
          });
          setRatings(userRatings);
        }
      }
    } catch (error) {
      console.error('Error fetching vote details:', error);
    }
  };

  const handleOptionSelect = (optionId) => {
    if (hasVoted || !voteDetails.vote.is_active) return;

    if (voteDetails.vote.vote_type === 'single_choice') {
      setSelectedOptions([optionId]);
    } else if (voteDetails.vote.vote_type === 'multiple_choice') {
      setSelectedOptions(prev => 
        prev.includes(optionId) 
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      );
    }
  };

  const handleRatingChange = (optionId, rating) => {
    if (hasVoted || !voteDetails.vote.is_active) return;
    
    setRatings(prev => ({
      ...prev,
      [optionId]: rating
    }));
  };

  const submitVote = async () => {
    if (!voteDetails || hasVoted) return;

    setIsLoading(true);
    try {
      const data = {};
      
      if (voteDetails.vote.vote_type === 'rating') {
        data.ratings = ratings;
      } else {
        data.optionIds = selectedOptions;
      }

      await votingAPI.respond(post.vote_id, data);
      toast.success('Váš hlas byl zaznamenán!');
      
      setHasVoted(true);
      setShowResults(true);
      fetchVoteDetails(); // Refresh to get updated results
      
      if (onVoteUpdate) {
        onVoteUpdate();
      }
    } catch (error) {
      toast.error('Nepodařilo se zaznamenat hlas');
      console.error('Vote submission error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getOptionPercentage = (option) => {
    if (!voteDetails || voteDetails.totalResponses === 0) return 0;
    return Math.round((option.response_count / voteDetails.totalResponses) * 100);
  };

  const isVoteExpired = () => {
    if (!voteDetails?.vote.ends_at) return false;
    return new Date(voteDetails.vote.ends_at) < new Date();
  };

  const canVote = () => {
    return voteDetails?.vote.is_active && !hasVoted && !isVoteExpired();
  };

  if (!voteDetails) {
    return (
      <div className="animate-pulse bg-gray-100 rounded-lg p-4">
        <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-gray-300 rounded w-1/2"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {/* Vote Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
            <ChartBarIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{voteDetails.vote.title}</h3>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <UserGroupIcon className="w-4 h-4" />
                <span>{voteDetails.totalResponses} hlasů</span>
              </div>
              {voteDetails.vote.ends_at && (
                <div className="flex items-center space-x-1">
                  <ClockIcon className="w-4 h-4" />
                  <span>
                    {isVoteExpired() 
                      ? 'Ukončeno' 
                      : `Do ${format(new Date(voteDetails.vote.ends_at), 'dd.MM.yyyy HH:mm', { locale: cs })}`
                    }
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Vote Status */}
        <div className="flex items-center space-x-2">
          {hasVoted && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <CheckIcon className="w-3 h-3 mr-1" />
              Hlasováno
            </span>
          )}
          {!voteDetails.vote.is_active && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              <XMarkIcon className="w-3 h-3 mr-1" />
              Neaktivní
            </span>
          )}
          {isVoteExpired() && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              <ClockIcon className="w-3 h-3 mr-1" />
              Ukončeno
            </span>
          )}
        </div>
      </div>

      {/* Vote Description */}
      {voteDetails.vote.description && (
        <p className="text-gray-600 mb-4">{voteDetails.vote.description}</p>
      )}

      {/* Vote Options */}
      <div className="space-y-3">
        {voteDetails.options.map((option) => (
          <div key={option.id} className="relative">
            {voteDetails.vote.vote_type === 'rating' ? (
              // Rating Vote
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{option.option_text}</span>
                  {showResults && (
                    <span className="text-sm text-gray-500">
                      Průměr: {option.average_rating.toFixed(1)}/5
                    </span>
                  )}
                </div>
                
                {canVote() ? (
                  <div className="flex items-center space-x-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => handleRatingChange(option.id, rating)}
                        className={`w-8 h-8 rounded-full border-2 transition-colors ${
                          ratings[option.id] >= rating
                            ? 'bg-yellow-400 border-yellow-400 text-white'
                            : 'border-gray-300 hover:border-yellow-400'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                ) : showResults && (
                  <div className="flex items-center space-x-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <div
                        key={rating}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
                          option.average_rating >= rating
                            ? 'bg-yellow-400 border-yellow-400 text-white'
                            : 'border-gray-300'
                        }`}
                      >
                        ★
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Single/Multiple Choice Vote
              <div
                className={`border rounded-lg p-4 transition-all cursor-pointer ${
                  canVote()
                    ? selectedOptions.includes(option.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                    : 'border-gray-200 cursor-default'
                }`}
                onClick={() => handleOptionSelect(option.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedOptions.includes(option.id)
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}>
                      {selectedOptions.includes(option.id) && (
                        <CheckIcon className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className="font-medium text-gray-900">{option.option_text}</span>
                  </div>
                  
                  {showResults && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        {getOptionPercentage(option)}%
                      </span>
                      <span className="text-sm text-gray-500">
                        ({option.response_count})
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Progress Bar for Results */}
                {showResults && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${getOptionPercentage(option)}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Vote Actions */}
      <div className="mt-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {!hasVoted && !showResults && (
            <button
              onClick={() => setShowResults(!showResults)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {showResults ? 'Skrýt výsledky' : 'Zobrazit výsledky'}
            </button>
          )}
        </div>
        
        {canVote() && (
          <button
            onClick={submitVote}
            disabled={
              isLoading || 
              (voteDetails.vote.vote_type === 'rating' ? Object.keys(ratings).length === 0 : selectedOptions.length === 0)
            }
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Hlasování...' : 'Hlasovat'}
          </button>
        )}
      </div>
    </div>
  );
}

export default VoteCard;
