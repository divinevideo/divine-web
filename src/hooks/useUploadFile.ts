import { useMutation } from "@tanstack/react-query";
import { BlossomUploader } from '@nostrify/nostrify/uploaders';

import { useCurrentUser } from "./useCurrentUser";

export function useUploadFile() {
  const { signer } = useCurrentUser();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!signer) {
        throw new Error('Must be logged in to upload files');
      }

      const uploader = new BlossomUploader({
        servers: [
          'https://blossom.divine.video/',
        ],
        signer,
      });

      const tags = await uploader.upload(file);
      return tags;
    },
  });
}
