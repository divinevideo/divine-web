import React, { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CircleNotch as Loader2, UploadSimple as Upload } from '@phosphor-icons/react';
import { NSchema as n, type NostrMetadata } from '@nostrify/nostrify';
import { useQueryClient } from '@tanstack/react-query';
import { useUploadFile } from '@/hooks/useUploadFile';

interface EditProfileFormProps {
  onSuccess?: () => void;
}

export const EditProfileForm: React.FC<EditProfileFormProps> = ({ onSuccess }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { user, metadata } = useCurrentUser();
  const authorQuery = useAuthor(user?.pubkey);
  const { mutateAsync: publishEvent, isPending } = useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { toast } = useToast();

  // Initialize the form with default values
  const form = useForm<NostrMetadata>({
    resolver: zodResolver(n.metadata()),
    defaultValues: {
      name: '',
      about: '',
      picture: '',
      banner: '',
      website: '',
      nip05: '',
      bot: false,
    },
  });

  // Update form values when user data is loaded
  useEffect(() => {
    if (metadata) {
      form.reset({
        name: metadata.name || '',
        about: metadata.about || '',
        picture: metadata.picture || '',
        banner: metadata.banner || '',
        website: metadata.website || '',
        nip05: metadata.nip05 || '',
        bot: metadata.bot || false,
      });
    }
  }, [metadata, form]);

  // Handle file uploads for profile picture and banner
  const uploadPicture = async (file: File, field: 'picture' | 'banner') => {
    try {
      // The first tuple in the array contains the URL
      const [[_, url]] = await uploadFile(file);
      form.setValue(field, url);
      toast({
        title: t('editProfileForm.uploadSuccessTitle'),
        description: field === 'picture'
          ? t('editProfileForm.uploadSuccessPictureDescription')
          : t('editProfileForm.uploadSuccessBannerDescription'),
      });
    } catch (error) {
      console.error(`Failed to upload ${field}:`, error);
      toast({
        title: t('editProfileForm.uploadErrorTitle'),
        description: field === 'picture'
          ? t('editProfileForm.uploadErrorPictureDescription')
          : t('editProfileForm.uploadErrorBannerDescription'),
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (values: NostrMetadata) => {
    if (!user) {
      toast({
        title: t('editProfileForm.loginRequiredTitle'),
        description: t('editProfileForm.loginRequiredDescription'),
        variant: 'destructive',
      });
      return;
    }

    if (!authorQuery.isSuccess) {
      toast({
        title: t('editProfileForm.loadingErrorTitle'),
        description: t('editProfileForm.loadingErrorDescription'),
        variant: 'destructive',
      });
      return;
    }

    try {
      // Combine existing metadata with new values
      const data = { ...metadata, ...values };

      // Add client tag to identify divine users
      // This helps with follow list safety checks
      data.client = 'divine.video';

      // Keep display_name in sync with name to prevent stale values from other clients
      if (data.name) {
        data.display_name = data.name;
      } else {
        delete data.display_name;
      }

      // Clean up empty values
      for (const key in data) {
        if (data[key] === '') {
          delete data[key];
        }
      }

      // Publish the metadata event (kind 0)
      await publishEvent({
        kind: 0,
        content: JSON.stringify(data),
      });

      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['logins'] });
      queryClient.invalidateQueries({ queryKey: ['author', user.pubkey] });
      queryClient.invalidateQueries({ queryKey: ['follow-list-safety-check'] });

      toast({
        title: t('editProfileForm.saveSuccessTitle'),
        description: t('editProfileForm.saveSuccessDescription'),
      });

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast({
        title: t('editProfileForm.saveErrorTitle'),
        description: t('editProfileForm.saveErrorDescription'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('editProfileForm.nameLabel')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('editProfileForm.namePlaceholder')} {...field} />
                </FormControl>
                <FormDescription>
                  {t('editProfileForm.nameDescription')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="picture"
            render={({ field }) => (
              <ImageUploadField
                field={field}
                label={t('editProfileForm.pictureLabel')}
                placeholder={t('editProfileForm.picturePlaceholder')}
                description={t('editProfileForm.pictureDescription')}
                previewType="square"
                uploadButtonLabel={t('editProfileForm.uploadImageButton')}
                previewAltLabel={t('editProfileForm.previewAlt', { label: t('editProfileForm.pictureLabel') })}
                onUpload={(file) => uploadPicture(file, 'picture')}
              />
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="about"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('editProfileForm.bioLabel')}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t('editProfileForm.bioPlaceholder')}
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {t('editProfileForm.bioDescription')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('editProfileForm.websiteLabel')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('editProfileForm.websitePlaceholder')} {...field} />
                </FormControl>
                <FormDescription>
                  {t('editProfileForm.websiteDescription')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="nip05"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('editProfileForm.nip05Label')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('editProfileForm.nip05Placeholder')} {...field} />
                </FormControl>
                <FormDescription>
                  {t('editProfileForm.nip05Description')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button
          type="submit"
          variant="sticker"
          className="w-full md:w-auto"
          disabled={isPending || isUploading || !authorQuery.isSuccess}
        >
          {(isPending || isUploading || authorQuery.isPending) && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {t('editProfileForm.saveButton')}
        </Button>
        {authorQuery.isError && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-destructive">
              {t('editProfileForm.loadingErrorDescription')}
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full md:w-auto"
              onClick={() => void authorQuery.refetch()}
              disabled={authorQuery.isPending || isPending || isUploading}
            >
              {t('editProfileForm.retryLoadingProfile')}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
};

// Reusable component for image upload fields
interface ImageUploadFieldProps {
  field: {
    value: string | undefined;
    onChange: (value: string) => void;
    name: string;
    onBlur: () => void;
  };
  label: string;
  placeholder: string;
  description: string;
  previewType: 'square' | 'wide';
  uploadButtonLabel: string;
  previewAltLabel: string;
  onUpload: (file: File) => void;
}

const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  field,
  label,
  placeholder,
  description,
  previewType,
  uploadButtonLabel,
  previewAltLabel,
  onUpload,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <div className="flex flex-col gap-2">
        <FormControl>
          <Input
            placeholder={placeholder}
            name={field.name}
            value={field.value ?? ''}
            onChange={e => field.onChange(e.target.value)}
            onBlur={field.onBlur}
          />
        </FormControl>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onUpload(file);
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploadButtonLabel}
          </Button>
          {field.value && (
            <div className={`h-10 ${previewType === 'square' ? 'w-10' : 'w-24'} rounded overflow-hidden`}>
              <img
                src={field.value}
                alt={previewAltLabel}
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </div>
      </div>
      <FormDescription>
        {description}
      </FormDescription>
      <FormMessage />
    </FormItem>
  );
};
