'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { profileService } from '@/lib/services/profile.service';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ChevronLeft, Camera, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'VERIFIED':
      return <span className="flex items-center text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded"><CheckCircle className="w-3 h-3 mr-1" /> VERIFIED</span>;
    case 'REJECTED':
      return <span className="flex items-center text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded"><XCircle className="w-3 h-3 mr-1" /> REJECTED</span>;
    case 'PENDING':
      return <span className="flex items-center text-xs font-bold text-yellow-600 bg-yellow-100 px-2 py-1 rounded"><Clock className="w-3 h-3 mr-1" /> PENDING</span>;
    default:
      return <span className="flex items-center text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">NOT SUBMITTED</span>;
  }
};

export default function DocumentVerificationScreen() {
  const router = useRouter();
  const { profile, loadProfile } = useAuth();
  
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!profile) return null;

  const aadhaar = profile.documents?.find(d => d.documentType === 'AADHAAR');
  const pan = profile.documents?.find(d => d.documentType === 'PAN');

  const handleCapture = async (documentType: string) => {
    try {
      setError('');
      const permissions = await CapacitorCamera.checkPermissions();
      if (permissions.camera !== 'granted') {
        const requested = await CapacitorCamera.requestPermissions({ permissions: ['camera'] });
        if (requested.camera !== 'granted') {
          setError('Camera permission is required to capture documents.');
          return;
        }
      }

      const image = await CapacitorCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera,
      });

      if (image.base64String) {
        setUploadingDoc(documentType);
        const dataUrl = `data:image/${image.format};base64,${image.base64String}`;
        await profileService.uploadDocument(documentType, dataUrl);
        await loadProfile();
      }
    } catch (e: any) {
      console.error(`Failed to capture ${documentType}`, e);
      const errMsg = e.response?.data?.message || e.message || 'An error occurred during upload.';
      setError(errMsg);
    } finally {
      setUploadingDoc(null);
    }
  };

  const renderDocumentCard = (title: string, type: 'AADHAAR' | 'PAN', doc: any) => {
    const status = doc?.status || 'NOT_SUBMITTED';
    const isVerified = status === 'VERIFIED';
    const isPending = status === 'PENDING';
    const isRejected = status === 'REJECTED';
    const isUploading = uploadingDoc === type;

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="font-bold text-gray-800">{title}</h2>
          <StatusBadge status={status} />
        </div>
        
        <div className="p-4">
          {doc?.documentUrl && (
            <div className="mb-4 relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center h-48">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={doc.documentUrl} alt={title} className="object-contain w-full h-full" />
            </div>
          )}

          {isRejected && doc?.rejectionReason && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800 mb-0.5">Verification Rejected</p>
                <p className="text-xs text-red-600">{doc.rejectionReason}</p>
              </div>
            </div>
          )}

          {!isVerified && !isPending && (
            <Button
              variant={isRejected ? 'primary' : 'outline'}
              fullWidth
              isLoading={isUploading}
              onClick={() => handleCapture(type)}
              className={isRejected ? '' : 'border-dashed border-2 border-gray-300 text-gray-600 hover:border-primary hover:text-primary'}
            >
              <Camera className="w-4 h-4 mr-2" />
              {isRejected ? 'Retake Document' : 'Capture Document'}
            </Button>
          )}

          {isPending && (
            <p className="text-sm text-center text-gray-500 italic">
              Your document is currently under review by our team.
            </p>
          )}
          
          {isVerified && (
            <p className="text-sm text-center text-green-600 font-medium">
              Document has been successfully verified.
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center sticky top-0 z-10 shadow-sm">
        <button 
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
          <ChevronLeft className="h-6 w-6 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 ml-2">Document Verification</h1>
      </div>

      <div className="p-6 pb-12 overflow-y-auto">
        <p className="text-gray-600 text-sm mb-6 leading-relaxed">
          Please upload clear, legible photos of your identity documents. Verification usually takes 24-48 hours.
        </p>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm text-center font-medium">
            {error}
          </div>
        )}

        {renderDocumentCard('Aadhaar Card', 'AADHAAR', aadhaar)}
        {renderDocumentCard('PAN Card', 'PAN', pan)}
      </div>
    </div>
  );
}

