/** Display-only snapshots. No catalogue lookups or order mutations. */
export type TicketItem = {
  id: string
  name_snapshot: string
  quantity: number
  modifiers: { id: string; name_snapshot: string }[]
  // Preview extensions; not fields in the existing production order_items table.
  exclusions?: string[]
  note?: string
}

export default function TicketItems({ items }: { items: TicketItem[] }) {
  return <ul aria-label="Состав заказа" className="my-5 divide-y divide-slate-200">
    {items.map(item => <li key={item.id} className="py-3 first:pt-0 last:pb-0">
      <p className="break-words text-xl font-bold">{item.quantity} × {item.name_snapshot}</p>
      {item.modifiers.length > 0 && <ul aria-label="Добавки" className="mt-2 space-y-1 border-l-4 border-emerald-600 pl-3">
        {item.modifiers.map(modifier => <li key={modifier.id} className="break-words text-lg font-semibold text-emerald-900">Добавить: {modifier.name_snapshot}</li>)}
      </ul>}
      {!!item.exclusions?.length && <ul aria-label="Исключить из состава" className="mt-2 space-y-1 border-l-4 border-red-600 pl-3">
        {item.exclusions.map((ingredient, index) => <li key={index} className="break-words text-lg font-bold text-red-800">Без: {ingredient}</li>)}
      </ul>}
      {item.note && <p className="mt-2 break-words rounded-lg bg-amber-50 p-3 text-amber-950"><span className="font-bold">К этой позиции: </span>{item.note}</p>}
    </li>)}
  </ul>
}
