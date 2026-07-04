'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useUser } from '@/firebase/provider';
import { useToast } from '@/hooks/use-toast';
import { handleError, getErrorTitle } from '@/lib/error-handling';
import { Download, Upload, AlertCircle, CheckCircle, Database } from 'lucide-react';
import { useConfirmation } from '@/components/ui/confirmation-dialog';
import {
  createBackup,
  downloadBackup,
  restoreBackup,
  parseBackupFile,
  createAutoBackupBeforeRestore,
  BackupData,
} from '@/lib/backup-utils';
import { formatDateTime } from '@/lib/date-utils';

export default function BackupPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const { confirm, dialog: confirmationDialog } = useConfirmation();

  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreMessage, setRestoreMessage] = useState('');
  const [backupPreview, setBackupPreview] = useState<BackupData | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Create and download backup
  const handleCreateBackup = async () => {
    if (!user) {
      toast({
        title: 'خطأ',
        description: 'يجب تسجيل الدخول أولاً',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingBackup(true);

    try {
      toast({
        title: 'جاري إنشاء النسخة الاحتياطية...',
        description: 'قد تستغرق هذه العملية بضع ثوانٍ',
      });

      const backup = await createBackup(user.uid);
      downloadBackup(backup);

      toast({
        title: 'تم إنشاء النسخة الاحتياطية بنجاح! ✓',
        description: `تم حفظ ${backup.metadata.totalDocuments} مستند`,
      });
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: 'destructive',
      });
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) { return; }

    setSelectedFile(file);

    try {
      const backupData = await parseBackupFile(file);
      setBackupPreview(backupData);

      toast({
        title: 'تم قراءة الملف بنجاح',
        description: `يحتوي على ${backupData.metadata.totalDocuments} مستند`,
      });
    } catch (error) {
      setBackupPreview(null);
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: 'destructive',
      });
    }
  };

  // Restore from backup
  const handleRestore = (mode: 'replace' | 'merge') => {
    if (!user || !backupPreview) { return; }

    const title = mode === 'replace' ? 'استبدال البيانات' : 'دمج البيانات';
    const message = mode === 'replace'
      ? 'تحذير: سيتم استبدال جميع البيانات الحالية. سيتم إنشاء نسخة احتياطية تلقائية قبل الاستعادة. هل أنت متأكد؟'
      : 'سيتم دمج البيانات مع البيانات الحالية. سيتم إنشاء نسخة احتياطية تلقائية قبل الاستعادة. هل تريد المتابعة؟';
    const variant = mode === 'replace' ? 'destructive' : 'warning';

    confirm(
      title,
      message,
      async () => {
        setIsRestoring(true);
        setRestoreProgress(0);
        setRestoreMessage('جاري إنشاء نسخة احتياطية تلقائية...');

        try {
          // Create auto-backup before restore
          await createAutoBackupBeforeRestore(user.uid);

          toast({
            title: 'تم إنشاء نسخة احتياطية تلقائية',
            description: 'تم حفظ نسخة من بياناتك الحالية قبل الاستعادة',
          });

          setRestoreMessage('جاري الاستعادة...');

          const restoreResult = await restoreBackup(
            backupPreview,
            user.uid,
            mode,
            (progress, progressMessage) => {
              setRestoreProgress(progress);
              setRestoreMessage(progressMessage);
            }
          );

          if (restoreResult.warning?.kind === 'unbalanced-books') {
            // Scale-hardening Tier-1 Fix 3: the write layer succeeded but the
            // post-restore trial balance is off. Data is in the DB — the user
            // just needs to know the books don't balance before they trust it.
            const { totalDebits, totalCredits, difference } = restoreResult.warning;
            toast({
              title: 'تحذير: تمت الاستعادة، لكن الميزان غير متوازن',
              description:
                `الاستعادة اكتملت لكن مجموع المدين (${totalDebits.toFixed(2)}) لا يساوي مجموع الدائن (${totalCredits.toFixed(2)}). ` +
                `الفرق: ${difference.toFixed(2)}. يُرجى مراجعة دفتر اليومية قبل الاعتماد على البيانات.`,
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'تمت الاستعادة بنجاح!',
              description: 'تم استعادة جميع البيانات',
            });
          }

          // Clear preview after successful restore
          setBackupPreview(null);
          setSelectedFile(null);
          setRestoreProgress(0);
          setRestoreMessage('');

          // Reload page to show new data
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } catch (error) {
          const appError = handleError(error);
          toast({
            title: getErrorTitle(appError),
            description: appError.message,
            variant: 'destructive',
          });
        } finally {
          setIsRestoring(false);
        }
      },
      variant as "destructive" | "warning"
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">النسخ الاحتياطي والاستعادة</h1>
        <p className="text-gray-600 mt-2">احمِ بياناتك بإنشاء نسخ احتياطية منتظمة</p>
      </div>

      {/* Backup Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            إنشاء نسخة احتياطية
          </CardTitle>
          <CardDescription>
            قم بتنزيل نسخة احتياطية كاملة من جميع بياناتك (الحركات المالية، المدفوعات، الشيكات، المخزون، وغيرها)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900">
              يُنصح بإنشاء نسخة احتياطية أسبوعياً على الأقل. احتفظ بالنسخ في مكان آمن خارج الخادم.
            </AlertDescription>
          </Alert>

          <Button
            onClick={handleCreateBackup}
            disabled={isCreatingBackup || !user}
            size="lg"
            className="w-full sm:w-auto"
          >
            <Download className="w-4 h-4 ml-2" />
            {isCreatingBackup ? 'جاري الإنشاء...' : 'تنزيل نسخة احتياطية'}
          </Button>
        </CardContent>
      </Card>

      {/* Restore Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            استعادة من نسخة احتياطية
          </CardTitle>
          <CardDescription>
            قم برفع ملف نسخة احتياطية سابقة لاستعادة بياناتك
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-900">
              تحذير: استعادة البيانات قد تستبدل أو تدمج مع البيانات الحالية. تأكد من رفع الملف الصحيح.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            {/* File Upload */}
            <div>
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                disabled={isRestoring}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  cursor-pointer"
              />
            </div>

            {/* Backup Preview */}
            {backupPreview && (
              <div className="bg-gray-50 p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold">تفاصيل النسخة الاحتياطية</h3>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">التاريخ:</span>{' '}
                    <span className="font-medium">
                      {formatDateTime(backupPreview.metadata.createdAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">عدد المستندات:</span>{' '}
                    <span className="font-medium">{backupPreview.metadata.totalDocuments}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">المجموعات:</span>{' '}
                    <span className="font-medium">{backupPreview.metadata.collections.join(', ')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Restore Progress */}
            {isRestoring && (
              <div className="space-y-2">
                <Progress value={restoreProgress} className="w-full" />
                <p className="text-sm text-gray-600 text-center">{restoreMessage}</p>
              </div>
            )}

            {/* Restore Buttons */}
            {backupPreview && !isRestoring && (
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() => handleRestore('merge')}
                  disabled={!user}
                  variant="default"
                >
                  دمج مع البيانات الحالية
                </Button>
                <Button
                  onClick={() => handleRestore('replace')}
                  disabled={!user}
                  variant="destructive"
                >
                  استبدال البيانات الحالية
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Information Section */}
      <Card className="mt-6 border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="text-lg">💡 نصائح مهمة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>• قم بإنشاء نسخ احتياطية منتظمة (يومية أو أسبوعية)</p>
          <p>• احتفظ بالنسخ في أماكن متعددة (السحابة، قرص خارجي)</p>
          <p>• تأكد من اختبار الاستعادة بشكل دوري للتأكد من صلاحية النسخ</p>
          <p>• استخدام &quot;دمج&quot; آمن ولا يحذف البيانات الحالية</p>
          <p>• استخدام &quot;استبدال&quot; يحذف البيانات الحالية ويستبدلها بالنسخة الاحتياطية</p>
          <p>• يتم إنشاء نسخة احتياطية تلقائية قبل كل عملية استعادة لحماية بياناتك</p>
        </CardContent>
      </Card>

      {confirmationDialog}
    </div>
  );
}
