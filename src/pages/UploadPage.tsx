// ABOUTME: Main record page for recording and publishing videos
// ABOUTME: Orchestrates camera recording, file recording, metadata input, and publishing flow

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CameraRecorder } from '@/components/CameraRecorder';
import { VideoMetadataForm } from '@/components/VideoMetadataForm';
import { Button } from '@/components/ui/button';
import { Camera } from '@phosphor-icons/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';

type UploadStep = 'choose' | 'record' | 'metadata';

interface RecordedSegment {
  blob: Blob;
  blobUrl: string;
}

export function UploadPage() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [step, setStep] = useState<UploadStep>('choose');
  const [recordedSegments, setRecordedSegments] = useState<RecordedSegment[]>([]);

  // Require login to record
  if (!user) {
    return (
      <div className="container max-w-lg mx-auto py-12 px-4">
        <div className="text-center space-y-4">
          <Camera className="h-16 w-16 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold">Login Required</h1>
          <p className="text-muted-foreground">
            You need to be logged in to record videos
          </p>
          <Button onClick={() => navigate('/')}>
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  // Handle recording completion
  const handleRecordingComplete = (segments: RecordedSegment[]) => {
    setRecordedSegments(segments);
    setStep('metadata');
  };

  // Handle publish completion
  const handlePublished = () => {
    // Clean up recorded segments
    recordedSegments.forEach(segment => {
      URL.revokeObjectURL(segment.blobUrl);
    });
    setRecordedSegments([]);
    setStep('choose');

    // Navigate to home to see the published video
    navigate('/');
  };

  // Handle cancel
  const handleCancel = () => {
    // Clean up recorded segments
    recordedSegments.forEach(segment => {
      URL.revokeObjectURL(segment.blobUrl);
    });
    setRecordedSegments([]);

    setStep('choose');
  };

  // Choose record method
  if (step === 'choose') {
    return (
      <div className="container max-w-lg mx-auto py-12 px-4">
        <div className="text-center space-y-6">
          <h1 className="text-3xl font-bold">Create a Vine</h1>
          <p className="text-muted-foreground">
            Record a 6-second looping video to share with the world
          </p>

          <div className="space-y-3 pt-4">
            <Button
              onClick={() => setStep('record')}
              variant="sticker"
              className="w-full h-16 text-lg"
              size="lg"
            >
              <Camera className="mr-2 h-5 w-5" />
              Record with Camera
            </Button>
          </div>

          <div className="pt-6">
            <Button
              onClick={() => navigate(-1)}
              variant="ghost"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Recording step
  if (step === 'record') {
    return (
      <CameraRecorder
        onRecordingComplete={handleRecordingComplete}
        onCancel={handleCancel}
      />
    );
  }

  // Metadata step
  if (step === 'metadata' && recordedSegments.length > 0) {
    return (
      <VideoMetadataForm
        segments={recordedSegments}
        onCancel={handleCancel}
        onPublished={handlePublished}
      />
    );
  }

  return null;
}

export default UploadPage;
