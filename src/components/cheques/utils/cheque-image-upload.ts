import { ref, uploadBytes, getDownloadURL, StorageError } from 'firebase/storage';
import { storage } from '@/firebase/config';
import { sanitizeFileName } from '@/lib/utils';

/**
 * Error codes for image upload failures
 */
export type ImageUploadErrorCode = 'unauthorized' | 'canceled' | 'quota-exceeded' | 'unknown';

/**
 * Result of a cheque image upload operation
 */
export type ImageUploadResult =
  | { success: true; url: string }
  | { success: false; errorCode: ImageUploadErrorCode };

/**
 * Upload a cheque image to Firebase Storage
 *
 * This is a pure utility function that handles image upload without
 * any UI dependencies (toast, etc). The caller is responsible for
 * displaying appropriate error messages based on the result.
 *
 * @param userId - The data owner's user ID (user.dataOwnerId)
 * @param chequeImage - The image file to upload
 * @returns Promise<ImageUploadResult> - Success with URL, or failure with error code
 */
export async function uploadChequeImage(
  userId: string,
  chequeImage: File
): Promise<ImageUploadResult> {
  try {
    const sanitizedName = sanitizeFileName(chequeImage.name);
    const imageRef = ref(
      storage,
      `users/${userId}/cheques/${Date.now()}_${sanitizedName}`
    );
    await uploadBytes(imageRef, chequeImage);
    const url = await getDownloadURL(imageRef);
    return { success: true, url };
  } catch (uploadError) {
    if (uploadError instanceof StorageError) {
      const errorCode = uploadError.code;
      if (errorCode === 'storage/unauthorized' || errorCode === 'storage/unauthenticated') {
        return { success: false, errorCode: 'unauthorized' };
      } else if (errorCode === 'storage/canceled') {
        return { success: false, errorCode: 'canceled' };
      } else if (errorCode === 'storage/quota-exceeded') {
        return { success: false, errorCode: 'quota-exceeded' };
      }
    }
    // Re-throw unknown errors
    throw uploadError;
  }
}

/**
 * Get localized error message for image upload failures
 *
 * @param errorCode - The error code from ImageUploadResult
 * @returns Object with title and description for toast
 */
export function getImageUploadErrorMessage(errorCode: ImageUploadErrorCode): {
  title: string;
  description: string;
} {
  switch (errorCode) {
    case 'unauthorized':
      return {
        title: "خطأ في الصلاحيات",
        description: "ليس لديك صلاحية لرفع الصور. يرجى التأكد من تسجيل الدخول والمحاولة مرة أخرى",
      };
    case 'canceled':
      return {
        title: "تم الإلغاء",
        description: "تم إلغاء رفع الصورة",
      };
    case 'quota-exceeded':
      return {
        title: "خطأ في التخزين",
        description: "تم تجاوز الحد المسموح به للتخزين",
      };
    default:
      return {
        title: "خطأ في رفع الصورة",
        description: "حدث خطأ غير متوقع أثناء رفع الصورة",
      };
  }
}
