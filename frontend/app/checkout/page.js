'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createOrder, createPayment } from '@/lib/api';
import { useCartStore, useAuthStore } from '@/lib/store';
import { openRazorpayCheckout } from '@/lib/razorpay';
import StepIndicator from '@/components/StepIndicator';

const LOCALITIES = ['Laitumkhrah','Police Bazaar','Lachulmiere','Mawpat','Nongthymmai','Rynjah','Bara Bazaar'];

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { items, slotId, clearCart, totalAmount } = useCartStore();

  const [address, setAddress] = useState({
    name:     user?.name     || '',
    phone:    user?.phone    || '',
    street:   '',
    landmark: '',
    locality: '',
  });
  const [paymentMode, setPaymentMode] = useState('cod');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (field) => (e) => setAddress((a) => ({ ...a, [field]: e.target.value }));

  const cartTotal = totalAmount();

  const handlePlaceOrder = async () => {
    if (!address.name.trim())     { setError('Full name is required.'); return; }
    if (!address.phone.trim())    { setError('Phone number is required.'); return; }
    if (!address.street.trim())   { setError('Street address is required.'); return; }
    if (!address.locality)        { setError('Locality is required.'); return; }
    setError('');
    setLoading(true);

    try {
      const orderRes = await createOrder({
        items: items.map((i) => ({ productId: i.product._id, quantity: i.quantity })),
        slotId,
        deliveryAddress: address,
        paymentMode,
      });
      const order = orderRes.data.data;

      if (paymentMode === 'cod') {
        clearCart();
        return router.replace(`/status/${order._id}`);
      }

      const payRes = await createPayment(order._id);
      const { razorpayOrderId, amount, keyId } = payRes.data.data;

      await openRazorpayCheckout({
        razorpayOrderId,
        amount,
        keyId,
        name:        address.name,
        email:       user?.email || '',
        phone:       address.phone,
        description: `Order #${order._id.toString().slice(-6).toUpperCase()}`,
      });

      clearCart();
      router.replace(`/status/${order._id}`);
    } catch (err) {
      if (err?.message === 'Payment cancelled by user') {
        setError('Payment was cancelled. Your order has been saved — you can retry from the order page.');
      } else {
        setError(err?.response?.data?.error || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="px-4 pt-5 pb-6">
      <StepIndicator step={3} />

      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => router.back()} className="text-text-muted hover:text-text-main transition-colors">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-700 text-text-main">Order Summary</h1>
      </div>

      {/* Order summary */}
      <section className="card mb-4">
        <h2 className="text-xs font-700 text-text-muted uppercase tracking-wide mb-3">Items</h2>
        {items.map(({ product, quantity }) => (
          <div key={product._id} className="flex justify-between text-sm py-1">
            <span className="text-text-main">{product.name} × {quantity}</span>
            <span className="font-medium text-text-main">₹{product.price * quantity}</span>
          </div>
        ))}
        <div className="border-t border-border-default mt-3 pt-3 flex justify-between text-sm font-700">
          <span>Total</span>
          <span>₹{cartTotal}</span>
        </div>
      </section>

      {/* Delivery details */}
      <section className="card mb-4">
        <h2 className="text-xs font-700 text-text-muted uppercase tracking-wide mb-3">Delivery Details</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Full name</label>
            <input className="input" placeholder="Rilang Tariang"
              value={address.name} onChange={set('name')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Phone number</label>
            <input className="input" type="tel" placeholder="+91 98765 43210"
              value={address.phone} onChange={set('phone')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Street address</label>
            <input className="input" placeholder="House No. 42, Laitumkhrah"
              value={address.street} onChange={set('street')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Landmark (optional)</label>
            <input className="input" placeholder="Near Cathedral Church"
              value={address.landmark} onChange={set('landmark')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-main mb-1">Locality</label>
            <select className="input" value={address.locality} onChange={set('locality')}>
              <option value="">Select locality</option>
              {LOCALITIES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* Payment method */}
      <section className="card mb-6">
        <h2 className="text-xs font-700 text-text-muted uppercase tracking-wide mb-3">Payment Method</h2>
        <div className="flex gap-3">
          {[{ value: 'upi', label: 'Pay Online (UPI/Card)' }, { value: 'cod', label: 'Cash on Delivery' }].map((opt) => (
            <button key={opt.value} onClick={() => setPaymentMode(opt.value)}
              className={`flex-1 text-xs font-medium py-2.5 rounded-btn border transition-colors ${
                paymentMode === opt.value
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-text-muted border-border-default hover:border-primary'
              }`}>
              {opt.label}
            </button>
          ))}
        </div>
        {paymentMode === 'upi' && (
          <p className="text-[11px] text-text-muted mt-2">
            You'll be redirected to Razorpay to complete payment securely.
          </p>
        )}
      </section>

      {error && <p className="text-red-600 text-xs mb-3">{error}</p>}

      <button onClick={handlePlaceOrder} disabled={loading || items.length === 0} className="btn-primary w-full text-sm py-3">
        {loading ? 'Processing…' : `Place Order — ₹${cartTotal}`}
      </button>
    </main>
  );
}
