import api from '../api';

export const profileService = {
  uploadDocument: async (documentType: string, documentUrl: string) => {
    const response = await api.post('/auth/mobile/documents', {
      documentType,
      documentUrl,
    });
    return response.data.data;
  },

  updateProfileImage: async (profileImage: string) => {
    const response = await api.patch('/auth/mobile/profile-image', {
      profileImage,
    });
    return response.data.data;
  },
};

