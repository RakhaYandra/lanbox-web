export default function UploadButton({ disabled, onFiles }) {
  return (
    <label className={disabled ? 'upload disabled' : 'upload'}>
      [ Upload Files ]
      <input
        type="file"
        multiple
        hidden
        disabled={disabled}
        onChange={(e) => {
          onFiles([...e.target.files]);
          e.target.value = '';
        }}
      />
    </label>
  );
}
