'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createOrder, createPayment, cancelOrder } from '@/lib/api';
import { useCartStore, useAuthStore } from '@/lib/store';
import { openRazorpayCheckout } from '@/lib/razorpay';
import StepIndicator from '@/components/StepIndicator';
import AppHeader from '@/components/AppHeader';
import LOCALITIES from '@/constants/localities';

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { items, slot, clearCart, totalAmount } = useCartStore();

  const [address, setAddress] = useState({
    name:     user?.name  || '',
    phone:    user?.phone || '',
    street:   '',
    landmark: '',
    locality: '',
  });
  const [paymentMode, setPaymentMode] = useState('upi');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const set       = (field) => (e) => setAddress((a) => ({ ...a, [field]: e.target.value }));
  const cartTotal = totalAmount();
  const slotId    = slot?._id ?? null;

  const handlePlaceOrder = async () => {
    // Hard guards — all must pass before hitting the API
    if (!slotId) {
      setError('Please go back and select a delivery slot.');
      return;
    }
    if (!address.name.trim())   { setError('Full name is required.');       return; }
    if (!address.phone.trim())  { setError('Phone number is required.');     return; }
    if (!address.street.trim()) { setError('Street address is required.');   return; }
    if (!address.locality)      { setError('Locality is required.');         return; }
    setError('');
    setLoading(true);

    let order = null;
    try {
      const orderRes = await createOrder({
        items: items.map((i) => ({ productId: i.product._id, quantity: i.quantity })),
        slotId,
        deliveryAddress: address,
        paymentMode,
      });
      order = orderRes.data.data;

      if (paymentMode === 'cod') {
        clearCart();
        return router.replace(`/status/${order._id}`);
      }

      // UPI — open Razorpay
      const payRes = await createPayment(order._id);
      const { razorpayOrderId, amount, keyId } = payRes.data.data;

      await openRazorpayCheckout({
        razorpayOrderId, amount, keyId,
        name:        address.name,
        email:       user?.email || '',
        phone:       address.phone,
        description: `Order #${order._id.toString().slice(-6).toUpperCase()}`,
      });

      // Payment succeeded — webhook will confirm; navigate to status
      clearCart();
      router.replace(`/status/${order._id}`);
    } catch (err) {
      if (err?.message === 'Payment cancelled by user') {
        // Cancel the order so it doesn't leave a ghost pending record
        if (order?._id) {
          cancelOrder(order._id).catch(() => {}); // fire and forget
        }
        setError('Payment was cancelled. Your slot has been released — you can try again.');
      } else {
        setError(err?.response?.data?.error || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pb-6">
      <AppHeader showLocality={false} />
      <StepIndicator step={3} />

      <div className="px-4">
        <h1 className="text-base font-700 text-text-main mb-4">Order Summary</h1>

        {/* Items */}
        <section className="card mb-4">
          {items.map(({ product, quantity }) => (
            <div key={product._id} className="flex items-center justify-between py-2 border-b border-border-default last:border-0">
              <div>
                <p className="text-sm font-medium text-text-main">{product.name}</p>
                <p className="text-xs text-text-muted">Quantity: {quantity} × ₹{product.price}</p>
              </div>
              <p className="text-sm font-700 text-text-main">₹{product.price * quantity}</p>
            </div>
          ))}

          {/* Slot summary — real data from store */}
          <div className="flex items-start justify-between pt-3 mt-1">
            <div>
              <p className="text-xs font-medium text-text-main mb-0.5">Delivery Slot</p>
              {slot ? (
                <p className="text-xs text-text-muted">
                  {new Date(slot.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  {' · '}{slot.slotLabel} · {slot.startTime}–{slot.endTime}
                </p>
              ) : (
                <p className="text-xs text-red-500 font-medium">No slot selected — go back</p>
              )}
            </div>
            <p className="text-lg font-700 text-text-main">₹{cartTotal}</p>
          </div>
        </section>

        {/* Delivery details */}
        <section className="card mb-4">
          <h2 className="text-xs font-700 text-text-muted uppercase tracking-wide mb-3">Delivery Details</h2>
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium text-text-main mb-1">Full Name</label>
              <input className="input" placeholder="Rilang Tariang"
                value={address.name} onChange={set('name')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-main mb-1">Phone Number</label>
              <input className="input" type="tel" placeholder="+91 98765 43210"
                value={address.phone} onChange={set('phone')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-main mb-1">Street Address</label>
              <input className="input" placeholder="House No. 42, Laitumkhrah, near Cathedral Church"
                value={address.street} onChange={set('street')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-main mb-1">Landmark (optional)</label>
              <input className="input" placeholder="e.g. Near St. Edmund's School"
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
        <section className="card mb-5">
          <h2 className="text-xs font-700 text-text-muted uppercase tracking-wide mb-3">Payment Method</h2>
          <div className="flex gap-3">
            {[
              { value: 'upi', label: 'Pay Online (UPI/Card)' },
              { value: 'cod', label: 'Cash on Delivery' },
            ].map((opt) => (
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

        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-text-muted">Total Amount</p>
            <p className="text-[11px] text-text-muted">Inclusive of all taxes</p>
          </div>
          <p className="text-xl font-700 text-text-main">₹{cartTotal}.00</p>
        </div>

        <button
          onClick={handlePlaceOrder}
          disabled={loading || items.length === 0 || !slotId}
          className="btn-primary w-full py-3 text-sm disabled:opacity-50"
        >
          {loading ? 'Processing…' : `Place Order · ₹${cartTotal}`}
        </button>
      </div>
    </main>
  );
}
