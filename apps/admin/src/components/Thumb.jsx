export default function Thumb({ url, large = false }) {
  const cls = `thumb${large ? ' large' : ''}`;
  return url ? <img className={cls} src={url} alt="" /> : <div className={`${cls} placeholder`}>🐱</div>;
}
