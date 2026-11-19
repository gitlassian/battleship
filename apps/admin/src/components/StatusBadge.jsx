import { CAT_STATUSES, ORDER_STATUSES } from '../format.js';

const LABELS = { ...CAT_STATUSES, ...ORDER_STATUSES };

export default function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{LABELS[status] || status}</span>;
}
