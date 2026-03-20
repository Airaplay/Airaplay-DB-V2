import { Card, CardContent } from './ui/card';
import SingleUploadForm from './SingleUploadForm';
import AlbumUploadForm from './AlbumUploadForm';
import VideoUploadForm from './VideoUploadForm';

interface ContentUpload {
  id: string;
  title: string;
  content_type: string;
  status: string;
  created_at: string;
  description?: string;
  metadata: {
    file_url?: string;
    file_name?: string;
    file_size?: number;
    file_type?: string;
    cover_url?: string;
    thumbnail_url?: string;
    song_id?: string;
    album_id?: string;
    duration_seconds?: number;
    release_date?: string;
    release_type?: string;
    genre_id?: string;
  };
}

interface EditContentModalProps {
  upload: ContentUpload;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditContentModal: React.FC<EditContentModalProps> = ({
  upload,
  onClose,
  onSuccess,
}) => {
  const renderEditForm = () => {
    switch (upload.content_type) {
      case 'single':
        return (
          <SingleUploadForm
            initialData={upload}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        );
      case 'album':
        return (
          <AlbumUploadForm
            initialData={upload}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        );
      case 'video':
        return (
          <VideoUploadForm
            initialData={upload}
            onClose={onClose}
            onSuccess={onSuccess}
          />
        );
      default:
        return (
          <Card className="bg-white/5 backdrop-blur-sm border border-white/10">
            <CardContent className="p-8 text-center">
              <h3 className="font-['Inter',sans-serif] font-semibold text-white text-lg mb-2">
                Unsupported Content Type
              </h3>
              <p className="font-['Inter',sans-serif] text-white/70 text-sm mb-6">
                Editing is not supported for this content type: {upload.content_type}
              </p>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gradient-to-r from-[#309605] to-[#3ba208] hover:from-[#3ba208] hover:to-[#309605] rounded-xl font-['Inter',sans-serif] font-medium text-white transition-all duration-200 shadow-lg shadow-[#309605]/25"
              >
                Close
              </button>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <>
      {renderEditForm()}
    </>
  );
};