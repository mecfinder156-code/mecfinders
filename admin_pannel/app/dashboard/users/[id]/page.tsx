'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usersApi, type User, type UserDocument } from '@/lib/api';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { 
  ChevronLeft, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User as UserIcon, 
  Phone, 
  Mail, 
  Calendar,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import Link from 'next/link';

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  // Replace manual state fetching with SWR
  const swrKey = id ? `/admin/users/${id}` : null;
  const { data, error, mutate, isLoading } = useSWR(swrKey, fetcher);
  
  const user = data?.data?.user;
  const vehicles = data?.data?.vehicles || [];
  const addresses = data?.data?.addresses || [];
  const errorMessage = error?.response?.data?.message || error?.message;

  const [rejectingDoc, setRejectingDoc] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const handleVerify = async (docType: string) => {
    if (!confirm(`Are you sure you want to verify the ${docType} document?`)) return;
    try {
      setActionLoading(true);
      await usersApi.verifyDocument(id, docType);
      mutate();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to verify document.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (docType: string) => {
    if (!rejectReason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    try {
      setActionLoading(true);
      await usersApi.rejectDocument(id, docType, rejectReason);
      setRejectingDoc(null);
      setRejectReason('');
      mutate();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to reject document.');
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-gray-500 animate-pulse text-lg">Loading user details...</div>
      </div>
    );
  }

  if (errorMessage || !user) {
    return (
      <div className="p-6">
        <button onClick={() => router.back()} className="mb-6 flex items-center text-gray-500 hover:text-gray-800">
          <ChevronLeft className="w-5 h-5 mr-1" /> Back
        </button>
        <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-100 flex items-center shadow-sm">
          <XCircle className="w-6 h-6 mr-3" />
          <span className="font-medium text-lg">{errorMessage || 'User not found'}</span>
        </div>
      </div>
    );
  }

  const isFullyVerified = user.documents?.every((doc: any) => doc.status === 'VERIFIED');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header / Back */}
      <div className="mb-6">
        <Link href="/dashboard/users" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Users
        </Link>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8 mb-8 relative overflow-hidden">
        {/* Verification Status Banner */}
        <div className="absolute top-0 right-0 p-4">
          {isFullyVerified && user.documents?.length ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 text-green-700 text-sm font-semibold border border-green-200 shadow-sm">
              <ShieldCheck className="w-4 h-4" />
              Verified User
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-50 text-yellow-700 text-sm font-semibold border border-yellow-200 shadow-sm">
              <ShieldAlert className="w-4 h-4" />
              Verification Pending
            </span>
          )}
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 mt-4">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gray-50 flex items-center justify-center overflow-hidden border-2 border-gray-100 shadow-sm shrink-0">
            {user.profileImage ? (
              <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-12 h-12 md:w-16 md:h-16 text-gray-300" />
            )}
          </div>
          
          <div className="flex-1 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{user.name}</h1>
                <div className="flex items-center gap-3 mt-2 text-sm">
                  <span className="px-3 py-1 rounded-full font-medium bg-gray-100 text-gray-800 capitalize">
                    {user.role}
                  </span>
                  <span className={`px-3 py-1 rounded-full font-medium flex items-center gap-1.5 ${user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-green-600' : 'bg-red-600'}`}></span>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600 mt-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-gray-200">
                  <Mail className="w-4 h-4 text-gray-500" />
                </div>
                <span className="font-medium text-gray-900">{user.email}</span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-gray-200">
                  <Phone className="w-4 h-4 text-gray-500" />
                </div>
                <span className="font-medium text-gray-900">{user.phone || 'No phone'}</span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-gray-200">
                  <UserIcon className="w-4 h-4 text-gray-500" />
                </div>
                <span className="font-medium text-gray-900">
                  {user.gender || 'Not specified'} {user.age ? `• ${user.age} yrs` : ''}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-gray-200">
                  <Calendar className="w-4 h-4 text-gray-500" />
                </div>
                <span className="font-medium text-gray-900">
                  Joined {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Documents Section */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Identity Documents</h2>
        <span className="text-sm font-medium text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
          {user.documents?.length || 0} Documents Uploaded
        </span>
      </div>
      
      {(!user.documents || user.documents.length === 0) ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">No Documents</h3>
          <p className="text-gray-500 max-w-sm mx-auto">This user has not uploaded any identity documents yet. Verification cannot be completed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {user.documents.map((doc: UserDocument) => (
            <div key={doc._id} className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden transition-all hover:shadow-md">
              <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-gray-200 shadow-sm">
                    <span className="font-bold text-gray-700">{doc.documentType.charAt(0)}</span>
                  </div>
                  <h3 className="font-bold text-gray-900 tracking-tight">{doc.documentType}</h3>
                </div>
                
                <div>
                  {doc.status === 'VERIFIED' && (
                    <span className="flex items-center text-green-700 text-sm font-semibold bg-green-50 px-3 py-1.5 rounded-full border border-green-100 shadow-sm">
                      <CheckCircle className="w-4 h-4 mr-1.5" />
                      Verified
                    </span>
                  )}
                  {doc.status === 'REJECTED' && (
                    <span className="flex items-center text-red-700 text-sm font-semibold bg-red-50 px-3 py-1.5 rounded-full border border-red-100 shadow-sm">
                      <XCircle className="w-4 h-4 mr-1.5" />
                      Rejected
                    </span>
                  )}
                  {doc.status === 'PENDING' && (
                    <span className="flex items-center text-yellow-700 text-sm font-semibold bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-100 shadow-sm">
                      <Clock className="w-4 h-4 mr-1.5" />
                      Needs Review
                    </span>
                  )}
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col">
                <a 
                  href={doc.documentUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="block w-full h-56 bg-gray-100 rounded-xl overflow-hidden border border-gray-200 mb-5 group relative cursor-zoom-in"
                >
                  <img src={doc.documentUrl} alt={`${doc.documentType} document`} className="w-full h-full object-contain" />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-[1px]">
                    <span className="text-white font-medium bg-black/40 px-4 py-2 rounded-lg backdrop-blur-md border border-white/20">Click to enlarge</span>
                  </div>
                </a>

                {doc.status === 'REJECTED' && doc.rejectionReason && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                    <h4 className="text-sm font-bold text-red-800 mb-1 flex items-center gap-1.5">
                      <XCircle className="w-4 h-4" /> Rejection Reason
                    </h4>
                    <p className="text-sm text-red-700 mb-2">{doc.rejectionReason}</p>
                    <p className="text-xs text-red-600 font-medium bg-white/60 inline-block px-2 py-1 rounded-md">Waiting for user re-upload</p>
                  </div>
                )}
                
                {doc.status === 'VERIFIED' && doc.verifiedAt && (
                  <div className="mb-4 p-4 bg-green-50 border border-green-100 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-green-800">Successfully verified</p>
                        <p className="text-xs text-green-600">{new Date(doc.verifiedAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}

                {doc.status === 'PENDING' && (
                  <div className="mt-auto">
                    {rejectingDoc === doc.documentType ? (
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Why is this being rejected?</label>
                        <textarea
                          className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all resize-none shadow-sm"
                          rows={3}
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="E.g., Image is blurry, name does not match profile..."
                          autoFocus
                        />
                        <div className="flex justify-end gap-3 mt-3">
                          <button
                            onClick={() => {
                              setRejectingDoc(null);
                              setRejectReason('');
                            }}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 bg-gray-100 rounded-lg transition-colors"
                            disabled={actionLoading}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleReject(doc.documentType)}
                            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors shadow-sm"
                            disabled={actionLoading}
                          >
                            {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleVerify(doc.documentType)}
                          disabled={actionLoading}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-xl font-semibold transition-all disabled:opacity-50 flex justify-center items-center shadow-sm hover:shadow-md"
                        >
                          <CheckCircle className="w-5 h-5 mr-2" />
                          Verify Document
                        </button>
                        <button
                          onClick={() => {
                            setRejectingDoc(doc.documentType);
                            setRejectReason('');
                          }}
                          disabled={actionLoading}
                          className="flex-1 bg-white hover:bg-red-50 text-red-600 border border-gray-200 hover:border-red-200 py-3 px-4 rounded-xl font-semibold transition-all disabled:opacity-50 flex justify-center items-center shadow-sm hover:shadow-md"
                        >
                          <XCircle className="w-5 h-5 mr-2" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vehicles Section */}
      <div className="flex items-center justify-between mb-6 mt-8">
        <h2 className="text-xl font-bold text-gray-900">Vehicles</h2>
        <span className="text-sm font-medium text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
          {vehicles?.length || 0} Saved
        </span>
      </div>
      
      {vehicles?.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
          <p className="text-gray-500">No vehicles saved by this user.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {vehicles?.map((vehicle: any) => (
            <div key={vehicle._id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{vehicle.nickname || `${vehicle.make} ${vehicle.model}`}</h3>
                  <p className="text-sm text-gray-500">{vehicle.make} {vehicle.model} ({vehicle.year})</p>
                  <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">{vehicle.registrationNumber}</p>
                </div>
                {vehicle.isDefault && (
                  <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-lg whitespace-nowrap">
                    Default
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Addresses Section */}
      <div className="flex items-center justify-between mb-6 mt-8">
        <h2 className="text-xl font-bold text-gray-900">Addresses</h2>
        <span className="text-sm font-medium text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200">
          {addresses?.length || 0} Saved
        </span>
      </div>
      
      {addresses?.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
          <p className="text-gray-500">No addresses saved by this user.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-12">
          {addresses?.map((address: any) => (
            <div key={address._id} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg uppercase tracking-wider">
                    {address.label}
                  </span>
                  {address.isDefault && (
                    <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-lg whitespace-nowrap">
                      Default
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-1">{address.addressLine1}</p>
              {address.landmark && <p className="text-xs text-gray-500 mb-1">Landmark: {address.landmark}</p>}
              <p className="text-sm text-gray-600">{address.city}, {address.state} {address.postalCode}</p>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
