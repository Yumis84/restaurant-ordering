export interface Location { id:string; slug:string; name:string; address?:string; active:boolean }
export interface Category { id:string; location_id:string; name:string; sort_order:number; active:boolean }
export interface Product { id:string; location_id:string; category_id?:string; name:string; description?:string; price:number; image_url?:string; available:boolean; sort_order:number }
export interface ModifierGroup { id:string; location_id:string; name:string; min_select:number; max_select:number; sort_order:number; active:boolean }
export interface Modifier { id:string; group_id:string; name:string; price_delta:number; available:boolean; sort_order:number }
export interface ProductModifierGroup { product_id:string; group_id:string }
export type OrderStatus='pending'|'accepted'|'preparing'|'ready'|'completed'|'rejected'|'cancelled'
export interface PlacedOrder { order_id:string; order_number:number; public_token:string; status:OrderStatus; total:number }
