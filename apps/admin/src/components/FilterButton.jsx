export default function FilterButton({ active, children, onClick }) {
  return (
    <button className={`chip${active ? ' active' : ''}`} onClick={onClick}>{children}</button>
  );
}
