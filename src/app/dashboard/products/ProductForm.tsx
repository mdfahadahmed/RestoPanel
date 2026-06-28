"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiImageUploader } from "./MultiImageUploader";
import { VariantsEditor } from "./VariantsEditor";
import { ExtrasEditor } from "./ExtrasEditor";
import { TagsInput } from "./TagsInput";
import { createProduct, updateProduct } from "./actions";
import type {
  Extra,
  ProductImage,
  ProductStatus,
  Variant,
} from "@/lib/validations/product";

export interface ProductFormInitial {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  categoryId: string | null;
  images: ProductImage[];
  price: number;
  comparePrice: number | null;
  costPrice: number | null;
  discount: number;
  sku: string;
  barcode: string;
  calories: number | null;
  stockQuantity: number | null;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  status: ProductStatus;
  isAvailable: boolean;
  featured: boolean;
  bestSeller: boolean;
  prepTimeMins: number | null;
  ingredients: string[];
  extras: Extra[];
  variants: Variant[];
}

interface ProductFormProps {
  categories: { id: string; name: string }[];
  initial?: ProductFormInitial;
}

type FieldErrors = Record<string, string[] | undefined>;

export function ProductForm({ categories, initial }: ProductFormProps) {
  const router = useRouter();
  const isEdit = Boolean(initial);

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [shortDescription, setShortDescription] = useState(initial?.shortDescription ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "none");
  const [images, setImages] = useState<ProductImage[]>(initial?.images ?? []);
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [comparePrice, setComparePrice] = useState(
    initial?.comparePrice != null ? String(initial.comparePrice) : ""
  );
  const [costPrice, setCostPrice] = useState(
    initial?.costPrice != null ? String(initial.costPrice) : ""
  );
  const [discount, setDiscount] = useState(initial ? String(initial.discount) : "0");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [barcode, setBarcode] = useState(initial?.barcode ?? "");
  const [calories, setCalories] = useState(
    initial?.calories != null ? String(initial.calories) : ""
  );
  const [stockQuantity, setStockQuantity] = useState(
    initial?.stockQuantity != null ? String(initial.stockQuantity) : ""
  );
  const [stockStatus, setStockStatus] = useState(initial?.stockStatus ?? "IN_STOCK");
  const [status, setStatus] = useState<ProductStatus>(initial?.status ?? "ACTIVE");
  const [isAvailable, setIsAvailable] = useState(initial?.isAvailable ?? true);
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [bestSeller, setBestSeller] = useState(initial?.bestSeller ?? false);
  const [prepTimeMins, setPrepTimeMins] = useState(
    initial?.prepTimeMins != null ? String(initial.prepTimeMins) : ""
  );
  const [ingredients, setIngredients] = useState<string[]>(initial?.ingredients ?? []);
  const [variants, setVariants] = useState<Variant[]>(initial?.variants ?? []);
  const [extras, setExtras] = useState<Extra[]>(initial?.extras ?? []);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    // Drop incomplete rows so partial edits don't fail validation.
    const cleanVariants = variants
      .map((v) => ({
        name: v.name.trim(),
        priceAdjustment: v.priceAdjustment,
        stock: v.stock ?? null,
        sku: (v.sku ?? "").trim(),
      }))
      .filter((v) => v.name);
    const cleanExtras = extras
      .map((x) => ({ name: x.name.trim(), price: x.price, isActive: x.isActive }))
      .filter((x) => x.name);

    const payload = {
      ...(initial ? { id: initial.id } : {}),
      name,
      description,
      shortDescription,
      categoryId: categoryId === "none" ? null : categoryId,
      images,
      price: price === "" ? undefined : Number(price),
      comparePrice: comparePrice === "" ? null : Number(comparePrice),
      costPrice: costPrice === "" ? null : Number(costPrice),
      discount: discount === "" ? 0 : Number(discount),
      sku,
      barcode,
      calories: calories === "" ? null : Number(calories),
      stockQuantity: stockQuantity === "" ? null : Number(stockQuantity),
      stockStatus,
      status,
      isAvailable,
      featured,
      bestSeller,
      prepTimeMins: prepTimeMins === "" ? null : Number(prepTimeMins),
      ingredients,
      extras: cleanExtras,
      variants: cleanVariants,
    };

    setPending(true);
    try {
      const res = isEdit ? await updateProduct(payload) : await createProduct(payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? "Product updated" : "Product created");
      router.push("/dashboard/products");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const err = (k: string) => errors[k]?.[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-24">
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* Left column */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Basics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Margherita Pizza"
                  autoFocus
                />
                {err("name") && <p className="text-xs text-rose-400">{err("name")}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shortDescription">Short description</Label>
                <Input
                  id="shortDescription"
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="One-line summary for cards & listings"
                  maxLength={300}
                />
                {err("shortDescription") && (
                  <p className="text-xs text-rose-400">{err("shortDescription")}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Full, appetising description…"
                  rows={4}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Images & gallery</Label>
                <MultiImageUploader value={images} onChange={setImages} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Variants</Label>
                <p className="text-xs text-fog-500">
                  Size, Spicy level, Portion, etc. Each can adjust price and track stock.
                </p>
                <VariantsEditor value={variants} onChange={setVariants} />
              </div>
              <div className="space-y-2">
                <Label>Extras</Label>
                <p className="text-xs text-fog-500">Cheese, Sauce, Drinks, etc.</p>
                <ExtrasEditor value={extras} onChange={setExtras} />
              </div>
              <div className="space-y-2">
                <Label>Ingredients</Label>
                <TagsInput
                  value={ingredients}
                  onChange={setIngredients}
                  placeholder="Add ingredient and press Enter"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="price">Price (£)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                  />
                  {err("price") && <p className="text-xs text-rose-400">{err("price")}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="comparePrice">Compare price (£)</Label>
                  <Input
                    id="comparePrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={comparePrice}
                    onChange={(e) => setComparePrice(e.target.value)}
                    placeholder="0.00"
                  />
                  {err("comparePrice") && (
                    <p className="text-xs text-rose-400">{err("comparePrice")}</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="costPrice">Cost price (£)</Label>
                  <Input
                    id="costPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="0.00"
                  />
                  {err("costPrice") && (
                    <p className="text-xs text-rose-400">{err("costPrice")}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="discount">Discount (%)</Label>
                  <Input
                    id="discount"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    placeholder="0"
                  />
                  {err("discount") && (
                    <p className="text-xs text-rose-400">{err("discount")}</p>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sku">SKU</Label>
                  <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="ABC-001" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input
                    id="barcode"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="stockQuantity">Stock quantity</Label>
                  <Input
                    id="stockQuantity"
                    type="number"
                    min="0"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    placeholder="—"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Stock status</Label>
                  <Select value={stockStatus} onValueChange={(v) => setStockStatus(v as typeof stockStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IN_STOCK">In stock</SelectItem>
                      <SelectItem value="LOW_STOCK">Low stock</SelectItem>
                      <SelectItem value="OUT_OF_STOCK">Out of stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="prep">Prep time (mins)</Label>
                  <Input
                    id="prep"
                    type="number"
                    min="0"
                    value={prepTimeMins}
                    onChange={(e) => setPrepTimeMins(e.target.value)}
                    placeholder="—"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="calories">Calories (kcal)</Label>
                  <Input
                    id="calories"
                    type="number"
                    min="0"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    placeholder="—"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as ProductStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-fog-500">
                  Only <span className="text-fog-300">Active</span> products show on your storefront.
                </p>
              </div>
              <div className="space-y-3">
                <ToggleRow label="Available" hint="Customers can order this" checked={isAvailable} onChange={setIsAvailable} />
                <ToggleRow label="Featured" hint="Highlight on your storefront" checked={featured} onChange={setFeatured} />
                <ToggleRow label="Best seller" hint="Show a best-seller badge" checked={bestSeller} onChange={setBestSeller} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink-950/90 px-5 py-3 backdrop-blur lg:pl-64">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => router.push("/dashboard/products")} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : isEdit ? "Save changes" : "Create product"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line bg-ink-850 px-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-fog-500">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
