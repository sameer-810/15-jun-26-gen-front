import { useEffect, useState } from "react";
import { FormDialog } from "@/modules/common/FormDialog";
import { LocationSelect } from "@/modules/location/LocationSelect";
import { useCreateSale } from "../hooks/useSales";
import { useInventoryOptions } from "@/modules/inventory/hooks/useInventory";
import { getApiErrorMessage } from "@/shared/api/http";
import { toast } from "@/shared/lib/toast";
import { formatCurrency } from "@/lib/utils";

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function SaleDialog({ open, onOpenChange, onSuccess }: Props) {
  const createMutation = useCreateSale();
  const { data: invData } = useInventoryOptions(open);
  const items = invData?.items ?? [];

  const [inventoryId, setInventoryId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    if (open) {
      setInventoryId("");
      setQuantity(1);
      setUnitPrice(0);
      setCustomerName("");
      setCustomerMobile("");
      setSaleDate("");
      setLocation("");
    }
  }, [open]);

  function onPickInventory(id: string) {
    setInventoryId(id);
    const item = items.find((i) => i.id === id);
    if (item && item.sellingPrice) setUnitPrice(item.sellingPrice);
    // Default the dispatch location to wherever that stock is held; the user
    // can still override it before recording.
    if (item) setLocation(item.location ?? "");
  }

  const selected = items.find((i) => i.id === inventoryId);
  const total = quantity * unitPrice;

  async function submit() {
    if (!inventoryId) {
      toast.error("Select a generator model");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }
    try {
      await createMutation.mutateAsync({
        inventoryId,
        quantity: Number(quantity),
        unitPrice: Number(unitPrice),
        customerName: customerName.trim(),
        customerMobile: customerMobile.trim() || undefined,
        saleDate: saleDate || undefined,
        location: location.trim() || undefined,
      });
      toast.success("Sale recorded; stock updated");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record Sale"
      onSubmit={submit}
      isPending={createMutation.isPending}
      submitLabel="Record Sale"
      size="lg"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Generator Model *
          </label>
          <select
            className={inputCls}
            value={inventoryId}
            onChange={(e) => onPickInventory(e.target.value)}
          >
            <option value="">— Select from inventory —</option>
            {items.map((i) => (
              <option key={i.id} value={i.id} disabled={i.availableQuantity <= 0}>
                {i.model} · {i.kva} kVA · {i.availableQuantity} in stock
              </option>
            ))}
          </select>
          {selected && (
            <p className="mt-1 text-xs text-muted-foreground">
              {selected.availableQuantity} available · default{" "}
              {formatCurrency(selected.sellingPrice)}
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Quantity</label>
          <input
            type="number"
            min={1}
            className={inputCls}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Unit Price (₹)
          </label>
          <input
            type="number"
            className={inputCls}
            value={unitPrice}
            onChange={(e) => setUnitPrice(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Customer Name *
          </label>
          <input
            className={inputCls}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Customer Mobile
          </label>
          <input
            className={inputCls}
            value={customerMobile}
            onChange={(e) => setCustomerMobile(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Sale Date</label>
          <input
            type="date"
            className={inputCls}
            value={saleDate}
            onChange={(e) => setSaleDate(e.target.value)}
          />
        </div>
        <div>
          <label
            className="block text-xs font-medium text-muted-foreground mb-1"
            htmlFor="sale-location"
          >
            Location
          </label>
          {/* Point 9 — dropdown from the Location master list. */}
          <LocationSelect
            id="sale-location"
            data-testid="sale-location-select"
            className={inputCls}
            value={location}
            onChange={setLocation}
          />
        </div>
        <div className="flex items-end">
          <div className="w-full rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-lg font-bold text-primary">{formatCurrency(total)}</div>
          </div>
        </div>
      </div>
    </FormDialog>
  );
}
