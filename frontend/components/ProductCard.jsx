'use client';
import { useCartStore } from '@/lib/store';

export default function ProductCard({ product }) {
  const { items, addItem, updateQty } = useCartStore();
  const cartItem = items.find((i) => i.product._id === product._id);
  const qty = cartItem?.quantity ?? 0;

  return (
    <div className="card hover:shadow-sm transition-shadow">
      {product.image && (
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-28 object-contain mb-3 rounded"
        />
      )}
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-medium text-text-main leading-snug">{product.name}</p>
        <span className="text-sm font-700 text-text-main whitespace-nowrap">₹{product.price}</span>
      </div>
      <p className="text-xs text-text-muted mb-3">{product.unit}</p>

      {qty === 0 ? (
        <button onClick={() => addItem(product)} className="btn-primary w-full text-sm">
          Add
        </button>
      ) : (
        <div className="flex items-center justify-between border border-border-default rounded-btn overflow-hidden">
          <button
            onClick={() => updateQty(product._id, qty - 1)}
            className="w-9 h-9 flex items-center justify-center text-primary font-medium hover:bg-blue-50 transition-colors"
          >
            −
          </button>
          <span className="text-sm font-medium text-text-main">{qty}</span>
          <button
            onClick={() => addItem(product)}
            className="w-9 h-9 flex items-center justify-center text-primary font-medium hover:bg-blue-50 transition-colors"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
