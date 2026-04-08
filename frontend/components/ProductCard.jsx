'use client';
import { useCartStore } from '@/lib/store';

export default function ProductCard({ product }) {
  const { items, addItem, updateQty } = useCartStore();
  const cartItem = items.find((i) => i.product._id === product._id);
  const qty = cartItem?.quantity ?? 0;

  return (
    <div className="card hover:shadow-sm transition-shadow flex flex-col">
      {/* Image area */}
      <div className="h-28 bg-bg-card rounded mb-3 flex items-center justify-center overflow-hidden">
        {product.image ? (
          <img src={product.image} alt={product.name} className="w-full h-full object-contain" />
        ) : (
          <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="#1d4ed8" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8 8 5 12 5 15a7 7 0 0014 0c0-3-3-7-7-13z" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 flex flex-col">
        <p className="text-sm font-700 text-text-main leading-snug">{product.name}</p>
        {product.description && (
          <p className="text-[11px] text-text-muted mt-1 leading-relaxed flex-1">{product.description}</p>
        )}
        <p className="text-sm font-700 text-primary mt-2 mb-3">₹{product.price}</p>
      </div>

      {/* Stepper / Add */}
      {qty === 0 ? (
        <button onClick={() => addItem(product)} className="btn-primary w-full text-sm py-2">
          Add to Cart
        </button>
      ) : (
        <div className="flex items-center justify-between border border-border-default rounded-btn overflow-hidden">
          <button
            onClick={() => updateQty(product._id, qty - 1)}
            className="w-9 h-9 flex items-center justify-center text-primary font-medium hover:bg-blue-50 transition-colors text-lg"
          >
            −
          </button>
          <span className="text-sm font-700 text-text-main">{qty}</span>
          <button
            onClick={() => addItem(product)}
            className="w-9 h-9 flex items-center justify-center text-primary font-medium hover:bg-blue-50 transition-colors text-lg"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
