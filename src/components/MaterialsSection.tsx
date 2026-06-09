import { useRef, useState, type ChangeEvent } from 'react';
import { useTeam } from '@/context/TeamContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, Trash2, FileText, Download } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { t, tr } from '@/lib/i18n';
import { useNotifications } from '@/context/NotificationContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import {
  createSignedFileUrl,
  deleteStorageFile,
  uploadTeamFile,
  validateStorageFile,
} from '@/lib/storage';

interface Props {
  role: 'student' | 'lecturer';
  uploaderName: string;
}

const MaterialsSection = ({ uploaderName }: Props) => {
  const {
    groups,
    currentGroupIndex,
    members,
    materials,
    addStoredMaterial,
    deleteStoredMaterial,
  } = useTeam();
  const { user } = useAuth();
  const { toast } = useToast();
  const { sendNotification } = useNotifications();
  const fileRef = useRef<HTMLInputElement>(null);
  const { language } = useLanguage();
  const [notifyTeam, setNotifyTeam] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const currentGroup = groups[currentGroupIndex];
  const isProjectLeader = Boolean(user?.id && members.some(m => m.id === user.id && m.role === "Leader"));

  const handleChooseFile = () => {
    fileRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      toast({ title: tr(language, 'Lỗi', 'Error'), description: tr(language, 'Vui lòng chọn file', 'Please choose a file'), variant: 'destructive' });
      return;
    }

    if (!currentGroup?.id || !user?.id) {
      toast({
        title: tr(language, 'Lỗi', 'Error'),
        description: tr(language, 'Vui lòng đăng nhập và chọn dự án trước khi tải file', 'Please sign in and select a project before uploading'),
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }

    const validation = validateStorageFile("materials", file);
    if (!validation.valid) {
      toast({
        title: validation.reason === "size" ? tr(language, 'Lỗi kích thước', 'Size Error') : tr(language, 'Định dạng không hỗ trợ', 'Unsupported file type'),
        description: validation.message,
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }

    setUploading(true);
    let uploadedPath: string | null = null;
    try {
      const uploaded = await uploadTeamFile("materials", currentGroup.id, user.id, file);
      uploadedPath = uploaded.path;

      await addStoredMaterial({
        fileName: uploaded.fileName,
        size: uploaded.size,
        uploadedBy: uploaderName,
        uploadedById: user.id,
        storagePath: uploaded.path,
        storageBucket: "materials",
      });

      if (notifyTeam) {
        members
          .filter(m => m.id !== user.id)
          .forEach(member => {
            void sendNotification(
              member.id || member.name,
              uploaderName,
              tr(
                language,
                `Đã tải lên tài liệu mới: "${uploaded.fileName}"`,
                `Uploaded a new document: "${uploaded.fileName}"`
              )
            );
          });
      }

      toast({ title: tr(language, 'Đã upload', 'Uploaded'), description: `"${uploaded.fileName}" ${tr(language, 'đã được tải lên', 'has been uploaded')}` });
      setNotifyTeam(false);
    } catch (error) {
      if (uploadedPath) {
        void deleteStorageFile("materials", uploadedPath);
      }
      toast({
        title: tr(language, 'Upload thất bại', 'Upload failed'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDownload = async (f: typeof materials[0]) => {
    if (!f.storagePath) {
      toast({
        title: tr(language, 'Không có file', 'File unavailable'),
        description: tr(language, 'Tài liệu cũ này chỉ có metadata, không có file để tải xuống.', 'This legacy material only has metadata and no downloadable file.'),
        variant: 'destructive',
      });
      return;
    }

    setDownloadingId(f.id);
    try {
      const signedUrl = await createSignedFileUrl(f.storageBucket ?? "materials", f.storagePath);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast({
        title: tr(language, 'Tải xuống thất bại', 'Download failed'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (f: typeof materials[0]) => {
    setDeletingId(f.id);
    try {
      await deleteStoredMaterial(f);
      toast({
        title: tr(language, 'Đã xóa', 'Deleted'),
        description: `"${f.fileName}" ${tr(language, 'đã bị xóa', 'has been removed')}`,
      });
    } catch (error) {
      toast({
        title: tr(language, 'Xóa thất bại', 'Delete failed'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="bg-card rounded-xl p-6 shadow-card border border-border">
      <h2 className="font-display text-lg font-semibold mb-4">
        <FileText className="h-5 w-5 inline mr-1" />
        {tr(language, 'Tài liệu / Tài liệu học phần', 'Materials / Course Documents')}
      </h2>

      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <input
          type="file"
          ref={fileRef}
          accept=".pdf,.pptx,.ppt,.docx,.doc,.xlsx,.xls,.txt,.csv,.zip"
          className="hidden"
          onChange={(event) => void handleFileChange(event)}
        />
        <Button size="sm" onClick={handleChooseFile} disabled={uploading}>
          <Upload className="h-4 w-4 mr-1" /> {t(language, 'uploadMaterial')}
        </Button>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="materialNotifyTeam"
            checked={notifyTeam}
            onCheckedChange={(checked) => setNotifyTeam(!!checked)}
          />
          <Label htmlFor="materialNotifyTeam" className="text-xs sm:text-sm font-medium leading-none cursor-pointer">
            {tr(language, "Thông báo cho thành viên nhóm", "Notify team members")}
          </Label>
        </div>
      </div>

      {materials.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-2 font-medium">{tr(language, 'Tên file', 'File name')}</th>
                <th className="text-left px-4 py-2 font-medium">{tr(language, 'Kích thước', 'Size')}</th>
                <th className="text-left px-4 py-2 font-medium">{tr(language, 'Người tải', 'Uploaded by')}</th>
                <th className="text-left px-4 py-2 font-medium">{tr(language, 'Thời gian', 'Time')}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {materials.map(f => (
                <tr key={f.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {f.fileName}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</td>
                  <td className="px-4 py-2 text-muted-foreground">{f.uploadedBy}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {f.uploadTime.toLocaleDateString('vi-VN')} {f.uploadTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleDownload(f)}
                        disabled={downloadingId === f.id}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      {(isProjectLeader || f.uploadedById === user?.id) && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => void handleDelete(f)}
                          disabled={deletingId === f.id}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm text-center py-4">{tr(language, 'Chưa có tài liệu nào', 'No materials yet')}</p>
      )}
    </section>
  );
};

export default MaterialsSection;
