'use client';
import { useCartStore } from '@/lib/store';
import { productImage } from '@/lib/productImage';

export default function ProductCard({ product }) {
  const { items, addItem, updateQty } = useCartStore();
  const cartItem = items.find((i) => i.product._id === product._id);
  const qty = cartItem?.quantity ?? 0;
  const selected = qty > 0;
  const img = productImage(product);

  return (
    <div
      className={`relative flex flex-col bg-white rounded-card p-3 transition-all ${
        selected
          ? 'border border-primary shadow-[0_0_0_1px_rgba(0,55,176,0.25)]'
          : 'border border-border-default shadow-sm'
      }`}
    >
      {/* Photo */}
      <div className="relative aspect-[5/4] rounded-xl overflow-hidden bg-bg-trust mb-2.5">
        <img src={img} alt={product.name} loading="lazy" className="w-full h-full object-cover" />
        {/* Unit chip — keeps same-photo SKUs (e.g. jar/pack/crate) visually distinct + scannable */}
        {product.unit && (
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-white/85 backdrop-blur px-2 py-0.5 text-[10px] font-700 text-text-main shadow-sm">
            {product.unit}
          </span>
        )}
        {selected && (
          <span className="absolute top-1.5 right-1.5 min-w-[22px] h-[22px] px-1.5 rounded-full bg-primary text-white text-[11px] font-700 flex items-center justify-center shadow">
            {qty}
          </span>
        )}
      </div>

      {/* Name */}
      <p className="text-sm font-700 text-text-main leading-snug">{product.name}</p>

      {/* Price + action */}
      <div className="mt-auto pt-3 flex items-center justify-between gap-2">
        <span className="font-display text-[17px] font-extrabold text-text-main leading-none">₹{product.price}</span>
        {qty === 0 ? (
          <button
            onClick={() => addItem(product)}
            className="bg-primary text-white font-700 text-sm rounded-btn px-4 min-h-[40px] active:scale-95 transition-transform"
          >
            Add
          </button>
        ) : (
          <div className="flex items-center rounded-btn border border-primary/30 bg-bg-trust">
            <button
              onClick={() => updateQty(product._id, qty - 1)}
              aria-label={`Remove one ${product.name}`}
              className="w-10 h-10 flex items-center justify-center text-primary text-xl leading-none active:scale-90 transition-transform"
            >
              −
            </button>
            <span className="w-5 text-center text-sm font-700 text-text-main tabular-nums">{qty}</span>
            <button
              onClick={() => addItem(product)}
              aria-label={`Add one ${product.name}`}
              className="w-10 h-10 flex items-center justify-center text-primary text-xl leading-none active:scale-90 transition-transform"
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
