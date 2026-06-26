import { useRef, useState, type ChangeEvent } from 'react';
import { useTeam } from '@/context/TeamContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, Trash2, FileText, Download, Link, Plus, ExternalLink, Globe, Eye, Loader2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { t, tr } from '@/lib/i18n';
import { useNotifications } from '@/context/NotificationContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

function getEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    
    // YouTube
    if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
      let videoId = '';
      if (parsed.hostname.includes('youtu.be')) {
        videoId = parsed.pathname.slice(1);
      } else {
        videoId = parsed.searchParams.get('v') || '';
      }
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }
    
    // Figma
    if (parsed.hostname.includes('figma.com')) {
      if (parsed.pathname.startsWith('/file/') || parsed.pathname.startsWith('/design/') || parsed.pathname.startsWith('/proto/')) {
        return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`;
      }
    }
    
    // Google Docs/Slides/Sheets
    if (parsed.hostname.includes('docs.google.com')) {
      if (parsed.pathname.includes('/presentation/')) {
        return url.replace(/\/edit(\?.*)?$/, '/embed');
      }
      if (parsed.pathname.includes('/document/') || parsed.pathname.includes('/spreadsheets/')) {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}embedded=true`;
      }
    }
  } catch (e) {
    // Ignore invalid URL
  }
  return null;
}

const isValidUrl = (str: string) => {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
};

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

  // Link Preview States
  const [activeEmbed, setActiveEmbed] = useState<string | null>(null);
  const [embedTitle, setEmbedTitle] = useState<string>('');

  const [isAddLinkOpen, setIsAddLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [linkPreviewImg, setLinkPreviewImg] = useState('');
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [savingLink, setSavingLink] = useState(false);

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

  const handleFetchMetadata = async () => {
    if (!linkUrl || !isValidUrl(linkUrl)) {
      toast({
        title: tr(language, 'URL không hợp lệ', 'Invalid URL'),
        description: tr(language, 'Vui lòng nhập một URL hợp lệ bắt đầu với http hoặc https', 'Please enter a valid URL starting with http or https'),
        variant: 'destructive',
      });
      return;
    }

    setIsFetchingMeta(true);
    try {
      const response = await fetch(`https://api.microlink.io?url=${encodeURIComponent(linkUrl)}`);
      const payload = await response.json();
      if (payload.status === 'success') {
        setLinkTitle(payload.data.title || '');
        setLinkDescription(payload.data.description || '');
        setLinkPreviewImg(payload.data.image?.url || '');
      } else {
        throw new Error('API returned failure status');
      }
    } catch (error) {
      console.warn('Metadata fetch failed, falling back to manual entry:', error);
      try {
        const parsed = new URL(linkUrl);
        setLinkTitle(parsed.hostname);
      } catch {
        setLinkTitle(linkUrl);
      }
      toast({
        title: tr(language, 'Không thể lấy thông tin tự động', 'Failed to fetch details automatically'),
        description: tr(language, 'Bạn có thể tự nhập tiêu đề và mô tả bên dưới', 'You can manually enter the title and description below'),
      });
    } finally {
      setIsFetchingMeta(false);
    }
  };

  const handleSaveLink = async () => {
    if (!linkUrl || !isValidUrl(linkUrl)) {
      toast({ title: tr(language, 'Lỗi', 'Error'), description: tr(language, 'URL không hợp lệ', 'Invalid URL'), variant: 'destructive' });
      return;
    }
    if (!linkTitle.trim()) {
      toast({ title: tr(language, 'Lỗi', 'Error'), description: tr(language, 'Vui lòng nhập tiêu đề', 'Please enter a title'), variant: 'destructive' });
      return;
    }
    if (!currentGroup?.id || !user?.id) {
      toast({ title: tr(language, 'Lỗi', 'Error'), description: tr(language, 'Vui lòng chọn nhóm dự án', 'Please select a project group'), variant: 'destructive' });
      return;
    }

    setSavingLink(true);
    try {
      await addStoredMaterial({
        fileName: linkTitle,
        size: 0,
        uploadedBy: uploaderName,
        uploadedById: user.id,
        storagePath: linkUrl,
        storageBucket: null,
        description: linkDescription,
        previewImg: linkPreviewImg,
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
                `Đã thêm liên kết mới: "${linkTitle}"`,
                `Added a new link: "${linkTitle}"`
              )
            );
          });
      }

      toast({ title: tr(language, 'Đã lưu', 'Saved'), description: `"${linkTitle}" ${tr(language, 'đã được thêm vào tài liệu', 'has been added to documents')}` });
      setIsAddLinkOpen(false);
      setLinkUrl('');
      setLinkTitle('');
      setLinkDescription('');
      setLinkPreviewImg('');
      setNotifyTeam(false);
    } catch (error) {
      toast({
        title: tr(language, 'Lưu thất bại', 'Save failed'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'destructive',
      });
    } finally {
      setSavingLink(false);
    }
  };

  // Separate files and links cleanly
  const files = materials.filter(m => m.storageBucket === 'materials' || (m.storageBucket !== null && !m.storagePath?.startsWith('http')));
  const links = materials.filter(m => m.storageBucket === null || (m.storageBucket !== 'materials' && m.storagePath?.startsWith('http')));

  return (
    <section className="bg-card rounded-xl p-6 shadow-card border border-border">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2 text-foreground">
          <FileText className="h-5 w-5 text-primary" />
          {tr(language, 'Tài liệu / Tài liệu học phần', 'Materials / Course Documents')}
        </h2>

        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="file"
            ref={fileRef}
            accept=".pdf,.pptx,.ppt,.docx,.doc,.xlsx,.xls,.txt,.csv,.zip"
            className="hidden"
            onChange={(event) => void handleFileChange(event)}
          />
          <Button size="sm" onClick={handleChooseFile} disabled={uploading}>
            <Upload className="h-4 w-4 mr-1.5" /> {t(language, 'uploadMaterial')}
          </Button>

          <Button size="sm" variant="outline" onClick={() => setIsAddLinkOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> {tr(language, 'Thêm liên kết', 'Add Link')}
          </Button>

          <div className="flex items-center space-x-2 border-l border-border pl-3 ml-1 h-6">
            <Checkbox
              id="materialNotifyTeam"
              checked={notifyTeam}
              onCheckedChange={(checked) => setNotifyTeam(!!checked)}
            />
            <Label htmlFor="materialNotifyTeam" className="text-xs font-medium leading-none cursor-pointer">
              {tr(language, "Thông báo nhóm", "Notify team")}
            </Label>
          </div>
        </div>
      </div>

      <Tabs defaultValue="files" className="w-full">
        <TabsList className="mb-4 bg-muted/60 p-1">
          <TabsTrigger value="files" className="px-4 py-1.5 text-xs sm:text-sm">
            {tr(language, 'Tệp tin', 'Files')} ({files.length})
          </TabsTrigger>
          <TabsTrigger value="links" className="px-4 py-1.5 text-xs sm:text-sm">
            {tr(language, 'Liên kết', 'Links')} ({links.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files" className="focus-visible:outline-none">
          {files.length > 0 ? (
            <div className="overflow-x-auto border border-border/60 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border/60">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{tr(language, 'Tên file', 'File name')}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{tr(language, 'Kích thước', 'Size')}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{tr(language, 'Người tải', 'Uploaded by')}</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">{tr(language, 'Thời gian', 'Time')}</th>
                    <th className="px-4 py-3 w-[100px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {files.map(f => (
                    <tr key={f.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary/60 shrink-0" />
                          <span className="truncate max-w-[240px] sm:max-w-[400px]" title={f.fileName}>{f.fileName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</td>
                      <td className="px-4 py-3 text-muted-foreground">{f.uploadedBy}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {f.uploadTime.toLocaleDateString('vi-VN')} {f.uploadTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => void handleDownload(f)}
                            disabled={downloadingId === f.id}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {(isProjectLeader || f.uploadedById === user?.id) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                              onClick={() => void handleDelete(f)}
                              disabled={deletingId === f.id}
                            >
                              <Trash2 className="h-4 w-4" />
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
            <div className="text-center py-10 border border-dashed border-border/80 rounded-lg">
              <p className="text-muted-foreground text-sm">{tr(language, 'Chưa có tệp tin nào', 'No files yet')}</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="links" className="focus-visible:outline-none">
          {links.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {links.map(link => {
                const embedUrl = getEmbedUrl(link.storagePath || '');
                let hostname = '';
                try {
                  hostname = link.storagePath ? new URL(link.storagePath).hostname : '';
                } catch {}

                return (
                  <div
                    key={link.id}
                    className="group relative bg-card rounded-xl border border-border overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all duration-200 flex flex-col h-full"
                  >
                    {/* Preview Image */}
                    <div className="relative aspect-video w-full bg-muted overflow-hidden border-b border-border/55">
                      {link.previewImg ? (
                        <img
                          src={link.previewImg}
                          alt={link.fileName}
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-center">
                          <Globe className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                      {embedUrl && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-200">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 gap-1.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEmbedTitle(link.fileName);
                              setActiveEmbed(embedUrl);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {tr(language, 'Xem trực tiếp', 'Preview')}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Card Content */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <h3 className="font-semibold text-sm line-clamp-1 mb-1 text-foreground" title={link.fileName}>
                          {link.fileName}
                        </h3>
                        {link.description ? (
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">
                            {link.description}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground/50 italic line-clamp-2 leading-relaxed mb-3">
                            {tr(language, 'Không có mô tả', 'No description')}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {hostname && (
                            <img
                              src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`}
                              alt="favicon"
                              className="w-3.5 h-3.5 rounded-sm"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                          <span className="truncate max-w-[90px]">{hostname}</span>
                          <span>•</span>
                          <span className="truncate max-w-[80px]">{link.uploadedBy}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => window.open(link.storagePath, '_blank', 'noopener,noreferrer')}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                          {(isProjectLeader || link.uploadedById === user?.id) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                              onClick={() => void handleDelete(link)}
                              disabled={deletingId === link.id}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 border border-dashed border-border/80 rounded-lg">
              <p className="text-muted-foreground text-sm">{tr(language, 'Chưa có liên kết nào', 'No links yet')}</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Link Dialog */}
      <Dialog open={isAddLinkOpen} onOpenChange={setIsAddLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tr(language, 'Thêm liên kết', 'Add Link')}</DialogTitle>
            <DialogDescription>
              {tr(
                language,
                'Dán URL để tự động lấy tiêu đề, hình ảnh và mô tả từ trang web.',
                'Paste URL to fetch title, image, and description automatically from web.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="url-input" className="text-xs font-semibold">{tr(language, 'Địa chỉ liên kết (URL)', 'Link URL')}</Label>
              <div className="flex gap-2">
                <Input
                  id="url-input"
                  placeholder="https://example.com"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  disabled={isFetchingMeta || savingLink}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isFetchingMeta || savingLink || !linkUrl}
                  onClick={() => void handleFetchMetadata()}
                >
                  {isFetchingMeta ? <Loader2 className="h-4 w-4 animate-spin" /> : tr(language, 'Lấy tin', 'Fetch')}
                </Button>
              </div>
            </div>

            {/* Preview and Editing panel */}
            <div className="space-y-3 pt-2 border-t border-border/60">
              <div className="space-y-1">
                <Label htmlFor="title-input" className="text-xs font-semibold">{tr(language, 'Tiêu đề', 'Title')}</Label>
                <Input
                  id="title-input"
                  placeholder={tr(language, 'Nhập tiêu đề...', 'Enter title...')}
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  disabled={savingLink}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="desc-input" className="text-xs font-semibold">{tr(language, 'Mô tả', 'Description')}</Label>
                <Textarea
                  id="desc-input"
                  placeholder={tr(language, 'Nhập mô tả...', 'Enter description...')}
                  value={linkDescription}
                  onChange={(e) => setLinkDescription(e.target.value)}
                  disabled={savingLink}
                  rows={2}
                />
              </div>

              {linkPreviewImg && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground block">{tr(language, 'Hình ảnh xem trước', 'Preview Image')}</span>
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-border/80 max-w-[200px]">
                    <img src={linkPreviewImg} alt="Preview" className="w-full h-full object-cover" />
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="absolute top-1 right-1 h-6 w-6 p-0"
                      onClick={() => setLinkPreviewImg('')}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsAddLinkOpen(false);
                setLinkUrl('');
                setLinkTitle('');
                setLinkDescription('');
                setLinkPreviewImg('');
              }}
              disabled={savingLink}
            >
              {tr(language, 'Hủy', 'Cancel')}
            </Button>
            <Button
              type="button"
              disabled={savingLink || !linkUrl || !linkTitle}
              onClick={() => void handleSaveLink()}
            >
              {savingLink ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {tr(language, 'Lưu lại', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Embed Modal Dialog */}
      <Dialog open={!!activeEmbed} onOpenChange={(open) => !open && setActiveEmbed(null)}>
        <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden flex flex-col gap-0">
          <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
            <DialogTitle className="truncate pr-8 text-base">{embedTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full bg-muted/30">
            {activeEmbed && (
              <iframe
                src={activeEmbed}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default MaterialsSection;
