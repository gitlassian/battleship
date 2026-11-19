export default function ErrorBox({ error, onRetry }) {
  return (
    <div className="error-box">
      <p>Не удалось загрузить данные: {error.message}</p>
      {onRetry && <button onClick={onRetry}>Повторить</button>}
    </div>
  );
}
