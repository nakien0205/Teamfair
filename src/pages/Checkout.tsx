import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Check, Star, X } from 'lucide-react';
import Swal from 'sweetalert2'; // Thư viện popup thông báo xịn mịn

type PricingPlan = 'free' | 'pro_group' | 'pro_max';

interface Plan {
  id: PricingPlan;
  name: string;
  nameVi: string;
  price: number;
  priceVi: string;
  cycle: string;
  cycleVi: string;
  popular?: boolean;
  features: string[];
  featuresVi: string[];
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    nameVi: 'Miễn phí',
    price: 0,
    priceVi: '0đ',
    cycle: '/month',
    cycleVi: '/tháng',
    features: [
      'Create 1 group, max 6 members',
      'Max 20 tasks/group',
      'Basic task assignment & progress tracking',
      'Task submission on platform',
      'Basic work calendar',
      'Connect 1 lecturer for results',
      'AI task suggestions & analysis',
      'Detailed performance charts',
    ],
    featuresVi: [
      'Tạo 1 nhóm, tối đa 6 thành viên',
      'Tối đa 20 task/nhóm',
      'Phân công & theo dõi tiến độ cơ bản',
      'Submit task trên nền tảng',
      'Lịch làm việc (calendar cơ bản)',
      'Kết nối 1 giảng viên xem kết quả',
      'AI gợi ý task & phân tích',
      'Biểu đồ hiệu suất chi tiết',
    ],
  },
  {
    id: 'pro_group',
    name: 'Pro Group',
    nameVi: 'Pro Group',
    price: 2000,
    priceVi: '2.000đ',
    cycle: '/group/month',
    cycleVi: '/nhóm/tháng',
    popular: true,
    features: [
      'Unlimited members (max 30)',
      'Unlimited tasks & projects',
      'AI task suggestions & progress analysis',
      'Individual contribution charts',
      'Real-time lecturer integration',
      'Export group PDF reports',
      'Advanced work calendar + reminders',
      '5GB file storage/group',
      'Advanced AI summarization',
      'Multi-project dashboard',
    ],
    featuresVi: [
      'Không giới hạn thành viên (tối đa 30)',
      'Không giới hạn task & project',
      'AI gợi ý task & phân tích tiến độ',
      'Biểu đồ đóng góp cá nhân',
      'Tích hợp GV xem real-time',
      'Xuất báo cáo nhóm PDF',
      'Lịch làm việc nâng cao + reminder',
      'Storage file 5GB/nhóm',
      'AI tóm tắt thông minh (Advanced)',
      'Multi-project dashboard',
    ],
  },
  {
    id: 'pro_max',
    name: 'Pro Max',
    nameVi: 'Pro Max',
    price: 129000,
    priceVi: '129.000đ',
    cycle: '/group/month',
    cycleVi: '/nhóm/tháng',
    features: [
      'All Pro Group features',
      'Unlimited parallel projects',
      'Advanced AI summarization',
      'AI bottleneck analysis & reallocation suggestions',
      'Multi-project leader dashboard',
      '20GB file storage/group',
      'Priority support',
      'Custom group branding',
    ],
    featuresVi: [
      'Tất cả tính năng Pro Group',
      'Nhiều project song song (không giới hạn)',
      'AI tóm tắt thông minh (Advanced)',
      'AI phân tích bottleneck & đề xuất phân công lại',
      'Dashboard multi-project cho leader',
      'Storage 20GB/nhóm',
      'Priority support',
      'Custom branding nhóm',
    ],
  },
];

export default function Checkout() {
  const [loading, setLoading] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [qrValue, setQrValue] = useState<string>('');
  const [showQrModal, setShowQrModal] = useState(false);
  
  const [language] = useState<'vi' | 'en'>('vi'); 
  const navigate = useNavigate();

  // LUỒNG REALTIME: Lắng nghe trạng thái thay đổi ngầm từ Supabase
  useEffect(() => {
    if (!currentOrderId) return;

    const channel = supabase
      .channel(`order-status-${currentOrderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `order_id=eq.${currentOrderId}`,
        },
        (payload) => {
          if (
            payload.new.status === 'PAID' ||
            payload.new.status === 'success'
          ) {
            setError(null);
            setShowQrModal(false); // 1. Tự đóng hộp thoại QR

            // Tìm thông tin tên gói tiếng Việt vừa thanh toán dựa vào plan_id từ DB trả ra
            const matchedPlan = PLANS.find(p => p.id === payload.new.plan_id);
            const planName = matchedPlan ? matchedPlan.nameVi : 'Gói dịch vụ';

            // 2. Kích hoạt Popup thông báo đăng ký thành công hoành tráng
            Swal.fire({
              title: '🎉 Thanh toán thành công!',
              html: `Chúc mừng bạn đã đăng ký thành công gói <strong>${planName}</strong>.<br/>Hệ thống đang đưa bạn quay lại giao diện chính.`,
              icon: 'success',
              timer: 3000, // Thông báo chạy trong 3 giây
              timerProgressBar: true,
              showConfirmButton: false,
              allowOutsideClick: false
            }).then(() => {
              // 3. Trả người dùng về trang giao diện sinh viên
              navigate('/dashboard-student');
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrderId, navigate, selectedPlan]);

  const handlePayment = async (plan: Plan) => {
    if (plan.id === 'free') {
      navigate('/dashboard-student');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const orderId = Math.floor(100000 + Math.random() * 900000);
      
      const { error: dbError } = await supabase
        .from('orders')
        .insert([
          { order_id: orderId, plan_id: plan.id, amount: plan.price, status: 'PENDING' }
        ]);

      if (dbError) throw dbError;

      const BANK_ID = 'TPB'; 
      const ACCOUNT_NO = '03170155756'; 
      const ACCOUNT_NAME = 'TRUONG MONG HUYEN'; 
      const MEMO = `TF${orderId}`; 

      const vietQrUrl = `https://api.vietqr.io/${BANK_ID}/${ACCOUNT_NO}/${plan.price}/${encodeURIComponent(MEMO)}/qr_only.png?accountName=${encodeURIComponent(ACCOUNT_NAME)}`;
      
      setCurrentOrderId(orderId);
      setSelectedPlan(plan);
      setQrValue(vietQrUrl);
      setShowQrModal(true); 

    } catch (err: any) {
      console.error('Payment error:', err);
      setError(language === 'vi' ? 'Lỗi tạo đơn hàng.' : 'Order initialization error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {language === 'vi' ? 'Chọn gói dành cho bạn' : 'Choose your plan'}
          </h1>
          <p className="text-lg text-gray-600">
            {language === 'vi' ? 'Nâng cấp để mở khóa các tính năng cao cấp' : 'Upgrade to unlock premium features'}
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {PLANS.map((plan) => (
            <div key={plan.id} className={`relative transition-transform duration-300 ${plan.popular ? 'md:scale-105' : ''}`}>
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                  <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                    <Star className="h-4 w-4 fill-current" />
                    {language === 'vi' ? 'Phổ biến nhất' : 'Most Popular'}
                  </span>
                </div>
              )}

              <Card className={`h-full flex flex-col ${plan.popular ? 'border-amber-500 border-2 shadow-lg' : 'border-gray-200'}`}>
                <CardHeader>
                  <CardTitle className="text-2xl">{language === 'vi' ? plan.nameVi : plan.name}</CardTitle>
                  <div className="mt-4">
                    <div className="text-4xl font-bold text-gray-900">{language === 'vi' ? plan.priceVi : `$${(plan.price / 23000).toFixed(2)}`}</div>
                    <div className="text-sm text-gray-600 mt-2">{language === 'vi' ? plan.cycleVi : plan.cycle}</div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-3 mb-6 flex-1">
                    {(language === 'vi' ? plan.featuresVi : plan.features).map((feature, idx) => (
                      <li key={idx} className="flex gap-3 text-sm">
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handlePayment(plan)}
                    disabled={loading}
                    className={`w-full ${plan.popular ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600' : ''}`}
                    size="lg"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : plan.id === 'free' ? (
                      language === 'vi' ? 'Sử dụng miễn phí' : 'Use Free'
                    ) : (
                      language === 'vi' ? 'Thanh toán ngay' : 'Upgrade Now'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="max-w-md mx-auto p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-6 text-center">
            {error}
          </div>
        )}

        {/* POPUP MODAL HIỂN THỊ MÃ QR */}
        {showQrModal && selectedPlan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 relative shadow-2xl text-center">
              <button 
                onClick={() => setShowQrModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
              
              <h3 className="text-xl font-bold text-gray-900 mb-2">Quét mã thanh toán</h3>
              <p className="text-sm text-gray-500 mb-4">Gói dịch vụ: <span className="font-semibold text-gray-800">{selectedPlan.nameVi}</span></p>
              
              <div className="bg-slate-50 p-4 rounded-xl inline-block mb-4 border border-gray-100">
                <img src={qrValue} alt="VietQR Thanh Toan" className="w-64 h-64 mx-auto object-contain" />
              </div>

              <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl text-left text-xs text-blue-800 space-y-1 mb-4">
                <p><strong>Số tiền:</strong> {selectedPlan.priceVi}</p>
                <p><strong>Nội dung CK bắt buộc:</strong> <span className="text-red-600 font-bold bg-red-50 px-1 rounded">TF{currentOrderId}</span></p>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm text-amber-600 font-medium animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang đợi hệ thống nhận tiền đơn hàng #{currentOrderId}...
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}