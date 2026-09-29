type IconName = 'folder' | 'file' | 'upload' | 'download' | 'check' | 'x' | 'chevron' | 'eye';

const paths: Record<IconName, string> = {
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  file: 'M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M14 2v4h4',
  upload: 'M12 16V4 M6 10l6-6 6 6 M4 20h16',
  download: 'M12 4v12 M6 10l6 6 6-6 M4 20h16',
  check: 'M4 12l5 5L20 6',
  x: 'M6 6l12 12 M18 6L6 18',
  chevron: 'M9 6l6 6-6 6',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
};

export default function Icon({ name }: { name: IconName }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d={paths[name]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
