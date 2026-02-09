import { useState, useRef } from 'react';
import { CloudArrowUpIcon, DocumentIcon, XMarkIcon, CheckCircleIcon, PhotoIcon, DocumentTextIcon, FolderIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import api from '../services/api';

function Upload() {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const handleFileInput = (e) => {
    const selectedFiles = Array.from(e.target.files);
    addFiles(selectedFiles);
  };

  const addFiles = (newFiles) => {
    const filesWithMetadata = newFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'pending', // pending, uploading, success, error
      progress: 0
    }));
    setFiles(prev => [...prev, ...filesWithMetadata]);
  };

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) {
      return <PhotoIcon className="w-8 h-8 text-blue-500" />;
    } else if (type.includes('pdf')) {
      return <DocumentTextIcon className="w-8 h-8 text-red-500" />;
    } else if (type.includes('word') || type.includes('document')) {
      return <DocumentIcon className="w-8 h-8 text-blue-600" />;
    } else if (type.includes('excel') || type.includes('spreadsheet')) {
      return <DocumentIcon className="w-8 h-8 text-green-600" />;
    } else {
      return <DocumentIcon className="w-8 h-8 text-gray-500" />;
    }
  };

  const uploadFiles = async () => {
    if (files.length === 0) {
      toast.error('Nejprve vyberte soubory');
      return;
    }

    setUploading(true);

    for (const fileData of files) {
      if (fileData.status === 'success') continue;

      try {
        // Update status to uploading
        setFiles(prev => prev.map(f => 
          f.id === fileData.id ? { ...f, status: 'uploading' } : f
        ));

        const formData = new FormData();
        formData.append('file', fileData.file);

        const response = await api.post('/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setFiles(prev => prev.map(f => 
              f.id === fileData.id ? { ...f, progress: percentCompleted } : f
            ));
          }
        });

        // Update status to success
        setFiles(prev => prev.map(f => 
          f.id === fileData.id ? { ...f, status: 'success', progress: 100, uploadedPath: response.data.file?.path } : f
        ));

        toast.success(`${fileData.name} nahrán úspěšně!`);
      } catch (error) {
        console.error('Upload error:', error);
        setFiles(prev => prev.map(f => 
          f.id === fileData.id ? { ...f, status: 'error' } : f
        ));
        toast.error(`Chyba při nahrávání ${fileData.name}`);
      }
    }

    setUploading(false);
  };

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'success'));
    toast.success('Dokončené soubory byly odstraněny');
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Nahrávání souborů</h1>
        <p className="text-gray-600">Nahrajte dokumenty, obrázky a další soubory do systému</p>
      </div>

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 ${
          isDragging
            ? 'border-blue-500 bg-blue-50 scale-[1.02]'
            : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'
        }`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          {/* Icon */}
          <div className={`p-4 rounded-full transition-all duration-300 ${
            isDragging 
              ? 'bg-gradient-to-br from-blue-500 to-cyan-500 scale-110' 
              : 'bg-gradient-to-br from-blue-100 to-cyan-100'
          }`}>
            <CloudArrowUpIcon className={`w-16 h-16 transition-colors ${
              isDragging ? 'text-white' : 'text-blue-600'
            }`} />
          </div>

          {/* Text */}
          <div className="text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {isDragging ? 'Pusťte soubory zde' : 'Přetáhněte soubory sem'}
            </h3>
            <p className="text-gray-600 mb-4">
              nebo
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/50"
            >
              Vybrat soubory
            </button>
          </div>

          {/* Supported formats */}
          <p className="text-sm text-gray-500">
            Podporované formáty: PDF, Word, Excel, obrázky (JPG, PNG), a další
          </p>
        </div>
      </div>

      {/* Files List */}
      {files.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Vybrané soubory ({files.length})
            </h2>
            <div className="flex gap-2">
              {files.some(f => f.status === 'success') && (
                <button
                  onClick={clearCompleted}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Vymazat dokončené
                </button>
              )}
              {files.some(f => f.status === 'pending') && (
                <button
                  onClick={uploadFiles}
                  disabled={uploading}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Nahrávání...' : 'Nahrát vše'}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {files.map((fileData) => (
              <div
                key={fileData.id}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4">
                  {/* File Icon */}
                  <div className="flex-shrink-0">
                    {getFileIcon(fileData.type)}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {fileData.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(fileData.size)}
                    </p>

                    {/* Progress Bar */}
                    {fileData.status === 'uploading' && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-600 to-cyan-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${fileData.progress}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{fileData.progress}%</p>
                      </div>
                    )}
                  </div>

                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {fileData.status === 'success' && (
                      <CheckCircleIcon className="w-6 h-6 text-green-500" />
                    )}
                    {fileData.status === 'error' && (
                      <XMarkIcon className="w-6 h-6 text-red-500" />
                    )}
                    {(fileData.status === 'pending' || fileData.status === 'uploading') && !uploading && (
                      <button
                        onClick={() => removeFile(fileData.id)}
                        className="p-1 hover:bg-red-50 rounded-lg transition-colors group"
                      >
                        <XMarkIcon className="w-5 h-5 text-gray-400 group-hover:text-red-600" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      {files.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <FolderIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Celkem souborů</p>
                <p className="text-2xl font-bold text-gray-900">{files.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <CheckCircleIcon className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Nahráno</p>
                <p className="text-2xl font-bold text-gray-900">
                  {files.filter(f => f.status === 'success').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <CloudArrowUpIcon className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Čeká na nahrání</p>
                <p className="text-2xl font-bold text-gray-900">
                  {files.filter(f => f.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Upload;

