import { useRef, type ChangeEvent } from 'react';
import { useTeam } from '@/context/TeamContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, Trash2, FileText, Download } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { t, tr } from '@/lib/i18n';

interface Props {
  role: 'student' | 'lecturer';
  uploaderName: string;
}

const MaterialsSection = ({ role, uploaderName }: Props) => {
  const { materials, addMaterial, deleteMaterial } = useTeam();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const { language } = useLanguage();

  const handleChooseFile = () => {
    fileRef.current?.click();
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      toast({ title: tr(language, 'Lỗi', 'Error'), description: tr(language, 'Vui lòng chọn file', 'Please choose a file'), variant: 'destructive' });
      return;
    }
    // Limit file size to 50 MB
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: tr(language, 'Lỗi kích thước', 'Size Error'),
        description: tr(language, 'Dung lượng file tối đa là 50MB', 'Max file size is 50MB'),
        variant: 'destructive',
      });
      e.target.value = '';
      return;
    }
    // Sanitize filename to prevent directory traversal and handle weird characters safely
    let cleanName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    if (cleanName.length > 100) {
      const parts = cleanName.split('.');
      const ext = parts.length > 1 ? parts.pop() : '';
      const base = parts.join('.');
      cleanName = base.substring(0, 95 - (ext ? ext.length + 1 : 0)) + (ext ? '.' + ext : '');
    }
    addMaterial({ fileName: cleanName, size: file.size, uploadedBy: uploaderName });
    toast({ title: tr(language, 'Đã upload', 'Uploaded'), description: `"${cleanName}" ${tr(language, 'đã được tải lên', 'has been uploaded')}` });
    e.target.value = '';
  };

  const handleDownload = (f: typeof materials[0]) => {
    toast({ title: tr(language, 'Tải xuống', 'Downloading'), description: tr(language, `Đang tải "${f.fileName}"...`, `Downloading "${f.fileName}"...`) });
  };

  return (
    <section className="bg-card rounded-xl p-6 shadow-card border border-border">
      <h2 className="font-display text-lg font-semibold mb-4">
        <FileText className="h-5 w-5 inline mr-1" />
        {tr(language, 'Tài liệu / Tài liệu học phần', 'Materials / Course Documents')}
      </h2>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          type="file"
          ref={fileRef}
          accept=".pdf,.pptx,.ppt,.docx,.doc,.xlsx,.xls,.txt"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button size="sm" onClick={handleChooseFile}>
          <Upload className="h-4 w-4 mr-1" /> {t(language, 'uploadMaterial')}
        </Button>
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
                      <Button size="sm" variant="ghost" onClick={() => handleDownload(f)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      {role === 'lecturer' && (
                        <Button size="sm" variant="destructive" onClick={() => {
                          deleteMaterial(f.id);
                          toast({
                            title: tr(language, 'Đã xóa', 'Deleted'),
                            description: `"${f.fileName}" ${tr(language, 'đã bị xóa', 'has been removed')}`,
                          });
                        }}>
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
